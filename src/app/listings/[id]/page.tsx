import { prisma } from '@/lib/db';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { wifiLabel, formatPrice, formatAvailableDate } from '@/lib/utils';
import ApplyModal from './ApplyModal';
import ListingActions from './ListingActions';
import ReportButton from '@/components/ReportButton';
import PhotoGallery from '@/components/PhotoGallery';
import SimilarListings from '@/components/SimilarListings';
import RecordView from '@/components/RecordView';
import ReviewReply from '@/components/ReviewReply';
import RentCalculator from '@/components/RentCalculator';
// ✅ 直接 import Client Component — 不使用 nextDynamic({ ssr:false })
// Server Component 呼叫 dynamic({ ssr:false }) 會在 RSC payload 產生
// 懶載入客戶端模組參照，客戶端 requireModule 同步查找時找不到 factory
// → TypeError: Cannot read properties of undefined (reading 'call')
// RecommendationSection / ListingMap 都是 'use client'，用 useEffect 處理瀏覽器 API，
// 可安全地從 Server Component 直接 import（伺服器端渲染空骨架，客戶端 hydrate 後顯示內容）
import RecommendationSection from '@/components/RecommendationSection';
import NomadScoreBadge from '@/components/NomadScoreBadge';
import ListingMap from '@/components/ListingMap';
import type { Metadata } from 'next';
import { buildListingMetadata, buildRentalPropertyJsonLd, buildBreadcrumbJsonLd, BASE_URL } from '@/lib/seo';
import { getServerLocale, getServerTranslations } from '@/i18n/request';

// ── Cached DB query（房源公開資料，60 秒 TTL，tag revalidation 用於即時失效）──
// 只快取公開的房源資訊；用戶個人化資料（申請狀態、評價權限）仍即時查詢
const getCachedListing = unstable_cache(
  async (id: string) =>
    prisma.listing.findUnique({
      where: { id },
      include: {
        owner:   { select: { id: true, name: true, verified: true, bio: true, createdAt: true } },
        reviews: { include: { reviewer: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
      },
    }),
  ['listing-detail'],
  {
    revalidate: 60,                              // 60 秒後背景重新生成
    tags: ['listing'],                           // 支援 revalidateTag('listing') 即時清除
  }
);

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const listing = await getCachedListing(params.id);
  if (!listing) return { title: '找不到房源' };
  return buildListingMetadata({
    ...listing,
    images: listing.images as string,
  });
}

// ✅ 移除 force-dynamic：改用 unstable_cache 快取 DB 查詢（60秒）
// 用戶個人化部分仍保持動態，整體降低 DB 往返次數 ~80%

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const listing = await getCachedListing(params.id);
  if (!listing || listing.status !== 'active') notFound();

  const locale = await getServerLocale();
  const tCommon = await getServerTranslations('common');
  const user = await getCurrentUser();
  const isTenant = user?.role === 'tenant';

  // 今天日期（YYYY-MM-DD），用於與 moveInDate 比較
  const today = new Date().toISOString().slice(0, 10);

  // 找最早的已批准申請
  const approvedApp = isTenant
    ? await prisma.application.findFirst({
        where: { listingId: listing.id, tenantId: user!.id, status: 'approved' },
        select: { moveInDate: true },
        orderBy: { moveInDate: 'asc' },
      })
    : null;

  // 入住日已到或已過 → 可評價
  const hasMovedIn = approvedApp ? approvedApp.moveInDate <= today : false;
  // 入住日尚未到 → 顯示「XX日後可評價」提示
  const pendingMoveInDate: string | null =
    approvedApp && !hasMovedIn ? approvedApp.moveInDate : null;

  // 看房已完成（確認時間已過）也可評價
  const hasCompletedViewing = isTenant && !hasMovedIn
    ? await (async () => {
        const now = new Date();
        const confirmedViewings = await prisma.viewingRequest.findMany({
          where: {
            listingId: listing.id,
            tenantId: user!.id,
            status: { in: ['confirmed', 'completed'] },
            confirmedTime: { not: null },
          },
          select: { confirmedTime: true },
        });
        return confirmedViewings.some(v => v.confirmedTime && new Date(v.confirmedTime) < now);
      })()
    : false;

  const canReview = hasMovedIn || hasCompletedViewing;

  // Check if current tenant already reviewed this listing
  const hasReviewed = isTenant
    ? !!(await prisma.review.findFirst({
        where: { listingId: listing.id, reviewerId: user!.id },
      }))
    : false;

  // ✅ 安全解析 JSON 陣列欄位（DB 資料損壞時防止 JSON.parse 拋出 500，改用空陣列 fallback）
  const images: string[]      = (() => { try { return JSON.parse(listing.images       || '[]') as string[]; } catch { return []; } })();
  const amenities: string[]   = (() => { try { return JSON.parse(listing.amenities    || '[]') as string[]; } catch { return []; } })();
  const includedFees: string[] = (() => { try { return JSON.parse(listing.includedFees || '[]') as string[]; } catch { return []; } })();
  const wifi = wifiLabel(listing.wifiSpeed);
  const avgRating = listing.reviews.length
    ? (listing.reviews.reduce((s, r) => s + r.rating, 0) / listing.reviews.length).toFixed(1) : null;

  const amenityIcons: Record<string, string> = {
    '冷氣': '❄️', '洗衣機': '🌀', '冰箱': '🧊', '微波爐': '📡', '熱水器': '🚿',
    '第四台': '📺', '烘衣機': '♨️', '洗碗機': '🍽️', '白板牆': '📋', '備用4G': '📶',
    '共用工作室': '🏢', '投影機': '📽️', '白板': '📋', '自行車': '🚲',
    '景觀陽台': '🌄', '免費腳踏車': '🚲', '電梯': '🛗', '烘碗機': '✨',
    '廚房共用': '🍳', '洗衣機共用': '🌀', '冰箱共用': '🧊',
  };

  // JSON-LD 結構化資料（RentalProperty + AggregateRating）
  const jsonLd = buildRentalPropertyJsonLd({
    id: listing.id,
    title: listing.title,
    description: listing.description,
    city: listing.city,
    district: listing.district,
    price: listing.price,
    images,
    amenities,
    reviews: listing.reviews.map(r => ({
      rating: r.rating,
      content: r.content,
      reviewer: { name: r.reviewer.name },
    })),
  });

  // 麵包屑 JSON-LD
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: '首頁', url: '/' },
    { name: '房源列表', url: '/listings' },
    { name: `${listing.city} ${listing.district}`, url: `/listings?city=${encodeURIComponent(listing.city)}` },
    { name: listing.title, url: `${BASE_URL}/listings/${listing.id}` },
  ]);

  return (
    <>
      {/* JSON-LD 結構化資料（SEO Rich Results） */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* 麵包屑 JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    <div className="max-w-5xl mx-auto px-4 py-8 pb-28 lg:pb-8">
      {/* ✅ 靜默記錄瀏覽（用於最近瀏覽功能） */}
      <RecordView listingId={listing.id} />
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <a href="/" className="hover:text-blue-600">首頁</a> / <a href="/listings" className="hover:text-blue-600">房源列表</a> / <span className="text-gray-800">{listing.city} {listing.district}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {/* 互動相冊 */}
          <PhotoGallery images={images} title={listing.title} />

          {/* Title & Badges */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="badge bg-blue-100 text-blue-800">{listing.city} {listing.district}</span>
              <span className="badge bg-gray-100 text-gray-700">{listing.type}</span>
              {listing.foreignOk && <span className="badge bg-purple-100 text-purple-800">🌍 外籍友善</span>}
              {listing.wifiVerified && <span className="badge bg-green-100 text-green-700">✓ Wi-Fi 已驗證</span>}
            </div>
            <h1 className="text-2xl font-bold text-nomad-navy mb-2">{listing.title}</h1>
            {avgRating && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-yellow-500 text-base">{'★'.repeat(Math.round(parseFloat(avgRating)))}</span>
                <span className="font-semibold">{avgRating}</span>
                <span className="text-gray-400">({listing.reviews.length} 則評價)</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="card p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-3">房源說明</h2>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{listing.description}</p>
          </div>

          {/* Nomad Score */}
          <div className="card p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-bold text-gray-800">⭐ Nomad Score</h2>
              <span className="text-xs text-gray-400">游牧工作者適合度綜合評分</span>
            </div>
            <NomadScoreBadge
              size="lg"
              showBreakdown
              wifiSpeed={listing.wifiSpeed}
              wifiVerified={listing.wifiVerified}
              hasDesk={listing.hasDesk}
              foreignOk={listing.foreignOk}
              avgRating={avgRating}
            />
          </div>

          {/* Work Setup */}
          <div className="card p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-4">🖥 工作環境</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">{wifi.emoji}</div>
                <div className="font-bold text-nomad-navy">{listing.wifiSpeed} Mbps</div>
                <div className={`text-xs mt-1 font-medium ${wifi.color} px-2 py-0.5 rounded-full inline-block border`}>{tCommon(wifi.labelKey)}</div>
                {listing.wifiVerified && <div className="text-xs text-green-600 mt-1">✓ 實測驗證</div>}
              </div>
              {listing.hasDesk && (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">🗂</div>
                  <div className="font-bold text-gray-800">工作桌</div>
                  {listing.deskSize && <div className="text-xs text-gray-500 mt-1">{listing.deskSize}</div>}
                </div>
              )}
              <div className="bg-yellow-50 rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">☀️</div>
                <div className="font-bold text-gray-800">自然採光</div>
                <div className="text-xs text-gray-500 mt-1">{'★'.repeat(listing.naturalLight)}{'☆'.repeat(5 - listing.naturalLight)}</div>
              </div>
              {listing.nearMRT !== null && (
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">🚇</div>
                  <div className="font-bold text-gray-800">捷運站</div>
                  <div className="text-xs text-gray-500 mt-1">步行 {listing.nearMRT} 分鐘</div>
                </div>
              )}
              {listing.nearCowork !== null && listing.nearCowork !== undefined && (
                <div className="bg-purple-50 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">🏢</div>
                  <div className="font-bold text-gray-800">共工空間</div>
                  <div className="text-xs text-gray-500 mt-1">{listing.nearCowork === 0 ? '本棟即有' : `步行 ${listing.nearCowork} 分鐘`}</div>
                </div>
              )}
            </div>
          </div>

          {/* Amenities */}
          {amenities.length > 0 && (
            <div className="card p-5 mb-5">
              <h2 className="font-bold text-gray-800 mb-3">設備與設施</h2>
              <div className="flex flex-wrap gap-2">
                {amenities.map((a: string) => (
                  <span key={a} className="bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-1.5 rounded-lg">
                    {amenityIcons[a] || '•'} {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {listing.reviews.length > 0 && (
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 mb-4">租客評價</h2>
              <div className="space-y-4">
                {listing.reviews.map((r) => (
                  <div key={r.id} className="border-b border-gray-100 pb-4 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">
                          {r.reviewer.name[0]}
                        </div>
                        <span className="font-medium text-sm">{r.reviewer.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-yellow-500">{'★'.repeat(r.rating)}</span>
                        <span className="text-xs text-gray-400 ml-1">Wi-Fi: {'★'.repeat(r.wifiRating)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{r.content}</p>
                    {/* ✅ 房東回覆 */}
                    <ReviewReply
                      reviewId={r.id}
                      existingReply={r.ownerReply}
                      isOwner={user?.id === listing.owner.id}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map */}
          {listing.lat && listing.lng && (
            <div className="card p-5 mt-5">
              <h2 className="font-bold text-gray-800 mb-3">📍 房源位置</h2>
              <div style={{ height: '280px', isolation: 'isolate', position: 'relative' }}>
                <ListingMap lat={listing.lat} lng={listing.lng} title={listing.title} />
              </div>
              <p className="text-xs text-gray-400 mt-2">{listing.city}{listing.district}{listing.address}</p>
            </div>
          )}

          {/* 相似房源推薦 */}
          <SimilarListings listingId={listing.id} city={listing.city} type={listing.type} />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-20">
            <div className="text-3xl font-bold text-blue-600 mb-1">{formatPrice(listing.price)}</div>
            <div className="text-sm text-gray-500 mb-4">每月 · 最短 {listing.minRent} 個月起</div>

            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">押金</span>
                <span className="font-medium">{listing.deposit} 個月</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">租期</span>
                <span className="font-medium">{listing.minRent}～{listing.maxRent} 個月</span>
              </div>
              {/* ✅ 可入住日期（availableFrom: 'YYYY-MM-DD' | null） */}
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">📅 可入住</span>
                {listing.availableFrom ? (
                  <span className="font-medium text-orange-600">
                    {formatAvailableDate(listing.availableFrom, locale)} 起
                  </span>
                ) : (
                  <span className="font-medium text-green-600">✅ 即可入住</span>
                )}
              </div>
              {includedFees.length > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">費用含</span>
                  <span className="font-medium text-green-600">{includedFees.join('、')}</span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-gray-500">媒合服務費</span>
                <span className="font-medium">{formatPrice(Math.round(listing.price / 2))}</span>
              </div>
            </div>

            {/* ── 租金試算器 ── */}
            <RentCalculator
              price={listing.price}
              deposit={listing.deposit}
              minRent={listing.minRent}
              maxRent={listing.maxRent}
              includedFees={includedFees}
            />

            <div className="mt-4">
              <ApplyModal listingId={listing.id} listingTitle={listing.title} isLoggedIn={!!user} isSameUser={user?.id === listing.owner.id} />
            </div>

            <ListingActions
              listingId={listing.id}
              ownerId={listing.owner.id}
              price={listing.price}
              isLoggedIn={!!user}
              isTenant={isTenant}
              hasApproved={canReview}
              hasReviewed={hasReviewed}
              pendingMoveInDate={pendingMoveInDate}
            />

            {/* Owner Info */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">房東資訊</h3>
              <div className="flex items-center gap-3">
                <a href={`/users/${listing.owner.id}`}
                  className="w-10 h-10 bg-nomad-navy text-white rounded-full flex items-center justify-center font-bold hover:bg-blue-700 transition-colors">
                  {listing.owner.name[0]}
                </a>
                <div className="flex-1">
                  <a href={`/users/${listing.owner.id}`}
                    className="font-medium text-sm hover:text-blue-600 transition-colors">{listing.owner.name}</a>
                  {listing.owner.verified && <span className="block text-xs text-green-600">✓ 已驗證身份</span>}
                  <div className="text-xs text-gray-400 mt-0.5">
                    加入於 {new Date(listing.owner.createdAt).getFullYear()} 年
                  </div>
                </div>
                <a href={`/users/${listing.owner.id}`}
                  className="text-xs text-blue-500 hover:underline shrink-0">
                  查看全部房源 →
                </a>
              </div>
              {listing.owner.bio && <p className="text-xs text-gray-600 mt-3 leading-relaxed">{listing.owner.bio}</p>}
            </div>

            {/* 檢舉按鈕 */}
            {user && user.id !== listing.owner.id && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                <ReportButton targetType="listing" targetId={listing.id} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 個人化推薦（全寬，跳出三欄格線之外） ── */}
      <div className="mt-10 pt-8 border-t border-gray-100">
        <RecommendationSection limit={4} />
      </div>

      {/* ── 手機版黏性底部 CTA ── */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3 flex items-center gap-3 shadow-lg">
        <div className="flex-1">
          <div className="text-lg font-bold text-blue-600">{formatPrice(listing.price)}<span className="text-xs text-gray-400 font-normal">/月</span></div>
          <div className="text-xs text-gray-500">最短 {listing.minRent} 個月 · {listing.city}</div>
        </div>
        <ApplyModal
          listingId={listing.id}
          listingTitle={listing.title}
          isLoggedIn={!!user}
          isSameUser={user?.id === listing.owner.id}
        />
      </div>
    </div>
    </>
  );
}
