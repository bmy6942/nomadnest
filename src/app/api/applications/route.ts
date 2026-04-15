import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { applicationLimiter } from '@/lib/rateLimit';
import { validateOrigin } from '@/lib/csrf';
import {
  notifyLandlordNewApplication,
  notifyTenantApplicationStatus,
  notifyTenantApplicationSubmitted,
} from '@/lib/email';

export async function POST(req: NextRequest) {
  // ── CSRF 來源驗證 ──────────────────────────────────────────────────────────
  const csrf = validateOrigin(req);
  if (!csrf.ok) return NextResponse.json({ error: 'CSRF 驗證失敗' }, { status: 403 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ✅ 角色守衛：只有租客帳號可以提交申請（防止房東/管理員越權申請）
  if (user.role !== 'tenant') {
    return NextResponse.json({ error: '只有租客帳號可以提交申請' }, { status: 403 });
  }

  // ── 申請速率限制：每用戶每天 20 次 ───────────────────────────────────────
  const rateCheck = applicationLimiter.check(`apply:${user.id}`);
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: `申請次數已達上限，請於 ${rateCheck.retryAfter} 秒後再試` },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  // ── JSON 解析（防止畸形請求觸發 500）──────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { listingId, message, moveInDate, duration } = body;

  // ✅ listingId 型別驗證（空陣列等非字串值會通過 falsy 檢查，繞過後導致 Prisma 500）
  if (!listingId || typeof listingId !== 'string' || !listingId.trim()) {
    return NextResponse.json({ error: '請提供有效的房源 ID' }, { status: 400 });
  }
  if (!message || !moveInDate || !duration) {
    return NextResponse.json({ error: '請填寫所有欄位' }, { status: 400 });
  }
  // ── 輸入驗證 ──────────────────────────────────────────────────────────────
  if (typeof message !== 'string' || message.trim().length < 10 || message.length > 500) {
    return NextResponse.json({ error: '申請說明需介於 10~500 字元' }, { status: 400 });
  }
  const moveInStr = String(moveInDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(moveInStr) || isNaN(Date.parse(moveInStr))) {
    return NextResponse.json({ error: '入住日期格式錯誤（需為 YYYY-MM-DD）' }, { status: 400 });
  }
  // 入住日期不可早於今天（防止提交過去日期）
  const today = new Date().toISOString().slice(0, 10);
  if (moveInStr < today) {
    return NextResponse.json({ error: '入住日期不可早於今天' }, { status: 400 });
  }
  const durationNum = parseInt(String(duration), 10);
  if (isNaN(durationNum) || durationNum < 1 || durationNum > 60) {
    return NextResponse.json({ error: '租期需在 1~60 個月之間' }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { owner: { select: { name: true, email: true } } },
  });
  if (!listing || listing.status !== 'active') {
    return NextResponse.json({ error: '此房源不開放申請' }, { status: 400 });
  }
  if (listing.ownerId === user.id) {
    return NextResponse.json({ error: '不能申請自己的房源' }, { status: 400 });
  }

  const existing = await prisma.application.findFirst({
    where: { listingId, tenantId: user.id, status: { in: ['pending', 'approved'] } },
  });
  if (existing) return NextResponse.json({ error: '您已申請過此房源' }, { status: 400 });

  const app = await prisma.application.create({
    data: { listingId, tenantId: user.id, message: message.trim(), moveInDate: moveInStr, duration: durationNum, status: 'pending' },
  });

  // 📧 通知房東有新申請
  notifyLandlordNewApplication({
    landlordEmail: listing.owner.email,
    landlordName: listing.owner.name,
    tenantName: user.name,
    listingTitle: listing.title,
    moveInDate: moveInStr,
    duration: durationNum,
    listingId,
  }).catch(() => {});

  // 📧 寄申請確認信給租客
  notifyTenantApplicationSubmitted({
    tenantEmail: user.email,
    tenantName: user.name,
    listingTitle: listing.title,
    listingCity: listing.city,
    moveInDate: moveInStr,
    duration: durationNum,
    listingId,
  }).catch(() => {});

  return NextResponse.json(app, { status: 201 });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role') || 'tenant';

  if (role === 'landlord') {
    const apps = await prisma.application.findMany({
      where: { listing: { ownerId: user.id } },
      include: {
        listing: { select: { id: true, title: true, price: true } },
        tenant: { select: { name: true, email: true, verified: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // 防止大量資料導致記憶體溢出（200 筆足以涵蓋實際使用情境）
    });
    return NextResponse.json(apps);
  }

  const apps = await prisma.application.findMany({
    where: { tenantId: user.id },
    include: { listing: { select: { id: true, title: true, price: true, city: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100, // 租客申請上限（租客不太可能超過 100 筆有效申請）
  });
  return NextResponse.json(apps);
}

// 房東回覆字數上限
const REPLY_MAX = 500;

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ── JSON 解析（防止畸形請求觸發 500）──────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { id, status, landlordReply } = body;

  // ── 缺少申請 ID 快速守衛 ──────────────────────────────────────────────────
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: '缺少申請 ID' }, { status: 400 });
  }

  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      listing: { include: { owner: { select: { phone: true, lineId: true } } } },
      tenant: { select: { email: true, name: true } },
    },
  });
  if (!app) return NextResponse.json({ error: '找不到申請' }, { status: 404 });

  const isLandlord = app.listing.ownerId === user.id;
  const isTenant   = app.tenantId === user.id;
  if (!isLandlord && !isTenant) return NextResponse.json({ error: '無權限' }, { status: 403 });

  // ── 終止狀態守衛：withdrawn 與 rejected 不可再變更 ───────────────────────
  // withdrawn = 租客已主動撤回（不可再被審批）
  // rejected  = 房東婉拒（可由房東改回 approved，符合業務需求）
  if (status !== undefined && app.status === 'withdrawn') {
    return NextResponse.json({ error: '已撤回的申請不可再變更狀態' }, { status: 400 });
  }
  // 租客不可撤回已婉拒的申請（已是終止狀態，無意義操作）
  if (status === 'withdrawn' && app.status === 'rejected') {
    return NextResponse.json({ error: '已婉拒的申請不可撤回' }, { status: 400 });
  }
  // 不可對已完成合約的申請更改狀態（防止撤回引發合約孤立）
  if (status !== undefined && app.status === 'approved') {
    // 僅允許房東將 approved → rejected（改變主意），租客不得撤回已批准申請
    if (isTenant && status === 'withdrawn') {
      return NextResponse.json({ error: '申請已批准，請聯繫房東處理' }, { status: 400 });
    }
  }

  // ── 角色型狀態白名單（防止租客自審批 IDOR）────────────────────────────────
  // 只有房東可以寫回覆訊息
  if (!isLandlord && landlordReply !== undefined) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }
  // 狀態變更白名單：
  //   房東 → 只能設 approved | rejected
  //   租客 → 只能設 withdrawn（撤回申請）
  const LANDLORD_STATUSES = new Set(['approved', 'rejected']);
  const TENANT_STATUSES   = new Set(['withdrawn']);
  if (status !== undefined) {
    if (isLandlord && !LANDLORD_STATUSES.has(status)) {
      return NextResponse.json({ error: '無效的狀態值' }, { status: 400 });
    }
    if (isTenant && !TENANT_STATUSES.has(status)) {
      // 租客嘗試設定非 withdrawn 狀態 → 403（防自審批攻擊）
      return NextResponse.json({ error: '無權限設定此狀態' }, { status: 403 });
    }
  }

  // ── 房東回覆長度限制 ──────────────────────────────────────────────────────
  if (landlordReply !== undefined && typeof landlordReply === 'string' && landlordReply.trim().length > REPLY_MAX) {
    return NextResponse.json({ error: `房東回覆不可超過 ${REPLY_MAX} 字元` }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (isLandlord && landlordReply !== undefined) {
    // ✅ 型別守衛：確保是字串才呼叫 .trim()，非字串傳入時清空回覆（防止 TypeError → 500）
    const replyStr = typeof landlordReply === 'string' ? landlordReply.trim() : null;
    updateData.landlordReply = replyStr || null;
  }

  const updated = await prisma.application.update({ where: { id }, data: updateData });

  // 📧 通知租客申請結果
  if (isLandlord && status && (status === 'approved' || status === 'rejected')) {
    notifyTenantApplicationStatus({
      tenantEmail: app.tenant.email,
      tenantName: app.tenant.name,
      listingTitle: app.listing.title,
      status,
      landlordPhone: app.listing.owner.phone,
      landlordLine: app.listing.owner.lineId,
      listingId: app.listingId,
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}
