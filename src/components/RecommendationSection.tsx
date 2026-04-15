'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import type { RecommendedListing, RecommendationReason } from '@/app/api/recommendations/route';

// ── 推薦理由標籤設定 ──────────────────────────────────────────────────────
const REASON_CONFIG: Record<RecommendationReason, { label: string; color: string; emoji: string }> = {
  favorite_city:  { label: '你喜歡的城市', color: 'bg-blue-100 text-blue-700 border-blue-200',     emoji: '📍' },
  favorite_type:  { label: '你喜歡的房型', color: 'bg-purple-100 text-purple-700 border-purple-200', emoji: '🏠' },
  price_match:    { label: '符合預算',     color: 'bg-green-100 text-green-700 border-green-200',   emoji: '💰' },
  wifi_match:     { label: 'Wi-Fi 符合',   color: 'bg-cyan-100 text-cyan-700 border-cyan-200',      emoji: '⚡' },
  search_history: { label: '搜尋紀錄',     color: 'bg-amber-100 text-amber-700 border-amber-200',   emoji: '🔍' },
  trending:       { label: '熱門推薦',     color: 'bg-rose-100 text-rose-700 border-rose-200',      emoji: '🔥' },
  high_rating:    { label: '高評分',       color: 'bg-yellow-100 text-yellow-700 border-yellow-200', emoji: '⭐' },
};

// ── Wi-Fi 速度顏色 ────────────────────────────────────────────────────────
function wifiBadgeClass(speed: number) {
  if (speed >= 300) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (speed >= 100) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (speed >= 50)  return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
}

// ── 591 風格房源卡片 ───────────────────────────────────────────────────────
function RecommendCard({ listing }: { listing: RecommendedListing }) {
  const img = listing.images[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600';
  const topReason = listing.reasons[0];
  const cfg = topReason ? REASON_CONFIG[topReason] : null;

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex-shrink-0 w-64 sm:w-auto bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all duration-200 flex flex-col"
    >
      {/* ── 圖片區 (16:10 比例) ── */}
      <div className="relative overflow-hidden bg-gray-100" style={{ aspectRatio: '16/10' }}>
        <img
          src={img}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {/* 房型 badge */}
        <span className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded backdrop-blur-sm">
          {listing.type}
        </span>
        {/* 評分 badge */}
        {listing.avgRating && (
          <span className="absolute top-2 right-2 bg-white/90 text-gray-800 text-[11px] font-bold px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
            ⭐ {listing.avgRating}
            <span className="font-normal text-gray-400">({listing.reviewCount})</span>
          </span>
        )}
        {/* 推薦理由 badge */}
        {cfg && (
          <span className={`absolute top-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${cfg.color}`}>
            {cfg.emoji} {cfg.label}
          </span>
        )}
      </div>

      {/* ── 資訊區 ── */}
      <div className="p-3 flex flex-col flex-1 gap-1.5">

        {/* 價格（放最上方，模仿591設計邏輯） */}
        <div className="flex items-baseline gap-1">
          <span className="text-blue-600 font-bold text-lg leading-none">NT${listing.price.toLocaleString()}</span>
          <span className="text-gray-400 text-xs">/月</span>
          <span className="ml-auto text-gray-400 text-[11px]">最短 {listing.minRent} 月</span>
        </div>

        {/* 標題 */}
        <h3 className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
          {listing.title}
        </h3>

        {/* 位置 */}
        <p className="text-gray-500 text-xs flex items-center gap-1">
          <span>📍</span>
          <span>{listing.city} {listing.district}</span>
        </p>

        {/* 標籤列 */}
        <div className="flex flex-wrap gap-1 mt-auto pt-1 border-t border-gray-100">
          {listing.wifiVerified && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${wifiBadgeClass(listing.wifiSpeed)}`}>
              ⚡ {listing.wifiSpeed}M
            </span>
          )}
          {listing.hasDesk && (
            <span className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">🖥 書桌</span>
          )}
          {listing.foreignOk && (
            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-200">🌏 外籍</span>
          )}
          {listing.owner.verified && (
            <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200">✓ 驗證房東</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── 骨架載入 ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-64 sm:w-auto bg-white rounded-xl overflow-hidden border border-gray-200 animate-pulse flex flex-col">
      <div className="bg-gray-200" style={{ aspectRatio: '16/10' }} />
      <div className="p-3 space-y-2">
        <div className="h-5 bg-gray-200 rounded w-2/5" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="flex gap-1 pt-1">
          <div className="h-4 bg-gray-100 rounded w-10" />
          <div className="h-4 bg-gray-100 rounded w-10" />
        </div>
      </div>
    </div>
  );
}

// ── 偏好標籤 ─────────────────────────────────────────────────────────────
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
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      <span className="text-xs text-gray-400">根據你的偏好：</span>
      {tags.map(tag => (
        <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
          {tag}
        </span>
      ))}
    </div>
  );
}

// ── 主組件 ────────────────────────────────────────────────────────────────
interface Props {
  showAsGuest?: boolean;
  limit?: number;
  className?: string;
}

export default function RecommendationSection({ showAsGuest = false, limit = 8, className = '' }: Props) {
  const [listings, setListings] = useState<RecommendedListing[]>([]);
  const [profile, setProfile]   = useState<ProfileSummary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
  const sectionTitle   = showAsGuest
    ? '🔥 熱門精選房源'
    : isPersonalized ? '✨ 為你推薦' : '🔥 熱門精選房源';

  // 捲動按鈕
  const scrollBy = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'right' ? 280 : -280, behavior: 'smooth' });
  };

  const skeletonCount = Math.min(limit, 4);

  return (
    <section className={`${className}`}>
      {/* ── 標題列 ── */}
      <div className="flex items-end justify-between mb-4 px-1">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{sectionTitle}</h2>
          {isPersonalized && profile && !showAsGuest && (
            <ProfileTags profile={profile} />
          )}
        </div>
        <Link
          href="/listings"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium shrink-0 flex items-center gap-0.5"
        >
          查看全部 →
        </Link>
      </div>

      {/* ── 卡片容器：手機水平滾動 / 桌機 4 欄格線 ── */}
      <div className="relative group/scroll">
        {/* 左滾動按鈕（僅在 sm+ 顯示） */}
        <button
          onClick={() => scrollBy('left')}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 bg-white shadow-md border border-gray-200 rounded-full items-center justify-center text-gray-600 hover:bg-gray-50 opacity-0 group-hover/scroll:opacity-100 transition-opacity"
          aria-label="往左"
        >
          ‹
        </button>

        {/* 卡片列表 */}
        <div
          ref={scrollRef}
          className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 overflow-x-auto pb-2 sm:overflow-visible scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {loading
            ? Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={i} />)
            : listings.map(l => <RecommendCard key={l.id} listing={l} />)
          }
        </div>

        {/* 右滾動按鈕（僅在 sm+ 顯示） */}
        <button
          onClick={() => scrollBy('right')}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 bg-white shadow-md border border-gray-200 rounded-full items-center justify-center text-gray-600 hover:bg-gray-50 opacity-0 group-hover/scroll:opacity-100 transition-opacity"
          aria-label="往右"
        >
          ›
        </button>
      </div>

      {/* 個人化引導提示 */}
      {!loading && !isPersonalized && !showAsGuest && (
        <p className="text-center text-xs text-gray-400 mt-4">
          💡 收藏或搜尋房源後，推薦將依你的偏好個人化
        </p>
      )}
    </section>
  );
}
