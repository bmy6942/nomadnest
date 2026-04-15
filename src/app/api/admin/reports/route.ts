import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

// GET /api/admin/reports — 取得所有檢舉（含被舉報對象的預覽內容）
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending';

  // ✅ status 查詢參數白名單（防止任意字串作為 Prisma 過濾條件）
  const VALID_STATUSES = ['pending', 'resolved', 'dismissed', 'all'];
  const safeStatus = VALID_STATUSES.includes(status) ? status : 'pending';

  const reports = await prisma.report.findMany({
    where: safeStatus === 'all' ? {} : { status: safeStatus },
    include: { reporter: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500, // 防止大量檢舉時返回海量資料
  });

  if (reports.length === 0) return NextResponse.json([]);

  // ── 批次抓取被舉報對象的詳細資訊 ──────────────────────────────────────
  const listingIds = reports.filter(r => r.targetType === 'listing').map(r => r.targetId);
  const userIds    = reports.filter(r => r.targetType === 'user').map(r => r.targetId);
  const messageIds = reports.filter(r => r.targetType === 'message').map(r => r.targetId);

  const [listings, reportedUsers, messages] = await Promise.all([
    listingIds.length > 0
      ? prisma.listing.findMany({
          where: { id: { in: listingIds } },
          select: {
            id: true, title: true, city: true, district: true,
            status: true, images: true,
            owner: { select: { id: true, name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, role: true, banned: true, verified: true },
        })
      : Promise.resolve([]),
    messageIds.length > 0
      ? prisma.message.findMany({
          where: { id: { in: messageIds } },
          select: {
            id: true, content: true, hasContact: true, createdAt: true,
            sender: { select: { id: true, name: true, email: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // 建立 map 方便 O(1) 查詢
  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));
  const userMap    = Object.fromEntries(reportedUsers.map(u => [u.id, u]));
  const messageMap = Object.fromEntries(messages.map(m => [m.id, m]));

  const enriched = reports.map(r => ({
    ...r,
    targetContent:
      r.targetType === 'listing' ? (listingMap[r.targetId] ?? null)
      : r.targetType === 'user'  ? (userMap[r.targetId]    ?? null)
      : r.targetType === 'message' ? (messageMap[r.targetId] ?? null)
      : null,
  }));

  return NextResponse.json(enriched);
}

// PATCH /api/admin/reports — 處理檢舉
//   { id, status, note? }                               — 標記已處理 / 忽略（附備註）
//   { id, status: 'resolved', action: 'ban_user' }      — 封禁舉報的用戶 + 解決
//   { id, status: 'resolved', action: 'takedown' }      — 下架舉報的房源 + 解決
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // ── JSON 解析（防止畸形請求觸發 500）──────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { id, status, note, action } = body;

  // ✅ id 型別守衛（防止非字串值繞過 falsy 檢查導致 Prisma 500）
  if (!id || typeof id !== 'string' || !id.trim()) {
    return NextResponse.json({ error: 'Missing report id' }, { status: 400 });
  }
  if (typeof status !== 'string' || !['resolved', 'dismissed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  // 取得報告（快速行動需要 targetType + targetId）
  const report = await prisma.report.findUnique({
    where: { id },
    select: { targetType: true, targetId: true },
  });
  if (!report) return NextResponse.json({ error: '找不到此檢舉' }, { status: 404 });

  // ── 快速行動 ──────────────────────────────────────────────────────────
  if (action === 'ban_user' && report.targetType === 'user') {
    // 封禁被舉報的用戶
    await prisma.user.update({
      where: { id: report.targetId },
      data: { banned: true },
    }).catch(() => {}); // 用戶可能已刪除，忽略錯誤
  }

  if (action === 'takedown' && report.targetType === 'listing') {
    // 下架被舉報的房源
    await prisma.listing.update({
      where: { id: report.targetId },
      data: { status: 'inactive' },
    }).catch(() => {});
  }

  // ── 更新報告狀態 ──────────────────────────────────────────────────────
  const updated = await prisma.report.update({
    where: { id },
    data: {
      status,
      // ✅ 型別守衛：確保 note 是字串才寫入（防止非字串傳入導致 Prisma TypeError → 500）
      ...(note && typeof note === 'string' && note.trim() ? { resolutionNote: note.trim() } : {}),
    },
  });

  return NextResponse.json(updated);
}
