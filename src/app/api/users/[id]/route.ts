/**
 * GET /api/users/[id]
 * 公開個人頁資料 — 不含私人欄位（email / phone / lineId 除非已驗證且是房東才顯示）
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser(); // 可能是訪客（null）

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, role: true, avatar: true, bio: true,
      verified: true, banned: true, createdAt: true,
      // 聯絡資訊：僅房東且已通過身份驗證才公開
      phone: true, lineId: true,
      listings: {
        where: { status: 'active' },
        select: {
          id: true, title: true, city: true, district: true, type: true,
          price: true, wifiSpeed: true, images: true, status: true,
          reviews: { select: { rating: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      reviewsGiven: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!user) return NextResponse.json({ error: '用戶不存在' }, { status: 404 });

  // ✅ 被封鎖帳號的公開頁面回傳 404（與 auth.ts 的行為一致）
  if (user.banned) return NextResponse.json({ error: '用戶不存在' }, { status: 404 });

  // 隱私處理：
  // 1. 聯絡資訊只有房東已驗證才顯示（或本人）
  const isSelf = me?.id === user.id;
  const showContact = isSelf || (user.verified && user.role === 'landlord');

  // 2. 計算平均評分（從自己房源的評價）
  const allRatings = user.listings.flatMap(l =>
    (l.reviews as { rating: number }[]).map(r => r.rating)
  );
  const avgRating = allRatings.length > 0
    ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
    : null;
  const reviewCount = allRatings.length;

  // 取得收到的評價數（作為租客身份被評價）— 不需要，只計算房源評價
  const listingsWithRating = user.listings.map(l => ({
    ...l,
    images: l.images,
    avgRating: (l.reviews as { rating: number }[]).length > 0
      ? ((l.reviews as { rating: number }[]).reduce((a, b) => a + b.rating, 0) / (l.reviews as { rating: number }[]).length).toFixed(1)
      : null,
    reviewCount: (l.reviews as { rating: number }[]).length,
    reviews: undefined,
  }));

  return NextResponse.json({
    id:       user.id,
    name:     user.name,
    role:     user.role,
    avatar:   user.avatar,
    bio:      user.bio,
    verified: user.verified,
    joinedAt: user.createdAt,
    // ✅ verificationStatus 不對外公開（內部稽核狀態，不屬於公開個人資料）
    phone:    showContact ? user.phone  : null,
    lineId:   showContact ? user.lineId : null,
    showContact,
    avgRating,
    reviewCount,
    listings: listingsWithRating,
  });
}
