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
      <div className="card p-5 mt-5">
        <h2 className="font-bold text-gray-800 mb-4">你可能也喜歡</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-28 bg-gray-200 rounded-xl mb-2" />
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-1" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="card p-5 mt-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-800">你可能也喜歡</h2>
        <Link href={`/listings?city=${encodeURIComponent(city)}&type=${encodeURIComponent(type)}`}
          className="text-xs text-blue-500 hover:underline">
          查看更多 {city} 房源 →
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map(l => {
          const wifi = wifiLabel(l.wifiSpeed);
          return (
            <Link key={l.id} href={`/listings/${l.id}`}
              className="group rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all overflow-hidden">
              {/* 圖片 */}
              <div className="relative h-28 bg-gray-100 overflow-hidden">
                {l.images[0] ? (
                  <Image
                    src={l.images[0]}
                    alt={l.title}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">🏠</div>
                )}
                <div className="absolute top-1.5 left-1.5">
                  <span className="bg-white/90 text-xs text-nomad-navy px-1.5 py-0.5 rounded-md font-medium">{l.type}</span>
                </div>
              </div>
              {/* 資訊 */}
              <div className="p-2.5">
                <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug mb-1">{l.title}</p>
                <p className="text-xs text-gray-400 mb-1.5">{l.city} {l.district}</p>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-bold text-blue-600">{formatPrice(l.price)}</span>
                  <span className={`text-xs ${wifi.color} px-1.5 py-0.5 rounded-full border`}>{wifi.emoji}{l.wifiSpeed}M</span>
                </div>
                {l.avgRating && (
                  <div className="flex items-center gap-0.5 mt-1">
                    <span className="text-yellow-400 text-xs">★</span>
                    <span className="text-xs text-gray-600">{l.avgRating}</span>
                    <span className="text-xs text-gray-400">({l.reviewCount})</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
