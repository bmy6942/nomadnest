import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/listings/recent
 * 回傳目前登入用戶最近瀏覽的 10 筆房源（去重，依最後瀏覽時間排序）
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // 取出最近 50 筆瀏覽紀錄，然後去重取前 10
  const views = await prisma.listingView.findMany({
    where: { visitorId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { listingId: true, createdAt: true },
  });

  // 去重（保留每個 listingId 最近一次）
  const seen = new Set<string>();
  const uniqueIds: string[] = [];
  const lastViewedAt = new Map<string, Date>();
  for (const v of views) {
    if (!seen.has(v.listingId)) {
      seen.add(v.listingId);
      uniqueIds.push(v.listingId);
      lastViewedAt.set(v.listingId, v.createdAt);
      if (uniqueIds.length === 10) break;
    }
  }

  if (uniqueIds.length === 0) return NextResponse.json([]);

  // 批次查詢房源資料（只取 active 的）
  const listings = await prisma.listing.findMany({
    where: { id: { in: uniqueIds }, status: 'active' },
    select: {
      id: true, title: true, city: true, district: true, type: true,
      price: true, wifiSpeed: true, images: true,
      reviews: { select: { rating: true } },
    },
  });

  // 依原本瀏覽順序排序，並附上最後瀏覽時間
  const ordered = uniqueIds
    .map(id => {
      const l = listings.find(x => x.id === id);
      if (!l) return null;
      // ✅ 安全解析 images（DB 資料損壞時防止 JSON.parse 拋出 500）
      const images: string[] = (() => { try { return JSON.parse(l.images || '[]') as string[]; } catch { return []; } })();
      const avgRating = l.reviews.length
        ? (l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length).toFixed(1)
        : null;
      return { ...l, images, avgRating, reviewCount: l.reviews.length, lastViewedAt: lastViewedAt.get(id) };
    })
    .filter(Boolean);

  return NextResponse.json(ordered, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
