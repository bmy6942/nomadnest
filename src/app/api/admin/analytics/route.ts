/**
 * GET /api/admin/analytics
 * 平台用戶行為分析（Admin 專屬）
 *
 * 回傳：
 * - dailyRegistrations: 過去 30 天每日新增用戶
 * - dailyListings:      過去 30 天每日新增房源
 * - cityDistribution:   城市房源分布（Top 10）
 * - typeDistribution:   房源類型分布
 * - applicationFunnel:  申請狀態漏斗
 * - searchKeywords:     熱門搜尋城市（SavedSearch）
 * - retentionMetrics:   用戶活躍度指標
 * - peakActivity:       每小時申請量分布（UTC+8）
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now    = new Date();
  const d30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const d7ago  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

  // ── 1. 過去 30 天每日新增用戶 & 房源 ────────────────────────────────────────
  const days30: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days30.push(d.toISOString().slice(0, 10));
  }

  const [allRecentUsers, allRecentListings] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: d30ago } },
      select: { createdAt: true },
    }),
    prisma.listing.findMany({
      where: { createdAt: { gte: d30ago } },
      select: { createdAt: true },
    }),
  ]);

  const usersByDay: Record<string, number> = {};
  const listingsByDay: Record<string, number> = {};
  for (const day of days30) { usersByDay[day] = 0; listingsByDay[day] = 0; }
  for (const u of allRecentUsers) {
    const key = u.createdAt.toISOString().slice(0, 10);
    if (key in usersByDay) usersByDay[key]++;
  }
  for (const l of allRecentListings) {
    const key = l.createdAt.toISOString().slice(0, 10);
    if (key in listingsByDay) listingsByDay[key]++;
  }

  const dailyRegistrations = days30.map(day => ({
    date:  day.slice(5), // 'MM-DD'
    users: usersByDay[day],
    listings: listingsByDay[day],
  }));

  // ── 2. 城市分布（Top 10）────────────────────────────────────────────────────
  const cityGroups = await prisma.listing.groupBy({
    by: ['city'],
    _count: { city: true },
    orderBy: { _count: { city: 'desc' } },
    take: 10,
  });
  const cityDistribution = cityGroups.map(g => ({
    city: g.city, count: g._count.city,
  }));

  // ── 3. 房源類型分布 ─────────────────────────────────────────────────────────
  const typeGroups = await prisma.listing.groupBy({
    by: ['type'],
    _count: { type: true },
    orderBy: { _count: { type: 'desc' } },
  });
  const typeDistribution = typeGroups.map(g => ({
    type: g.type, count: g._count.type,
  }));

  // ── 4. 申請狀態漏斗 ─────────────────────────────────────────────────────────
  const [
    totalApps, pendingApps, reviewedApps, approvedApps, rejectedApps, withdrawnApps
  ] = await Promise.all([
    prisma.application.count(),
    prisma.application.count({ where: { status: 'pending' } }),
    prisma.application.count({ where: { status: { in: ['approved', 'rejected'] } } }),
    prisma.application.count({ where: { status: 'approved' } }),
    prisma.application.count({ where: { status: 'rejected' } }),
    prisma.application.count({ where: { status: 'withdrawn' } }),
  ]);
  const applicationFunnel = {
    total: totalApps,
    pending: pendingApps,
    reviewed: reviewedApps,
    approved: approvedApps,
    rejected: rejectedApps,
    withdrawn: withdrawnApps,
    approvalRate: totalApps > 0 ? ((approvedApps / totalApps) * 100).toFixed(1) : '0.0',
  };

  // ── 5. 熱門搜尋城市（SavedSearch）──────────────────────────────────────────
  const savedSearches = await prisma.savedSearch.findMany({
    select: { city: true, type: true },
  });
  const searchCityCounts: Record<string, number> = {};
  const searchTypeCounts: Record<string, number> = {};
  for (const ss of savedSearches) {
    if (ss.city) searchCityCounts[ss.city] = (searchCityCounts[ss.city] || 0) + 1;
    if (ss.type) searchTypeCounts[ss.type] = (searchTypeCounts[ss.type] || 0) + 1;
  }
  const searchKeywords = {
    cities: Object.entries(searchCityCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([city, count]) => ({ city, count })),
    types: Object.entries(searchTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count })),
  };

  // ── 6. 用戶活躍度指標 ───────────────────────────────────────────────────────
  const [
    activeUsers7d, usersWithFavorites, usersWithApplications,
    totalUsers, avgFavoritesResult,
  ] = await Promise.all([
    // 過去 7 天有新增申請或收藏的用戶數（活躍用戶代理指標）
    prisma.user.count({
      where: {
        OR: [
          { applications: { some: { createdAt: { gte: d7ago } } } },
          { favorites:    { some: { createdAt: { gte: d7ago } } } },
        ],
      },
    }),
    prisma.user.count({ where: { favorites:    { some: {} } } }),
    prisma.user.count({ where: { applications: { some: {} } } }),
    prisma.user.count(),
    prisma.favorite.aggregate({ _count: { id: true } }),
  ]);

  const retentionMetrics = {
    activeUsers7d,
    usersWithFavorites,
    usersWithApplications,
    totalUsers,
    engagementRate: totalUsers > 0
      ? ((usersWithApplications / totalUsers) * 100).toFixed(1) : '0.0',
    avgFavoritesPerUser: totalUsers > 0
      ? (avgFavoritesResult._count.id / totalUsers).toFixed(1) : '0.0',
  };

  // ── 7. 高峰申請時段（近 30 天，UTC+8 每小時分布）──────────────────────────
  const recentApps = await prisma.application.findMany({
    where: { createdAt: { gte: d30ago } },
    select: { createdAt: true },
  });
  const hourBuckets = new Array(24).fill(0);
  for (const a of recentApps) {
    const utc8Hour = (a.createdAt.getUTCHours() + 8) % 24;
    hourBuckets[utc8Hour]++;
  }
  const peakActivity = hourBuckets.map((count, hour) => ({ hour, count }));

  return NextResponse.json({
    dailyRegistrations,
    cityDistribution,
    typeDistribution,
    applicationFunnel,
    searchKeywords,
    retentionMetrics,
    peakActivity,
  }, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
