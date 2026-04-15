import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

/**
 * PATCH /api/reviews/[id]
 * 房東回覆評價 — 僅房源擁有者可操作
 * Body: { ownerReply: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ── JSON 解析（防止格式錯誤觸發 500）────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { ownerReply } = body;
  if (!ownerReply || typeof ownerReply !== 'string' || ownerReply.trim().length === 0) {
    return NextResponse.json({ error: '回覆內容不可為空' }, { status: 400 });
  }
  if (ownerReply.trim().length > 500) {
    return NextResponse.json({ error: '回覆字數上限 500 字' }, { status: 400 });
  }

  // 查找評價並確認是該房源的房東
  const review = await prisma.review.findUnique({
    where: { id: params.id },
    include: { listing: { select: { ownerId: true } } },
  });
  if (!review) return NextResponse.json({ error: '找不到評價' }, { status: 404 });
  if (review.listing.ownerId !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: '只有房源擁有者可以回覆評價' }, { status: 403 });
  }

  try {
    const updated = await prisma.review.update({
      where: { id: params.id },
      data: { ownerReply: ownerReply.trim() },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[reviews] PATCH ownerReply error:', err);
    return NextResponse.json({ error: '回覆儲存失敗，請稍後再試' }, { status: 500 });
  }
}

/**
 * DELETE /api/reviews/[id]/reply (邏輯：PATCH ownerReply = null)
 * 房東可刪除自己的回覆
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const review = await prisma.review.findUnique({
    where: { id: params.id },
    include: { listing: { select: { ownerId: true } } },
  });
  if (!review) return NextResponse.json({ error: '找不到評價' }, { status: 404 });
  if (review.listing.ownerId !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  try {
    await prisma.review.update({
      where: { id: params.id },
      data: { ownerReply: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reviews] DELETE ownerReply error:', err);
    return NextResponse.json({ error: '刪除失敗，請稍後再試' }, { status: 500 });
  }
}
