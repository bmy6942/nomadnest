'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ListingCard from '@/components/ListingCard';
import { FavoritesSkeleton } from '@/components/SkeletonCard';
import { getCachedStale, setCached } from '@/lib/clientCache';

interface FavoriteListing {
  id: string; title: string; city: string; district: string; type: string;
  price: number; minRent: number; wifiSpeed: number; wifiVerified: boolean;
  hasDesk: boolean; foreignOk: boolean; images: string[]; includedFees: string[];
  availableFrom?: string | null; avgRating: string | null; reviewCount: number;
  status: string;
}

interface FavoriteItem {
  favoritedAt: string;
  listing: FavoriteListing;
}

const CACHE_FAV = '/api/favorites';

export default function FavoritesPage() {
  const router = useRouter();
  // ✅ 先嘗試讀取快取，有快取跳過骨架屏「秒開」
  const [items, setItems] = useState<FavoriteItem[]>(() => {
    const c = getCachedStale<{ favorites: FavoriteItem[] }>(CACHE_FAV);
    return c?.data?.favorites ?? [];
  });
  const [loading, setLoading] = useState(() => getCachedStale(CACHE_FAV) === null);
  const [error, setError] = useState('');

  useEffect(() => {
    const cached = getCachedStale<{ favorites: FavoriteItem[] }>(CACHE_FAV);
    if (cached && !cached.stale) { setLoading(false); return; }   // 快取新鮮 → 不發請求

    fetch('/api/favorites')
      .then(res => {
        if (res.status === 401) {
          router.push('/auth/login?redirect=/favorites');
          return null;
        }
        // ✅ 非 401 的 HTTP 錯誤（403、500 等）不再靜默忽略
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setCached(CACHE_FAV, data);
        setItems(data.favorites ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError('載入收藏清單失敗，請稍後再試');
        setLoading(false);
      });
  }, [router]);

  // 取消收藏時，從清單中移除該房源
  const handleFavoriteChange = useCallback((listingId: string, favorited: boolean) => {
    if (!favorited) {
      setItems(prev => prev.filter(item => item.listing.id !== listingId));
    }
  }, []);

  // ✅ FavoritesSkeleton 取代 spinner：畫面立即呈現頁面結構，不再空白等待
  if (loading) return <FavoritesSkeleton />;

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-red-500">{error}</p>
        <button onClick={() => router.refresh()} className="mt-4 btn-secondary text-sm">重新載入</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-28 lg:pb-8">
      {/* 頁首 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">❤️ 我的收藏</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length > 0 ? `共 ${items.length} 個收藏房源` : '尚無收藏房源'}
          </p>
        </div>
        <Link href="/listings" className="btn-secondary text-sm px-4 py-2">
          🔍 繼續搜尋
        </Link>
      </div>

      {/* 空狀態 */}
      {items.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🏠</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">還沒有收藏的房源</h2>
          <p className="text-gray-400 text-sm mb-6">瀏覽房源時點擊 ♡ 即可加入收藏，方便日後比較</p>
          <Link href="/listings" className="btn-primary px-6 py-2.5 text-sm">
            去找房源
          </Link>
        </div>
      )}

      {/* 收藏清單 */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(item => (
            <div key={item.listing.id} className="relative">
              <ListingCard
                listing={item.listing}
                initialFavorited={true}
                showFavorite={true}
                onFavoriteChange={(favorited) => handleFavoriteChange(item.listing.id, favorited)}
              />
              {/* 收藏時間標籤 */}
              <div className="mt-1 px-1">
                <p className="text-xs text-gray-400">
                  收藏於 {new Date(item.favoritedAt).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              {/* 房源已下架提示 */}
              {item.listing.status !== 'active' && (
                <div className="absolute inset-x-0 top-0 bg-black/60 text-white text-xs font-medium text-center py-1.5 rounded-t-2xl">
                  ⚠️ 此房源已下架或停售
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 底部提示 */}
      {items.length > 0 && (
        <p className="text-center text-xs text-gray-400 mt-8">
          點擊 ♥ 即可取消收藏 · 收藏清單僅供您個人使用
        </p>
      )}
    </div>
  );
}
