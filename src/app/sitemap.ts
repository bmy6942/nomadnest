import { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nomadnest.tw';

// 網站上線日（靜態頁用固定日期，避免每次 build 都標記「剛更新」浪費爬蟲預算）
const SITE_LAUNCH = new Date('2025-01-01');
const CONTENT_REFRESH = new Date('2026-04-15'); // 最近一次大改版日期

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  // ── 1. 靜態核心頁面 ──────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: CONTENT_REFRESH,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/listings`,
      lastModified: CONTENT_REFRESH,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/for-landlords`,
      lastModified: CONTENT_REFRESH,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: CONTENT_REFRESH,
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: CONTENT_REFRESH,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/auth/register`,
      lastModified: SITE_LAUNCH,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: SITE_LAUNCH,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: SITE_LAUNCH,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];

  // ── 2. 城市篩選頁（台灣主要城市，對應首頁城市快捷按鈕）──────
  const cities = ['台北市', '新北市', '台中市', '高雄市', '台南市', '花蓮縣', '桃園市'];
  const cityRoutes: MetadataRoute.Sitemap = cities.map(city => ({
    url: `${BASE_URL}/listings?city=${encodeURIComponent(city)}`,
    lastModified: CONTENT_REFRESH,
    changeFrequency: 'daily' as const,
    priority: 0.85,
  }));

  // ── 3. 房型篩選頁（游牧工作者最常搜尋的房型關鍵字）──────────
  const types = ['套房', '雅房', '整層公寓', '共居空間'];
  const typeRoutes: MetadataRoute.Sitemap = types.map(type => ({
    url: `${BASE_URL}/listings?type=${encodeURIComponent(type)}`,
    lastModified: CONTENT_REFRESH,
    changeFrequency: 'daily' as const,
    priority: 0.80,
  }));

  // ── 4. 城市 × 房型組合頁（長尾關鍵字主要流量來源）───────────
  //    只收錄主要城市 × 主要房型（4 × 3 = 12 條目），避免 sitemap 過大
  const mainCities = ['台北市', '新北市', '台中市', '高雄市'];
  const mainTypes  = ['套房', '整層公寓', '共居空間'];
  const comboRoutes: MetadataRoute.Sitemap = mainCities.flatMap(city =>
    mainTypes.map(type => ({
      url: `${BASE_URL}/listings?city=${encodeURIComponent(city)}&type=${encodeURIComponent(type)}`,
      lastModified: CONTENT_REFRESH,
      changeFrequency: 'weekly' as const,
      priority: 0.75,
    }))
  );

  // ── 5. 特色篩選頁（外籍友善、Wi-Fi 驗證）────────────────────
  const featureRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/listings?foreignOk=true`,
      lastModified: CONTENT_REFRESH,
      changeFrequency: 'weekly',
      priority: 0.75,
    },
    {
      url: `${BASE_URL}/listings?hasDesk=true`,
      lastModified: CONTENT_REFRESH,
      changeFrequency: 'weekly',
      priority: 0.70,
    },
    {
      url: `${BASE_URL}/listings?minWifi=100`,
      lastModified: CONTENT_REFRESH,
      changeFrequency: 'weekly',
      priority: 0.70,
    },
  ];

  // ── 6. 動態房源頁面（priority 依評價數動態調整）──────────────
  let listingRoutes: MetadataRoute.Sitemap = [];
  try {
    const listings = await prisma.listing.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        updatedAt: true,
        _count: { select: { reviews: true, favorites: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5000, // 合理上限
    });

    listingRoutes = listings.map(l => {
      // 根據互動程度動態調整 priority（0.60 ~ 0.90）
      const engagement = l._count.reviews * 3 + l._count.favorites;
      const priority = engagement >= 20 ? 0.90
        : engagement >= 10 ? 0.85
        : engagement >= 5  ? 0.80
        : engagement >= 1  ? 0.72
        : 0.65;

      return {
        url: `${BASE_URL}/listings/${l.id}`,
        lastModified: l.updatedAt,
        changeFrequency: 'weekly' as const,
        priority,
      };
    });
  } catch { /* build 時 DB 可能不可用，靜默失敗 */ }

  // ── 7. 房東公開頁面（已上架房源的房東才收錄）────────────────
  let landlordRoutes: MetadataRoute.Sitemap = [];
  try {
    // 只收錄有上架房源的房東，避免空白頁面被索引
    const activeLandlordIds = await prisma.listing.findMany({
      where: { status: 'active' },
      select: { ownerId: true },
      distinct: ['ownerId'],
    });
    const idSet = Array.from(new Set(activeLandlordIds.map(l => l.ownerId)));

    const landlords = await prisma.user.findMany({
      where: {
        id: { in: idSet },
        role: { in: ['landlord', 'admin'] },
      },
      select: { id: true, updatedAt: true },
    });

    landlordRoutes = landlords.map(u => ({
      url: `${BASE_URL}/landlords/${u.id}`,
      lastModified: u.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.55,
    }));
  } catch { /* 靜默失敗 */ }

  return [
    ...staticRoutes,
    ...cityRoutes,
    ...typeRoutes,
    ...comboRoutes,
    ...featureRoutes,
    ...listingRoutes,
    ...landlordRoutes,
  ];
}
