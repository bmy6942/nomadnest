import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/landlord/stats
 * 房東分析儀表板 — 全面房源統計數據
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
  if (user.role !== 'landlord' && user.role !== 'admin') {
    return NextResponse.json({ error: '僅房東可查看此數據' }, { status: 403 });
  }

  const now    = new Date();
  const d7ago  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
  const d14ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const d30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ── 一次取得所有房源含關聯 ────────────────────────────────────────
  // views 只載入近 30 天以內，避免將全站歷史瀏覽紀錄全部載入記憶體；
  // 總計瀏覽數改用 _count 聚合取得。
  const listings = await prisma.listing.findMany({
    where: { ownerId: user.id },
    select: {
      id: true, title: true, status: true, price: true, city: true, district: true,
      createdAt: true, images: true,
      _count: { select: { views: true } },  // 全時期總瀏覽（聚合，不佔記憶體）
      applications: {
        select: { id: true, status: true, createdAt: true, updatedAt: true },
      },
      reviews:   { select: { rating: true, wifiRating: true } },
      views: {   // 僅載入近 30 天（7d/14d 趨勢計算所需）
        select: { createdAt: true },
        where: { createdAt: { gte: d30ago } },
      },
      favorites: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // ── 建立日期標籤（14 天）────────────────────────────────────────
  const days14: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days14.push(d.toISOString().slice(0, 10)); // 'YYYY-MM-DD'
  }

  // ── 計算每個房源的統計 ──────────────────────────────────────────
  const listingStats = listings.map(l => {
    const views7d   = l.views.filter(v => v.createdAt >= d7ago).length;
    const views30d  = l.views.filter(v => v.createdAt >= d30ago).length; // views 已 where >= d30ago，等於全部
    const viewsAll  = l._count.views; // 使用聚合計數，不受近 30 天限制影響

    // 14 天每日瀏覽趨勢
    const viewsByDay: Record<string, number> = {};
    for (const day of days14) viewsByDay[day] = 0;
    for (const v of l.views) {
      if (v.createdAt >= d14ago) {
        const key = v.createdAt.toISOString().slice(0, 10);
        if (key in viewsByDay) viewsByDay[key]++;
      }
    }
    const viewsTrend = days14.map(day => viewsByDay[day]);

    const appsTotal    = l.applications.length;
    const appsPending  = l.applications.filter(a => a.status === 'pending').length;
    const appsApproved = l.applications.filter(a => a.status === 'approved').length;
    const appsRejected = l.applications.filter(a => a.status === 'rejected').length;
    const appsWithdrawn= l.applications.filter(a => a.status === 'withdrawn').length;
    // 近 30 天新增申請（用於全站轉換率計算，與 views30d 時間維度一致）
    const apps30d      = l.applications.filter(a => a.createdAt >= d30ago).length;

    const convRate = viewsAll > 0
      ? ((appsTotal / viewsAll) * 100).toFixed(1)
      : '0.0';

    const avgRating = l.reviews.length > 0
      ? (l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length).toFixed(1)
      : null;
    const avgWifi = l.reviews.length > 0
      ? (l.reviews.reduce((s, r) => s + r.wifiRating, 0) / l.reviews.length).toFixed(1)
      : null;

    const resolvedApps = l.applications.filter(a =>
      a.status === 'approved' || a.status === 'rejected'
    );
    let avgResponseHours: number | null = null;
    if (resolvedApps.length > 0) {
      const totalMs = resolvedApps.reduce((sum, a) =>
        // updatedAt 代理回覆時間（可能含後續 landlordReply 更新）；
        // 以 0 為下限防止資料異常時回傳負值
        sum + Math.max(0, a.updatedAt.getTime() - a.createdAt.getTime()), 0
      );
      avgResponseHours = Math.max(0, Math.round(totalMs / resolvedApps.length / (1000 * 3600)));
    }

    const favoritesCount = l.favorites.length;

    // 績效評分：綜合瀏覽 + 收藏 + 轉換率 + 評分
    const perfScore = views7d * 1 + favoritesCount * 3 + appsTotal * 5
      + (avgRating ? parseFloat(avgRating) * 10 : 0);

    return {
      id: l.id, title: l.title, status: l.status, price: l.price,
      city: l.city, district: l.district,
      images: l.images,
      views7d, views30d, viewsAll, viewsTrend,
      appsTotal, apps30d, appsPending, appsApproved, appsRejected, appsWithdrawn,
      convRate, favoritesCount,
      avgRating, avgWifi, reviewCount: l.reviews.length,
      avgResponseHours, perfScore,
    };
  });

  // ── 總覽 ─────────────────────────────────────────────────────────
  const totalViews7d    = listingStats.reduce((s, l) => s + l.views7d, 0);
  const totalViews30d   = listingStats.reduce((s, l) => s + l.views30d, 0);
  const totalFavorites  = listingStats.reduce((s, l) => s + l.favoritesCount, 0);
  const totalApps       = listingStats.reduce((s, l) => s + l.appsTotal, 0);
  // 近 30 天新增申請（與 totalViews30d 時間維度一致，避免全時期申請 ÷ 30d 瀏覽的失真比率）
  const totalApps30d    = listingStats.reduce((s, l) => s + l.apps30d, 0);
  const totalApproved   = listingStats.reduce((s, l) => s + l.appsApproved, 0);
  const activeCount     = listingStats.filter(l => l.status === 'active').length;
  const pendingApps     = listingStats.reduce((s, l) => s + l.appsPending, 0);
  const estimatedMonthlyRevenue = listings
    .filter(l => l.status === 'active')
    .reduce((s, l) => s + l.price, 0);

  // 全站 14 天趨勢（所有房源合計）
  const globalTrend = days14.map((_, i) =>
    listingStats.reduce((s, l) => s + l.viewsTrend[i], 0)
  );

  // 排行榜（按 perfScore 降序前 3）
  const topListings = [...listingStats]
    .sort((a, b) => b.perfScore - a.perfScore)
    .slice(0, 3)
    .map(l => l.id);

  return NextResponse.json({
    overview: {
      totalViews7d, totalViews30d, totalFavorites, totalApps, totalApproved,
      activeListings: activeCount,
      pendingApplications: pendingApps,
      estimatedMonthlyRevenue,
      // 30d 申請 ÷ 30d 瀏覽：時間維度一致，避免全時期申請稀釋比率
      overallConvRate: totalViews30d > 0
        ? ((totalApps30d / totalViews30d) * 100).toFixed(1) : '0.0',
    },
    trend: { days: days14, views: globalTrend },
    topListings,
    listings: listingStats,
  }, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  });
}
