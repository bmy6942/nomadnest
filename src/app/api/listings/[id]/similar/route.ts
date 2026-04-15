import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    select: { city: true, type: true, price: true, wifiSpeed: true },
  });
  if (!listing) return NextResponse.json([]);

  // 找同城市、同類型或相近價格的房源，排除自己
  const similar = await prisma.listing.findMany({
    where: {
      status: 'active',
      id: { not: params.id },
      OR: [
        { city: listing.city, type: listing.type },
        { city: listing.city },
      ],
    },
    include: { reviews: { select: { rating: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // 評分排序：同類型 > 同城市；再依評分、Wi-Fi 排序
  const scored = similar.map(l => {
    const avgRating = l.reviews.length
      ? l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length
      : 0;
    const sameType = l.type === listing.type ? 2 : 0;
    const priceDiff = Math.abs(l.price - listing.price);
    const priceScore = priceDiff < 5000 ? 1 : 0;
    const wifiScore = l.wifiSpeed >= listing.wifiSpeed * 0.8 ? 1 : 0;
    return {
      ...l,
      // ✅ 安全解析 images（DB 資料損壞時防止 JSON.parse 拋出 500）
      images: (() => { try { return JSON.parse(l.images || '[]') as string[]; } catch { return []; } })(),
      avgRating: avgRating ? avgRating.toFixed(1) : null,
      reviewCount: l.reviews.length,
      _score: sameType + priceScore + wifiScore + avgRating * 0.5,
    };
  });

  scored.sort((a, b) => b._score - a._score);

  return NextResponse.json(scored.slice(0, 6));
}
