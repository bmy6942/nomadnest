import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/favorites — 取得當前用戶的收藏清單
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ✅ take: 200 — 防止無上限查詢造成記憶體爆炸
  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    include: {
      listing: {
        select: {
          id: true, title: true, city: true, district: true, type: true,
          price: true, minRent: true, wifiSpeed: true, wifiVerified: true,
          hasDesk: true, images: true, includedFees: true, foreignOk: true,
          availableFrom: true, status: true,
          reviews: { select: { rating: true } },
          _count: { select: { favorites: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // 解析 JSON 字串欄位，計算平均評分
  const data = favorites.map(f => ({
    favoritedAt: f.createdAt,
    listing: {
      ...f.listing,
      // ✅ 安全解析 images/includedFees（DB 資料損壞時防止 JSON.parse 拋出 500）
      images: (() => { try { return JSON.parse(f.listing.images || '[]') as string[]; } catch { return []; } })(),
      includedFees: (() => { try { return JSON.parse(f.listing.includedFees || '[]') as string[]; } catch { return []; } })(),
      avgRating: f.listing.reviews.length
        ? (f.listing.reviews.reduce((s, r) => s + r.rating, 0) / f.listing.reviews.length).toFixed(1)
        : null,
      reviewCount: f.listing.reviews.length,
    },
  }));

  return NextResponse.json({ favorites: data });
}

// POST /api/favorites — 切換收藏狀態（已收藏則取消，未收藏則加入）
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ✅ JSON parse guard — 防止惡意格式 JSON 造成未處理 500
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { listingId } = body;
  // ✅ 型別守衛 — 非字串值（如陣列、物件）通過 falsy 檢查後會造成 Prisma where 異常
  if (!listingId || typeof listingId !== 'string' || !listingId.trim()) {
    return NextResponse.json({ error: '缺少 listingId' }, { status: 400 });
  }

  // 確認房源存在
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return NextResponse.json({ error: '房源不存在' }, { status: 404 });

  // 檢查是否已收藏
  const existing = await prisma.favorite.findUnique({
    where: { userId_listingId: { userId: user.id, listingId } },
  });

  if (existing) {
    // 已收藏 → 取消收藏
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  } else {
    // 未收藏 → 加入收藏
    await prisma.favorite.create({ data: { userId: user.id, listingId } });
    return NextResponse.json({ favorited: true });
  }
}
