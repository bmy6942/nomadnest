import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);

  // ── 核心計數 ────────────────────────────────────────────────
  const [
    totalUsers, totalListings, totalApplications, totalMessages,
    totalConversations, totalReviews, totalViewings, totalFavorites,
    newUsersThisMonth, newUsersLastMonth, newUsersThisWeek,
    activeListings, pendingListings,
    approvedApplications, pendingApplications,
    confirmedViewings,
    bannedUsers, verifiedUsers,
    avgRatingResult,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.application.count(),
    prisma.message.count(),
    prisma.conversation.count(),
    prisma.review.count(),
    prisma.viewingRequest.count(),
    prisma.favorite.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.listing.count({ where: { status: 'active' } }),
    prisma.listing.count({ where: { status: 'pending' } }),
    prisma.application.count({ where: { status: 'approved' } }),
    prisma.application.count({ where: { status: 'pending' } }),
    prisma.viewingRequest.count({ where: { status: 'confirmed' } }),
    prisma.user.count({ where: { banned: true } }),
    prisma.user.count({ where: { verified: true } }),
    prisma.review.aggregate({ _avg: { rating: true } }),
  ]);

  // ── 用戶角色分布 ────────────────────────────────────────────
  const usersByRole = await prisma.user.groupBy({
    by: ['role'],
    _count: { role: true },
  });

  // ── 每週新增用戶（過去 8 週）───────────────────────────────
  const weeklyUsers: { week: string; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const count = await prisma.user.count({
      where: { createdAt: { gte: weekStart, lt: weekEnd } },
    });
    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    weeklyUsers.push({ week: label, count });
  }

  // ── 每週新增房源（過去 8 週）───────────────────────────────
  const weeklyListings: { week: string; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const count = await prisma.listing.count({
      where: { createdAt: { gte: weekStart, lt: weekEnd } },
    });
    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    weeklyListings.push({ week: label, count });
  }

  // ── 最近 10 筆活動 ─────────────────────────────────────────
  const recentApps = await prisma.application.findMany({
    take: 5, orderBy: { createdAt: 'desc' },
    include: {
      tenant: { select: { name: true } },
      listing: { select: { title: true, city: true } },
    },
  });
  const recentUsers = await prisma.user.findMany({
    take: 5, orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json({
    totals: {
      users: totalUsers, listings: totalListings, applications: totalApplications,
      messages: totalMessages, conversations: totalConversations,
      reviews: totalReviews, viewings: totalViewings, favorites: totalFavorites,
    },
    listings: { active: activeListings, pending: pendingListings },
    applications: { approved: approvedApplications, pending: pendingApplications },
    viewings: { confirmed: confirmedViewings },
    users: {
      new: { thisMonth: newUsersThisMonth, lastMonth: newUsersLastMonth, thisWeek: newUsersThisWeek },
      banned: bannedUsers, verified: verifiedUsers,
      byRole: usersByRole.reduce((acc, r) => ({ ...acc, [r.role]: r._count.role }), {} as Record<string, number>),
    },
    avgRating: avgRatingResult._avg.rating ?? 0,
    trends: { weeklyUsers, weeklyListings },
    recent: { applications: recentApps, users: recentUsers },
  });
}
