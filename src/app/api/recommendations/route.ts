import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// ── 推薦理由標籤（回傳給前端顯示「為什麼推薦你這個」）────────────────────
export type RecommendationReason =
  | 'favorite_city'      // 你收藏過這個城市的房源
  | 'favorite_type'      // 你收藏過這種類型
  | 'price_match'        // 符合你的預算
  | 'wifi_match'         // 符合你的 Wi-Fi 要求
  | 'search_history'     // 根據你的搜尋紀錄
  | 'trending'           // 熱門房源（新用戶 fallback）
  | 'high_rating';       // 高評分

export interface RecommendedListing {
  id: string;
  title: string;
  city: string;
  district: string;
  type: string;
  price: number;
  minRent: number;
  wifiSpeed: number;
  wifiVerified: boolean;
  hasDesk: boolean;
  foreignOk: boolean;
  images: string[];
  avgRating: string | null;
  reviewCount: number;
  includedFees: string[];
  availableFrom: string | null;
  owner: { name: string; verified: boolean };
  reasons: RecommendationReason[];   // 推薦理由（可多個）
  score: number;
}

// ── 偏好輪廓 ──────────────────────────────────────────────────────────────
interface PreferenceProfile {
  cities:   Record<string, number>;  // city  → 加權分數
  types:    Record<string, number>;  // type  → 加權分數
  prices:   number[];                // 收藏/瀏覽過的房源價格
  minWifi:  number;                  // 搜尋時要求的最低 Wi-Fi
  hasDesk:  boolean | null;
  favIds:   Set<string>;             // 已收藏 ID（排除）
  viewIds:  Set<string>;             // 最近已看過 ID（降權）
  hasFavData:   boolean;
  hasSearchData: boolean;
}

function incrementMap(map: Record<string, number>, key: string, by = 1) {
  map[key] = (map[key] ?? 0) + by;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '8'), 20);

  // ── 未登入用戶：回傳熱門高評分房源 ──────────────────────────────────────
  if (!user) {
    const trending = await prisma.listing.findMany({
      where: { status: 'active' },
      select: {
        id: true, title: true, city: true, district: true, type: true,
        price: true, minRent: true, wifiSpeed: true, wifiVerified: true,
        hasDesk: true, foreignOk: true, images: true, availableFrom: true,
        includedFees: true,
        owner: { select: { name: true, verified: true } },
        reviews: { select: { rating: true } },
        _count: { select: { favorites: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    const scored = trending
      .map(l => {
        const avgR = l.reviews.length
          ? l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length : 0;
        return { ...l, _score: avgR * 10 + l._count.favorites * 2 };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, limit);

    return NextResponse.json({
      listings: scored.map(l => ({
        ...l,
        images: (() => { try { return JSON.parse(l.images); } catch { return []; } })(),
        includedFees: (() => { try { return JSON.parse(l.includedFees); } catch { return []; } })(),
        avgRating: l.reviews.length
          ? (l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length).toFixed(1)
          : null,
        reviewCount: l.reviews.length,
        reasons: ['trending'] as RecommendationReason[],
        score: l._score,
      })),
      profile: null,
    });
  }

  // ── 已登入：建立偏好輪廓 ────────────────────────────────────────────────
  const [favorites, views, searches] = await Promise.all([
    // 最近 30 筆收藏
    prisma.favorite.findMany({
      where: { userId: user.id },
      include: { listing: { select: { id: true, city: true, type: true, price: true, wifiSpeed: true, hasDesk: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    // 最近 50 筆瀏覽
    prisma.listingView.findMany({
      where: { visitorId: user.id },
      include: { listing: { select: { id: true, city: true, type: true, price: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    // 所有儲存搜尋
    prisma.savedSearch.findMany({
      where: { userId: user.id },
    }),
  ]);

  const profile: PreferenceProfile = {
    cities:   {},
    types:    {},
    prices:   [],
    minWifi:  0,
    hasDesk:  null,
    favIds:   new Set(favorites.map(f => f.listingId)),
    viewIds:  new Set(views.map(v => v.listingId)),
    hasFavData:   favorites.length > 0,
    hasSearchData: searches.length > 0,
  };

  // 收藏 → 加重 3 倍
  for (const fav of favorites) {
    const l = fav.listing;
    if (!l) continue;
    incrementMap(profile.cities, l.city, 3);
    incrementMap(profile.types,  l.type,  3);
    profile.prices.push(l.price);
    if (l.hasDesk) profile.hasDesk = true;
  }

  // 瀏覽 → 加重 1 倍
  for (const v of views) {
    const l = v.listing;
    if (!l) continue;
    incrementMap(profile.cities, l.city, 1);
    incrementMap(profile.types,  l.type,  1);
    profile.prices.push(l.price);
  }

  // 儲存搜尋 → 補充城市偏好、Wi-Fi 下限
  for (const s of searches) {
    if (s.city) incrementMap(profile.cities, s.city, 2);
    if (s.type) incrementMap(profile.types,  s.type, 2);
    if (s.minWifi && s.minWifi > profile.minWifi) profile.minWifi = s.minWifi;
    if (s.maxPrice) profile.prices.push(s.maxPrice);
  }

  // 計算偏好價格中心 & 範圍（±35%）
  const avgPrice = profile.prices.length
    ? profile.prices.reduce((a, b) => a + b, 0) / profile.prices.length : 0;
  const priceMin = avgPrice * 0.65;
  const priceMax = avgPrice * 1.35;

  // 找出最強偏好的城市 & 類型（用於 reason tag）
  const topCity = Object.entries(profile.cities).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topType = Object.entries(profile.types).sort((a, b)  => b[1] - a[1])[0]?.[0];

  // ── 拉候選房源（status:active，排除已收藏）───────────────────────────────
  const candidates = await prisma.listing.findMany({
    where: {
      status: 'active',
      id: { notIn: [...profile.favIds].slice(0, 500) }, // SQLite 最多 500 個 IN 參數
    },
    select: {
      id: true, title: true, city: true, district: true, type: true,
      price: true, minRent: true, wifiSpeed: true, wifiVerified: true,
      hasDesk: true, foreignOk: true, images: true, availableFrom: true,
      includedFees: true,
      owner: { select: { name: true, verified: true } },
      reviews: { select: { rating: true } },
    },
    take: 200,
    orderBy: { createdAt: 'desc' },
  });

  // ── 評分函式 ──────────────────────────────────────────────────────────────
  const scoreAndReason = (l: typeof candidates[0]): { score: number; reasons: RecommendationReason[] } => {
    let score = 0;
    const reasons: RecommendationReason[] = [];

    const hasHistory = profile.hasFavData || profile.hasSearchData;

    // 城市偏好（最高 30 分）
    if (profile.cities[l.city]) {
      const cityW = profile.cities[l.city];
      const maxCityW = Math.max(...Object.values(profile.cities));
      score += (cityW / maxCityW) * 30;
      if (l.city === topCity) reasons.push('favorite_city');
    }

    // 類型偏好（最高 20 分）
    if (profile.types[l.type]) {
      const typeW = profile.types[l.type];
      const maxTypeW = Math.max(...Object.values(profile.types));
      score += (typeW / maxTypeW) * 20;
      if (l.type === topType) reasons.push('favorite_type');
    }

    // 搜尋歷史（城市+類型都符合加分）
    if (profile.hasSearchData && profile.cities[l.city] && profile.types[l.type]) {
      score += 5;
      if (!reasons.includes('favorite_city') && !reasons.includes('favorite_type')) {
        reasons.push('search_history');
      }
    }

    // 價格符合（最高 15 分）
    if (avgPrice > 0) {
      const diff = Math.abs(l.price - avgPrice);
      const rangeFraction = Math.max(0, 1 - diff / (avgPrice * 0.5));
      score += rangeFraction * 15;
      if (l.price >= priceMin && l.price <= priceMax) reasons.push('price_match');
    }

    // Wi-Fi 符合（最高 10 分）
    if (profile.minWifi > 0 && l.wifiSpeed >= profile.minWifi) {
      score += 10;
      reasons.push('wifi_match');
    } else if (l.wifiSpeed >= 50) {
      score += 5; // 高速 Wi-Fi 加分
    }

    // 書桌偏好（5 分）
    if (profile.hasDesk && l.hasDesk) score += 5;

    // 評分加分（最高 10 分）
    const avgR = l.reviews.length
      ? l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length : 0;
    score += avgR * 2;
    if (avgR >= 4.5) reasons.push('high_rating');

    // 最近看過的房源降權（避免重複曝光）
    if (profile.viewIds.has(l.id)) score *= 0.4;

    // 無偏好歷史：純熱門邏輯
    if (!hasHistory) reasons.push('trending');

    return { score, reasons };
  };

  // ── 評分 + 排序 ────────────────────────────────────────────────────────
  const scored = candidates
    .map(l => {
      const { score, reasons } = scoreAndReason(l);
      const avgR = l.reviews.length
        ? l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length : null;
      return {
        id: l.id, title: l.title, city: l.city, district: l.district,
        type: l.type, price: l.price, minRent: l.minRent,
        wifiSpeed: l.wifiSpeed, wifiVerified: l.wifiVerified,
        hasDesk: l.hasDesk, foreignOk: l.foreignOk,
        availableFrom: l.availableFrom,
        images: (() => { try { return JSON.parse(l.images); } catch { return [] as string[]; } })(),
        includedFees: (() => { try { return JSON.parse(l.includedFees); } catch { return [] as string[]; } })(),
        avgRating: avgR !== null ? avgR.toFixed(1) : null,
        reviewCount: l.reviews.length,
        owner: l.owner,
        reasons,
        score,
      } satisfies RecommendedListing;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // 回傳偏好摘要（前端用於顯示「根據你的 X 推薦」）
  const profileSummary = {
    topCity,
    topType,
    avgPrice: Math.round(avgPrice),
    favCount:  favorites.length,
    viewCount: views.length,
  };

  return NextResponse.json(
    { listings: scored, profile: profileSummary },
    { headers: { 'Cache-Control': 'private, max-age=60' } }
  );
}
