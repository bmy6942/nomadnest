'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useTranslations } from '@/i18n/provider';
import { wifiLabel, formatPrice, cityColor } from '@/lib/utils';
import NomadScoreBadge from '@/components/NomadScoreBadge';

interface Listing {
  id: string; title: string; city: string; district: string; type: string;
  price: number; minRent: number; wifiSpeed: number; wifiVerified: boolean;
  hasDesk: boolean; foreignOk: boolean; images: string[]; avgRating: string | null;
  reviewCount: number; includedFees: string[]; availableFrom?: string | null;
}

interface Props {
  listing: Listing;
  initialFavorited?: boolean;
  showFavorite?: boolean;
  onFavoriteChange?: (favorited: boolean) => void;
  /** 設為 true 可讓 Next.js 預載入此卡片的封面圖（僅首張（above-fold）卡片使用，直接優化 LCP） */
  priority?: boolean;
}

export default function ListingCard({ listing, initialFavorited = false, showFavorite = false, onFavoriteChange, priority = false }: Props) {
  const t = useTranslations('listingCard');
  const [favorited, setFavorited] = useState(initialFavorited);
  const [toggling, setToggling] = useState(false);
  const wifi = wifiLabel(listing.wifiSpeed);
  const img = listing.images[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400';

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault(); // 阻止觸發 Link
    if (toggling) return;
    setToggling(true);
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id }),
      });
      if (res.status === 401) {
        window.location.href = '/auth/login';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setFavorited(data.favorited);
        onFavoriteChange?.(data.favorited);
      }
    } finally {
      setToggling(false);
    }
  };

  return (
    <Link href={`/listings/${listing.id}`} className="card hover:shadow-md transition-shadow group">
      <div className="relative overflow-hidden h-48 bg-gray-100">
        <Image
          src={img}
          alt={listing.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          priority={priority}
        />
        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
          <span className={`badge ${cityColor(listing.city)}`}>{listing.city}</span>
          {listing.foreignOk && <span className="badge bg-purple-100 text-purple-800">🌍 {t('foreignOk')}</span>}
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {listing.wifiVerified && (
            <span className="badge bg-green-500 text-white font-semibold shadow-sm">
              ✓ {t('verified')}
            </span>
          )}
          {showFavorite && (
            <button
              onClick={toggleFavorite}
              disabled={toggling}
              aria-label={favorited ? t('removeFromFavorite') : t('addToFavorite')}
              aria-pressed={favorited}
              className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-400 focus-visible:outline-none text-sm ${
                favorited ? 'bg-red-500 text-white scale-110' : 'bg-white/90 text-gray-400 hover:text-red-400'
              }`}
            >
              <span aria-hidden="true">{favorited ? '♥' : '♡'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        <p className="text-xs text-gray-500 mb-1">{listing.district} · {listing.type}</p>
        <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2 line-clamp-2">{listing.title}</h3>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`badge border ${wifi.color} text-xs`}>{wifi.emoji} Wi-Fi {listing.wifiSpeed}Mbps</span>
          {listing.hasDesk && <span className="badge bg-gray-100 text-gray-600 text-xs">🖥 {t('hasDesk')}</span>}
          <NomadScoreBadge
            size="sm"
            wifiSpeed={listing.wifiSpeed}
            wifiVerified={listing.wifiVerified}
            hasDesk={listing.hasDesk}
            foreignOk={listing.foreignOk}
            avgRating={listing.avgRating}
          />
        </div>

        {listing.includedFees.length > 0 && (
          <p className="text-xs text-green-600 mb-2">✓ 含 {listing.includedFees.join('、')}</p>
        )}

        {/* ✅ 不在 render 中呼叫 new Date()，避免 server/client 時間差造成 hydration mismatch */}
        {listing.availableFrom ? (
          <p className="text-xs text-orange-600 mb-2">📅 {t('availableFrom', { date: listing.availableFrom })}</p>
        ) : (
          <p className="text-xs text-teal-600 mb-2">✅ {t('availableNow')}</p>
        )}

        <div className="flex items-end justify-between">
          <div>
            <span className="text-lg font-bold text-blue-600">{formatPrice(listing.price)}</span>
            <span className="text-xs text-gray-500">{t('perMonth')} · {t('minStayMonths', { n: String(listing.minRent) })}</span>
          </div>
          {listing.avgRating && (
            <div className="flex items-center gap-1 text-sm">
              <span className="text-yellow-500">★</span>
              <span className="font-medium">{listing.avgRating}</span>
              <span className="text-gray-400 text-xs">({listing.reviewCount})</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
