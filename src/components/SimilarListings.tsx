'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice, wifiLabel } from '@/lib/utils';

type SimilarListing = {
  id: string; title: string; city: string; district: string;
  type: string; price: number; wifiSpeed: number;
  images: string[]; avgRating: string | null; reviewCount: number;
  foreignOk: boolean; minRent: number;
};

function wifiBadgeClass(speed: number) {
  if (speed >= 300) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (speed >= 100) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (speed >= 50)  return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
}

export default function SimilarListings({ listingId, city, type }: { listingId: string; city: string; type: string }) {
  const [items, setItems] = useState<SimilarListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/listings/${listingId}/similar`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); });
  }, [listingId]);

  if (loading) {
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-200" style={{ aspectRatio: '16/10' }} />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-2/5" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-800 text-base">你可能也喜歡</h2>
        <Link
          href={`/listings?city=${encodeURIComponent(city)}&type=${encodeURIComponent(type)}`}
          className="text-xs text-blue-500 hover:underline font-medium"
        >
          查看更多 {city} 房源 →
        </Link>
      </div>

      {/* 卡片格線：2 欄 → 3 欄 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map(l => {
          const wifi = wifiLabel(l.wifiSpeed);
          return (
            <Link
              key={l.id}
              href={`/listings/${l.id}`}
              className="group bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              {/* 圖片 16:10 */}
              <div className="relative bg-gray-100 overflow-hidden" style={{ aspectRatio: '16/10' }}>
                {l.images[0] ? (
                  <Image
                    src={l.images[0]}
                    alt={l.title}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">🏠</div>
                )}
                {/* 房型 */}
                <span className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded backdrop-blur-sm">
                  {l.type}
                </span>
                {/* 評分 */}
                {l.avgRating && (
                  <span className="absolute top-1.5 right-1.5 bg-white/90 text-[10px] font-bold text-gray-800 px-1.5 py-0.5 rounded-full shadow-sm">
                    ⭐ {l.avgRating}
                  </span>
                )}
              </div>

              {/* 資訊 */}
              <div className="p-2.5 flex flex-col flex-1 gap-1">
                {/* 價格 */}
                <div className="flex items-baseline gap-1">
                  <span className="text-blue-600 font-bold text-base leading-none">{formatPrice(l.price)}</span>
                  <span className="text-gray-400 text-[10px]">/月</span>
                </div>
                {/* 標題 */}
                <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                  {l.title}
                </p>
                {/* 地點 */}
                <p className="text-gray-400 text-[11px]">📍 {l.city} {l.district}</p>

                {/* 標籤 */}
                <div className="flex flex-wrap gap-1 mt-auto pt-1.5 border-t border-gray-100">
                  <span className={`text-[10px] font-semibold px-1 py-0.5 rounded border ${wifiBadgeClass(l.wifiSpeed)}`}>
                    ⚡ {l.wifiSpeed}M
                  </span>
                  {l.foreignOk && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded border border-blue-200">🌏</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
