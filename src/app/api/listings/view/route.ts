import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

// POST /api/listings/view — 記錄一次瀏覽
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const { listingId } = body;
    // ✅ 型別守衛：空陣列等非字串值通過 falsy 檢查後會讓 Prisma where 條件異常
    if (!listingId || typeof listingId !== 'string' || !listingId.trim()) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const user = await getCurrentUser();

    // 防重複：同一 visitor 同一 listing 30 分鐘內不重計
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const existing = await prisma.listingView.findFirst({
      where: {
        listingId,
        visitorId: user?.id ?? null,
        createdAt: { gte: since },
      },
    });
    if (existing) return NextResponse.json({ ok: true, counted: false });

    await prisma.listingView.create({
      data: { listingId, visitorId: user?.id ?? null },
    });
    return NextResponse.json({ ok: true, counted: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
