import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { notifyVerificationResult } from '@/lib/email';

/**
 * POST /api/admin/listings/bulk
 * 批量更新多筆房源狀態
 *
 * Body:
 *   ids          string[]   — 要更新的 listing ID 陣列（最多 100 筆）
 *   status       string     — 目標狀態：'active' | 'rejected' | 'inactive'
 *   rejectReason string?    — 退件原因（status = 'rejected' 時使用）
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  let body: { ids?: string[]; status?: string; rejectReason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '無效的請求內容' }, { status: 400 });
  }

  const { ids, status, rejectReason } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '請提供要更新的 ID 陣列' }, { status: 400 });
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: '一次最多批量處理 100 筆' }, { status: 400 });
  }
  if (!status || !['active', 'rejected', 'inactive'].includes(status)) {
    return NextResponse.json({ error: '無效的狀態值' }, { status: 400 });
  }

  // ── 批量更新（transaction 確保全部成功或全部回滾）──────────────────────
  const updatedCount = await prisma.$transaction(async (tx) => {
    const result = await tx.listing.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
    return result.count;
  });

  // ── 異步寄送通知（不阻塞 response）────────────────────────────────────
  if (status === 'active' || status === 'rejected') {
    prisma.listing.findMany({
      where: { id: { in: ids } },
      include: { owner: { select: { email: true, name: true } } },
    }).then(listings => {
      for (const listing of listings) {
        notifyVerificationResult({
          userEmail: listing.owner.email,
          userName: listing.owner.name,
          status: status === 'active' ? 'approved' : 'rejected',
          note: rejectReason || (status === 'rejected' ? '請修改後重新提交' : undefined),
        }).catch(() => {});
      }
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    updated: updatedCount,
    status,
  });
}
