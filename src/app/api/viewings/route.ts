import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notifyLandlordNewViewing } from '@/lib/email';

// 備註字數上限
const NOTES_MAX = 500;

/**
 * 驗證值是合法的 ISO 日期時間字串 且 是未來時間點
 * new Date('invalid') 回傳 Invalid Date，其 getTime() 為 NaN
 * NaN <= number 永遠是 false，直接用 <= 比較會讓非法日期繞過驗證
 * 必須先用 isNaN 攔截
 */
function isValidFutureDateTime(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  const d = new Date(value);
  return !isNaN(d.getTime()) && d > new Date();
}

// GET /api/viewings — 取得我的看房預約（並自動將已過期的確認預約標記為 completed）
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // 自動將確認時間已過的 confirmed 預約標為 completed（非同步，不影響回應速度）
  const now = new Date();
  prisma.viewingRequest.updateMany({
    where: {
      status: 'confirmed',
      confirmedTime: { lt: now.toISOString() },
    },
    data: { status: 'completed' },
  }).catch(() => {});

  const viewings = await prisma.viewingRequest.findMany({
    where: user.role === 'tenant'
      ? { tenantId: user.id }
      : { listing: { ownerId: user.id } },
    include: {
      listing: { select: { id: true, title: true, city: true, district: true, images: true, price: true, ownerId: true } },
      tenant:  { select: { id: true, name: true, phone: true, lineId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200, // 防止房東擁有多個房源時返回海量資料
  });

  return NextResponse.json(viewings);
}

// POST /api/viewings — 租客提交看房預約（提供 3 個候選時間）
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
  if (user.role !== 'tenant') return NextResponse.json({ error: '只有租客可以預約看房' }, { status: 403 });

  // ── JSON 解析（防止畸形請求觸發 500）──────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { listingId, proposedTime1, proposedTime2, proposedTime3, notes } = body;

  // ✅ listingId 型別驗證（空陣列等非字串值通過 falsy 檢查 → prisma.findUnique({ id: [] }) → 500）
  if (!listingId || typeof listingId !== 'string' || !listingId.trim()) {
    return NextResponse.json({ error: '請提供有效的房源 ID' }, { status: 400 });
  }
  if (!proposedTime1) {
    return NextResponse.json({ error: '請提供至少一個候選時間' }, { status: 400 });
  }

  // ── 候選時間格式與未來性驗證（NaN bypass 防護）────────────────────────────
  // new Date('invalid') ≤ new Date() 為 false（NaN 比較永遠 false）
  // → 必須先用 isValidFutureDateTime 確認格式合法且為未來
  if (!isValidFutureDateTime(proposedTime1)) {
    return NextResponse.json({ error: '候選時間 1 必須是合法且為未來的時間點' }, { status: 400 });
  }
  if (proposedTime2 !== undefined && proposedTime2 !== null && proposedTime2 !== '') {
    if (!isValidFutureDateTime(proposedTime2)) {
      return NextResponse.json({ error: '候選時間 2 必須是合法且為未來的時間點' }, { status: 400 });
    }
  }
  if (proposedTime3 !== undefined && proposedTime3 !== null && proposedTime3 !== '') {
    if (!isValidFutureDateTime(proposedTime3)) {
      return NextResponse.json({ error: '候選時間 3 必須是合法且為未來的時間點' }, { status: 400 });
    }
  }

  // ── 備註：型別守衛 + 長度限制 ────────────────────────────────────────────
  // ✅ notes 非字串時不寫入 DB（Prisma schema 期望 String?，型別不符會觸發驗證錯誤 → 500）
  const notesStr: string | undefined =
    notes !== undefined && notes !== null && typeof notes === 'string'
      ? notes
      : undefined;
  if (notesStr !== undefined && notesStr.length > NOTES_MAX) {
    return NextResponse.json({ error: `備註不可超過 ${NOTES_MAX} 字元` }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { owner: { select: { email: true, name: true } } },
  });
  if (!listing) return NextResponse.json({ error: '房源不存在' }, { status: 404 });
  if (listing.status !== 'active') return NextResponse.json({ error: '此房源目前不開放預約' }, { status: 400 });

  // ✅ 防重複：同一租客對同一房源只能有一筆 pending 或 confirmed 預約
  const existing = await prisma.viewingRequest.findFirst({
    where: {
      tenantId: user.id,
      listingId,
      status: { in: ['pending', 'confirmed'] },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: '您已有一筆進行中的看房預約，請在控制台取消後再重新預約' },
      { status: 409 }
    );
  }

  // 提取候選時間（已驗證為字串）
  const p1 = proposedTime1 as string;
  const p2 = (proposedTime2 && typeof proposedTime2 === 'string') ? proposedTime2 : undefined;
  const p3 = (proposedTime3 && typeof proposedTime3 === 'string') ? proposedTime3 : undefined;

  const viewing = await prisma.viewingRequest.create({
    data: { listingId, tenantId: user.id, proposedTime1: p1, proposedTime2: p2, proposedTime3: p3, notes: notesStr },
  });

  // 📧 通知房東有新看房預約
  const times = [p1, p2, p3].filter(Boolean) as string[];
  notifyLandlordNewViewing({
    landlordEmail: listing.owner.email,
    landlordName: listing.owner.name,
    tenantName: user.name,
    listingTitle: listing.title,
    times,
    notes: notesStr,
  }).catch(() => {});

  return NextResponse.json(viewing, { status: 201 });
}
