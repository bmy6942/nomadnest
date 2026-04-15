import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { wifiLabel, formatPrice } from '@/lib/utils';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BASE_URL, SITE_NAME, TWITTER_HANDLE, DEFAULT_OG_IMAGE, buildBreadcrumbJsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return { title: '找不到房東' };

  const title = `${user.name} 的游牧友善房源`;
  const description = user.bio || `查看 ${user.name} 在 NomadNest 上的所有游牧友善房源，Wi-Fi 速度保證、外籍友善。`;
  const url = `${BASE_URL}/landlords/${params.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'profile',
      locale: 'zh_TW',
      url,
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      site: TWITTER_HANDLE,
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export default async function LandlordProfilePage({ params }: { params: { id: string } }) {
  const landlord = await prisma.user.findUnique({
    where: { id: params.id, role: { in: ['landlord', 'admin'] } },
    select: {
      id: true, name: true, bio: true, verified: true, createdAt: true,
      listings: {
        where: { status: 'active' },
        include: { reviews: { select: { rating: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!landlord) notFound();

  const activeListings = landlord.listings.map(l => ({
    ...l,
    images: JSON.parse(l.images || '[]') as string[],
    amenities: JSON.parse(l.amenities || '[]') as string[],
    avgRating: l.reviews.length
      ? (l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length)
      : null,
    reviewCount: l.reviews.length,
  }));

  const totalReviews = activeListings.reduce((s, l) => s + l.reviewCount, 0);
  const overallRating = totalReviews > 0
    ? (activeListings.reduce((s, l) => s + (l.avgRating ?? 0) * l.reviewCount, 0) / totalReviews)
    : null;

  const joinYear = new Date(landlord.createdAt).getFullYear();
  const monthsOnPlatform = Math.floor(
    (Date.now() - new Date(landlord.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
  );

  // ── JSON-LD 結構化資料 ────────────────────────────────────────
  const profileUrl = `${BASE_URL}/landlords/${landlord.id}`;

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: landlord.name,
    url: profileUrl,
    ...(landlord.bio ? { description: landlord.bio } : {}),
    ...(landlord.verified ? { hasCredential: { '@type': 'EducationalOccupationalCredential', name: '已驗證身份' } } : {}),
    makesOffer: activeListings.map(l => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'RentalProperty',
        name: l.title,
        url: `${BASE_URL}/listings/${l.id}`,
      },
      price: l.price,
      priceCurrency: 'TWD',
    })),
    ...(overallRating && totalReviews > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: overallRating.toFixed(2),
        reviewCount: totalReviews,
        bestRating: 5,
        worstRating: 1,
      },
    } : {}),
  };

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: '首頁', url: '/' },
    { name: '房源列表', url: '/listings' },
    { name: `房東：${landlord.name}`, url: profileUrl },
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* JSON-LD 結構化資料 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-5">
        <Link href="/" className="hover:text-blue-600">首頁</Link> /{' '}
        <Link href="/listings" className="hover:text-blue-600">房源</Link> /{' '}
        <span className="text-gray-800">房東：{landlord.name}</span>
      </nav>

      {/* ── 房東資訊卡 ── */}
      <div className="card p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {/* 頭像 */}
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl flex items-center justify-center text-3xl font-bold shrink-0 shadow-md">
            {landlord.name[0]}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-nomad-navy">{landlord.name}</h1>
              {landlord.verified && (
                <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  ✓ 已驗證身份
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-3">
              🏠 房東 · 加入於 {joinYear} 年
              {monthsOnPlatform >= 1 && <span className="ml-2">（已在平台 {monthsOnPlatform} 個月）</span>}
            </p>
            {landlord.bio && (
              <p className="text-sm text-gray-700 leading-relaxed">{landlord.bio}</p>
            )}
          </div>

          {/* 右側統計 */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-1 sm:w-28 shrink-0">
            <div className="text-center bg-blue-50 rounded-xl p-3">
              <div className="text-xl font-bold text-nomad-navy">{activeListings.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">上架房源</div>
            </div>
            <div className="text-center bg-yellow-50 rounded-xl p-3">
              <div className="text-xl font-bold text-nomad-navy">
                {overallRating ? overallRating.toFixed(1) : '—'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">平均評分</div>
            </div>
            <div className="text-center bg-green-50 rounded-xl p-3">
              <div className="text-xl font-bold text-nomad-navy">{totalReviews}</div>
              <div className="text-xs text-gray-500 mt-0.5">評論數</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 房源列表 ── */}
      <div>
        <h2 className="text-lg font-bold text-nomad-navy mb-4">
          {landlord.name} 的上架房源 ({activeListings.length})
        </h2>

        {activeListings.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">🏠</div>
            <p>此房東目前沒有上架中的房源</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeListings.map(l => {
              const wifi = wifiLabel(l.wifiSpeed);
              return (
                <Link key={l.id} href={`/listings/${l.id}`}
                  className="card hover:shadow-lg transition-shadow overflow-hidden group">
                  {/* 圖片 */}
                  <div className="relative h-44 bg-gray-200 overflow-hidden">
                    {l.images[0] ? (
                      <img
                        src={l.images[0]}
                        alt={l.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">🏠</div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                      <span className="bg-white/90 text-nomad-navy text-xs font-medium px-2 py-0.5 rounded-full">{l.type}</span>
                      {l.foreignOk && <span className="bg-purple-500/90 text-white text-xs px-2 py-0.5 rounded-full">🌍 外籍友善</span>}
                    </div>
                  </div>

                  {/* 資訊 */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-1">{l.title}</h3>
                    <p className="text-xs text-gray-500 mb-2">{l.city} {l.district}</p>

                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs ${wifi.color} px-2 py-0.5 rounded-full border`}>{wifi.emoji} {l.wifiSpeed}Mbps</span>
                      {l.avgRating && (
                        <span className="text-xs text-gray-600 flex items-center gap-0.5">
                          <span className="text-yellow-500">★</span> {l.avgRating.toFixed(1)}
                          <span className="text-gray-400">({l.reviewCount})</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-blue-600 font-bold">{formatPrice(l.price)}</span>
                        <span className="text-xs text-gray-400">/月</span>
                      </div>
                      <span className="text-xs text-gray-400">{l.minRent}個月起</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
