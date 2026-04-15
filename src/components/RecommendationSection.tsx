'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RecommendedListing, RecommendationReason } from '@/app/api/recommendations/route';

// ── 推薦理由標籤設定 ──────────────────────────────────────────────────────
const REASON_CONFIG: Record<RecommendationReason, { label: string; color: string; emoji: string }> = {
  favorite_city:  { label: '你喜歡的城市', color: 'bg-blue-50 text-blue-700',   emoji: '📍' },
  favorite_type:  { label: '你喜歡的房型', color: 'bg-purple-50 text-purple-700', emoji: '🏠' },
  price_match:    { label: '符合你的預算', color: 'bg-green-50 text-green-700',   emoji: '💰' },
  wifi_match:     { label: '符合 Wi-Fi 需求', color: 'bg-cyan-50 text-cyan-700', emoji: '⚡' },
  search_history: { label: '根據搜尋紀錄', color: 'bg-amber-50 text-amber-700',  emoji: '🔍' },
  trending:       { label: '熱門推薦',       color: 'bg-rose-50 text-rose-700',   emoji: '🔥' },
  high_rating:    { label: '高評分房源',     color: 'bg-yellow-50 text-yellow-700', emoji: '⭐' },
};

// ── 房源卡片（輕量版，避免重複引入 ListingCard 的收藏 fetch 邏輯）────────
function RecommendCard({ listing }: { listing: RecommendedListing }) {
  const img = listing.images[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400';
  const topReason = listing.reasons[0];
  const cfg = topReason ? REASON_CONFIG[topReason] : null;

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-200"
    >
      {/* 圖片 */}
      <div className="relative overflow-hidden h-44 bg-gray-100">
        <img
          src={img}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {/* 推薦理由 badge */}
        {cfg && (
          <span className={`absolute top-2 left-2 text-xs font-semibold px-2 py-1 rounded-full backdrop-blur-sm ${cfg.color}`}>
            {cfg.emoji} {cfg.label}
          </span>
        )}
        {/* 評分 badge */}
        {listing.avgRating && (
          <span className="absolute top-2 right-2 bg-white/90 text-gray-800 text-xs font-bold px-2 py-1 rounded-full shadow-sm">
            ⭐ {listing.avgRating}
            <span className="font-normal text-gray-500 ml-0.5">({listing.reviewCount})</span>
          </span>
        )}
      </div>

      {/* 內容 */}
      <div className="p-3.5">
        {/* 標題 */}
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-1.5 group-hover:text-blue-700 transition-colors">
          {listing.title}
        </h3>

        {/* 位置 + 房型 */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
          <span>📍 {listing.city}{listing.district}</span>
          <span className="text-gray-300">·</span>
          <span>{listing.type}</span>
        </div>

        {/* 標籤列 */}
        <div className="flex flex-wrap gap-1 mb-2.5">
          {listing.wifiVerified && (
            <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded-md font-medium">
              ⚡ {listing.wifiSpeed}M 認證
            </span>
          )}
          {listing.hasDesk && (
            <span className="text-xs bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded-md">🖥 有書桌</span>
          )}
          {listing.foreignOk && (
            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">🌏 外籍友善</span>
          )}
          {listing.owner.verified && (
            <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md">✓ 已驗證房東</span>
          )}
        </div>

        {/* 價格 + 租期 */}
        <div className="flex items-end justify-between">
          <div>
            <span className="text-lg font-bold text-nomad-navy">NT${listing.price.toLocaleString()}</span>
            <span className="text-xs text-gray-400 ml-1">/月</span>
          </div>
          <span className="text-xs text-gray-400">最短 {listing.minRent} 個月</span>
        </div>
      </div>
    </Link>
  );
}

// ── 骨架載入 ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
      <div className="h-44 bg-gray-200" />
      <div className="p-3.5 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="flex gap-1">
          <div className="h-5 bg-gray-100 rounded-md w-16" />
          <div className="h-5 bg-gray-100 rounded-md w-14" />
        </div>
        <div className="h-6 bg-gray-200 rounded w-1/3 mt-1" />
      </div>
    </div>
  );
}

// ── 偏好標籤（顯示「根據你的 X 推薦」）──────────────────────────────────
interface ProfileSummary {
  topCity?: string;
  topType?: string;
  avgPrice?: number;
  favCount: number;
  viewCount: number;
}

function ProfileTags({ profile }: { profile: ProfileSummary }) {
  const tags: string[] = [];
  if (profile.topCity) tags.push(`📍 ${profile.topCity}`);
  if (profile.topType) tags.push(`🏠 ${profile.topType}`);
  if (profile.avgPrice && profile.avgPrice > 0) tags.push(`💰 ~NT$${profile.avgPrice.toLocaleString()}`);
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <span className="text-xs text-gray-400">根據你的偏好：</span>
      {tags.map(tag => (
        <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {tag}
        </span>
      ))}
    </div>
  );
}

// ── 主組件 ────────────────────────────────────────────────────────────────
interface Props {
  /** 若為 true，顯示「熱門精選」標題（非登入版）；預設 false */
  showAsGuest?: boolean;
  limit?: number;
  className?: string;
}

export default function RecommendationSection({ showAsGuest = false, limit = 8, className = '' }: Props) {
  const [listings, setListings] = useState<RecommendedListing[]>([]);
  const [profile, setProfile]   = useState<ProfileSummary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/recommendations?limit=${limit}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        if (cancelled) return;
        setListings(d.listings || []);
        setProfile(d.profile ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError(true); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [limit]);

  if (error || (!loading && listings.length === 0)) return null;

  const isPersonalized = profile !== null && (profile.favCount > 0 || profile.viewCount > 0);
  const sectionTitle  = showAsGuest
    ? '🔥 熱門精選房源'
    : isPersonalized ? '✨ 為你推薦' : '🔥 熱門精選房源';

  return (
    <section className={`${className}`}>
      {/* 標題列 */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{sectionTitle}</h2>
          {isPersonalized && profile && !showAsGuest && (
            <ProfileTags profile={profile} />
          )}
        </div>
        <Link
          href="/listings"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium shrink-0 self-end sm:self-auto"
        >
          查看全部 →
        </Link>
      </div>

      {/* 卡片網格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: limit }).map((_, i) => <SkeletonCard key={i} />)
          : listings.map(l => <RecommendCard key={l.id} listing={l} />)
        }
      </div>

      {/* 個人化說明（首次使用引導）*/}
      {!loading && !isPersonalized && !showAsGuest && (
        <p className="text-center text-xs text-gray-400 mt-4">
          💡 收藏或搜尋房源後，推薦將依你的偏好個人化
        </p>
      )}
    </section>
  );
}
