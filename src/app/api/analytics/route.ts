import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'landlord' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 取得此房東所有房源
    const listings = await prisma.listing.findMany({
      where: { ownerId: user.id },
      select: {
        id: true, title: true, city: true, district: true, type: true,
        price: true, status: true, images: true, createdAt: true,
        _count: {
          select: {
            applications: true,
            favorites: true,
            reviews: true,
            conversations: true,
            viewingRequests: true,
            views: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (listings.length === 0) {
      return NextResponse.json({
        summary: { totalViews: 0, totalApps: 0, totalFavs: 0, activeListings: 0, totalListings: 0 },
        listings: [],
      });
    }

    const listingIds = listings.map(l => l.id);

    // ── UTC 時間邊界（避免因本地時區造成日期桶偏移）─────────────────────
    const nowUtc = new Date();
    const todayUtc = new Date(Date.UTC(
      nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate()
    ));
    const d7ago  = new Date(todayUtc.getTime() -  7 * 24 * 60 * 60 * 1000);
    const d30ago = new Date(todayUtc.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── 一次批次取得所有資料（取代原本 N×14 串行查詢）──────────────────
    // 原始問題：每間房源在 Promise.all 內啟動 IIFE，IIFE 內 for 迴圈
    //           用 await prisma.listingView.count() 跑 14 次串行查詢，
    //           N 間房源 = N × 14 次串行 DB 呼叫；現改為 3 次批次查詢。
    const [
      views30dRaw,       // 近 30 天所有瀏覽（含 listingId + createdAt，用於 7d/30d 計數與 14d 日趨勢）
      apps30dRaw,        // 近 30 天所有申請（含 listingId + createdAt，用於 period 統計）
      allAppsStatus,     // 全時期申請依 status 分組（用於 approvedApps / pendingApps 全時期計數）
      ratingsRaw,        // 各房源平均評分
    ] = await Promise.all([
      prisma.listingView.findMany({
        where:  { listingId: { in: listingIds }, createdAt: { gte: d30ago } },
        select: { listingId: true, createdAt: true },
      }),
      prisma.application.findMany({
        where:  { listingId: { in: listingIds }, createdAt: { gte: d30ago } },
        select: { listingId: true, createdAt: true },
      }),
      prisma.application.groupBy({
        by:    ['listingId', 'status'],
        where: { listingId: { in: listingIds } },
        _count: { id: true },
      }),
      prisma.review.groupBy({
        by:    ['listingId'],
        where: { listingId: { in: listingIds } },
        _avg:  { rating: true },
      }),
    ]);

    // ── 建立 14 天 UTC 日期標籤與時間邊界陣列 ──────────────────────────
    const days14: { label: string; start: Date; end: Date }[] = [];
    for (let i = 13; i >= 0; i--) {
      const start = new Date(todayUtc.getTime() - i * 24 * 60 * 60 * 1000);
      const end   = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      days14.push({
        label: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`,
        start,
        end,
      });
    }

    // ── 建立 helper Map ─────────────────────────────────────────────────
    const ratingMap = new Map(ratingsRaw.map(r => [r.listingId, r._avg.rating ?? 0]));

    // views30dRaw 按 listingId 分組
    const viewsByListing = new Map<string, Date[]>();
    for (const v of views30dRaw) {
      const arr = viewsByListing.get(v.listingId) ?? [];
      arr.push(v.createdAt);
      viewsByListing.set(v.listingId, arr);
    }

    // apps30dRaw 按 listingId 分組
    const appsByListing = new Map<string, Date[]>();
    for (const a of apps30dRaw) {
      const arr = appsByListing.get(a.listingId) ?? [];
      arr.push(a.createdAt);
      appsByListing.set(a.listingId, arr);
    }

    // allAppsStatus 按 listingId → { status → count }
    const appStatusMap = new Map<string, Record<string, number>>();
    for (const row of allAppsStatus) {
      const statusMap = appStatusMap.get(row.listingId) ?? {};
      statusMap[row.status] = row._count.id;
      appStatusMap.set(row.listingId, statusMap);
    }

    // ── 逐房源計算統計（純 JS，零額外 DB 查詢）─────────────────────────
    const analytics = listings.map(l => {
      const lViews = viewsByListing.get(l.id) ?? [];
      const lApps  = appsByListing.get(l.id)  ?? [];
      const lStatus = appStatusMap.get(l.id)  ?? {};

      const views7d  = lViews.filter(d => d >= d7ago).length;
      const views30d = lViews.length; // 已由 where >= d30ago 篩選，等於全部
      const apps7d   = lApps.filter(d => d >= d7ago).length;
      const apps30d  = lApps.length;

      // 全時期申請狀態（保留原始語意：全時期 approved / pending）
      const approvedApps = lStatus['approved'] ?? 0;
      const pendingApps  = lStatus['pending']  ?? 0;

      // 14 天每日瀏覽（UTC 午夜邊界，與 days14 陣列對齊）
      const dailyViews = days14.map(({ label, start, end }) => ({
        date:  label,
        count: lViews.filter(d => d >= start && d < end).length,
      }));

      const conversionRate = views30d > 0
        ? ((apps30d  / views30d) * 100).toFixed(1) : '0.0';
      const favoriteRate = l._count.views > 0
        ? ((l._count.favorites / l._count.views) * 100).toFixed(1) : '0.0';

      return {
        id: l.id, title: l.title, city: l.city, district: l.district,
        type: l.type, price: l.price, status: l.status, images: l.images,
        createdAt: l.createdAt,
        totals: {
          views: l._count.views,
          applications: l._count.applications,
          favorites: l._count.favorites,
          reviews: l._count.reviews,
          conversations: l._count.conversations,
          viewings: l._count.viewingRequests,
        },
        period: { views7d, views30d, apps7d, apps30d },
        rates: { conversionRate, favoriteRate },
        approvedApps, pendingApps,
        avgRating: ratingMap.get(l.id) ?? 0,
        dailyViews,
      };
    });

    // ── 整體摘要 ─────────────────────────────────────────────────────────
    const totalViews  = analytics.reduce((s, a) => s + a.totals.views, 0);
    const totalApps   = analytics.reduce((s, a) => s + a.totals.applications, 0);
    const totalFavs   = analytics.reduce((s, a) => s + a.totals.favorites, 0);
    const activeCount = listings.filter(l => l.status === 'active').length;

    return NextResponse.json({
      summary: { totalViews, totalApps, totalFavs, activeListings: activeCount, totalListings: listings.length },
      listings: analytics,
    });
  } catch (err) {
    console.error('[analytics] GET error:', err);
    return NextResponse.json({ error: '伺服器錯誤，請稍後再試' }, { status: 500 });
  }
}
