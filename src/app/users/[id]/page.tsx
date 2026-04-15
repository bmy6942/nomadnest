'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';

type PublicUser = {
  id: string; name: string; role: string; avatar: string | null; bio: string | null;
  verified: boolean; joinedAt: string;
  phone: string | null; lineId: string | null; showContact: boolean;
  avgRating: string | null; reviewCount: number;
  listings: {
    id: string; title: string; city: string; district: string; type: string;
    price: number; wifiSpeed: number; images: string;
    avgRating: string | null; reviewCount: number;
  }[];
};

export default function UserProfilePage() {
  const params  = useParams<{ id: string }>();
  const router  = useRouter();
  const [user, setUser]   = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${params.id}`)
      .then(r => { if (r.status === 404) { setNotFound(true); return null; } return r.json(); })
      .then(d => { if (d) setUser(d); setLoading(false); });
  }, [params.id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">載入中...</div>;
  }
  if (notFound || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-700 mb-2">找不到此用戶</h1>
          <button onClick={() => router.back()} className="btn-secondary mt-4">← 返回</button>
        </div>
      </div>
    );
  }

  const roleLabel = user.role === 'landlord' ? '🏠 房東' : user.role === 'admin' ? '⚙ 管理員' : '🧳 房客';
  const joinDate  = new Date(user.joinedAt).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* 返回 */}
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1">
        ← 返回
      </button>

      {/* ── 個人資訊卡 ── */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* 頭像 */}
          <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 border-4 border-white shadow-md">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-3xl font-bold">
                {user.name[0]}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-nomad-navy">{user.name}</h1>
              {user.verified && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ 已認證</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-sm text-gray-500">
              <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs">{roleLabel}</span>
              <span>加入於 {joinDate}</span>
              {user.avgRating && (
                <span className="flex items-center gap-1">
                  ⭐ <strong className="text-gray-700">{user.avgRating}</strong>
                  <span className="text-gray-400">（{user.reviewCount} 則評價）</span>
                </span>
              )}
            </div>

            {user.bio && (
              <p className="text-sm text-gray-600 mt-3 leading-relaxed whitespace-pre-wrap">{user.bio}</p>
            )}

            {/* 聯絡資訊（已認證房東才顯示）*/}
            {user.showContact && (user.phone || user.lineId) && (
              <div className="mt-4 flex flex-wrap gap-3">
                {user.phone && (
                  <a href={`tel:${user.phone}`}
                    className="flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors">
                    📞 {user.phone}
                  </a>
                )}
                {user.lineId && (
                  <span className="flex items-center gap-1.5 text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-xl">
                    💬 LINE: {user.lineId}
                  </span>
                )}
              </div>
            )}
            {!user.showContact && user.role === 'landlord' && !user.verified && (
              <p className="text-xs text-gray-400 mt-3">此房東尚未完成身份驗證，聯絡資訊暫不顯示。</p>
            )}
          </div>
        </div>
      </div>

      {/* ── 上架中的房源（僅房東）── */}
      {user.role === 'landlord' && (
        <div>
          <h2 className="font-bold text-gray-800 mb-4">
            上架中的房源 <span className="text-gray-400 font-normal text-sm">（{user.listings.length} 間）</span>
          </h2>
          {user.listings.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">
              <div className="text-3xl mb-2">🏠</div>
              <p className="text-sm">目前沒有上架中的房源</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {user.listings.map(l => {
                const imgs: string[] = (() => {
                  try { return JSON.parse(l.images as unknown as string); } catch { return []; }
                })();
                return (
                  <Link key={l.id} href={`/listings/${l.id}`} className="card overflow-hidden hover:shadow-md transition-shadow">
                    <div className="w-full h-40 bg-gray-100">
                      {imgs[0]
                        ? <img src={imgs[0]} alt={l.title} loading="lazy" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🏠</div>}
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-sm text-gray-900 line-clamp-1">{l.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{l.city} {l.district} · {l.type}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-blue-600 font-bold text-sm">{formatPrice(l.price)}/月</span>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {l.avgRating && <span>⭐ {l.avgRating}</span>}
                          <span>📶 {l.wifiSpeed}M</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 訪客提示（未登入）*/}
      {user.role === 'landlord' && !user.showContact && user.verified && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <p className="text-sm text-blue-700">
            <Link href="/auth/login" className="font-semibold underline">登入</Link> 後可查看房東聯絡資訊
          </p>
        </div>
      )}
    </div>
  );
}
