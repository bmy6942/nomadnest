import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ✅ Promise.all：四個查詢並行執行（取代串行等待）
  const [myListings, myApplications, incomingApplications, myReviews] = await Promise.all([
    // ✅ take: 100 — 防止無上限查詢造成記憶體爆炸
    prisma.listing.findMany({
      where: { ownerId: user.id },
      include: { applications: true, reviews: { select: { rating: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.application.findMany({
      where: { tenantId: user.id },
      include: {
        listing: {
          select: {
            id: true, title: true, price: true, city: true, district: true, images: true,
            // 申請批准後顯示房東聯絡資訊
            owner: { select: { name: true, phone: true, lineId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.application.findMany({
      where: { listing: { ownerId: user.id } },
      include: {
        tenant: { select: { id: true, name: true, email: true, verified: true, phone: true, lineId: true } },
        listing: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    // 租客撰寫的所有評價
    prisma.review.findMany({
      where: { reviewerId: user.id },
      include: {
        listing: { select: { id: true, title: true, city: true, district: true, images: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  return NextResponse.json({
    // ✅ 只回傳安全欄位，防止 passwordHash / verificationToken 等敏感資料外洩
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      verified: user.verified,
      verificationStatus: user.verificationStatus,
    },
    myListings: myListings.map(l => ({
      ...l,
      // ✅ 安全解析 images（DB 資料損壞時防止 JSON.parse 拋出 500）
      images: (() => { try { return JSON.parse(l.images || '[]') as string[]; } catch { return []; } })(),
      avgRating: l.reviews.length ? (l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length).toFixed(1) : null,
    })),
    myApplications: myApplications.map(a => ({
      ...a,
      listing: {
        ...a.listing,
        images: (() => { try { return JSON.parse(a.listing.images || '[]') as string[]; } catch { return []; } })(),
      },
    })),
    incomingApplications,
    myReviews: myReviews.map(r => ({
      ...r,
      listing: {
        ...r.listing,
        images: (() => { try { return JSON.parse(r.listing.images || '[]') as string[]; } catch { return []; } })(),
      },
    })),
  });
}
