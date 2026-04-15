import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import ListingCard from '@/components/ListingCard';
// ✅ 直接 import — 不用 dynamic({ ssr:false })（Server Component 禁止用此模式）
import RecommendationSection from '@/components/RecommendationSection';
import HeroSearch from '@/components/HeroSearch';
import { getServerTranslations } from '@/i18n/request';
import {
  BASE_URL,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from '@/lib/seo';

// ── 首頁專屬 metadata ─────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'NomadNest Taiwan — 數位游牧租屋媒合平台',
  description: '台灣第一個專為數位游牧工作者設計的中長租媒合平台，提供 Wi-Fi 速度保證、線上合約、押金託管服務。台北、台中、高雄、花蓮全台灣覆蓋。',
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: 'website',
    url: BASE_URL,
    title: 'NomadNest Taiwan — 數位游牧租屋媒合平台',
    description: '台灣第一個專為數位游牧工作者設計的中長租媒合平台，提供 Wi-Fi 速度保證、線上合約、押金託管服務。',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'NomadNest Taiwan' }],
  },
};


// ✅ ISR：每 60 秒重新生成，取代 force-dynamic（大幅減少 DB 查詢）
export const revalidate = 60;

async function getFeaturedListings() {
  const listings = await prisma.listing.findMany({
    where: { status: 'active' },
    // ✅ 只 select 需要的欄位，不拉 amenities/includedFees（listing card 不需要）
    select: {
      id: true, title: true, city: true, district: true, type: true,
      price: true, minRent: true, wifiSpeed: true, wifiVerified: true,
      hasDesk: true, images: true, foreignOk: true, availableFrom: true,
      lat: true, lng: true, createdAt: true, ownerId: true,
      owner: { select: { name: true, verified: true } },
      reviews: { select: { rating: true } },
      _count: { select: { favorites: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });
  return listings.map(l => ({
    ...l,
    images: JSON.parse(l.images || '[]'),
    amenities: [],
    includedFees: [],
    avgRating: l.reviews.length ? (l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length).toFixed(1) : null,
    reviewCount: l.reviews.length,
  }));
}

async function getStats() {
  const [listings, users, applications, reviews] = await Promise.all([
    prisma.listing.count({ where: { status: 'active' } }),
    prisma.user.count(),
    prisma.application.count({ where: { status: 'approved' } }),
    prisma.review.aggregate({ _avg: { rating: true } }),
  ]);
  return { listings, users, applications, avgRating: reviews._avg.rating ?? 0 };
}

async function getFeaturedReviews() {
  const reviews = await prisma.review.findMany({
    where: { rating: { gte: 4 } },
    select: {
      id: true, rating: true, wifiRating: true, content: true, createdAt: true,
      reviewer: { select: { name: true } },
      listing: { select: { id: true, title: true, city: true, type: true } },
    },
    orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    take: 3,
  });
  return reviews;
}

async function getCityStats() {
  // ✅ 單一 groupBy 查詢取代原本 6 個獨立 COUNT（6x → 1x DB 往返）
  const cities = ['台北市', '新北市', '台中市', '高雄市', '花蓮縣', '台南市'];
  const results = await prisma.listing.groupBy({
    by: ['city'],
    where: { status: 'active', city: { in: cities } },
    _count: { id: true },
  });
  const countMap = new Map(results.map(r => [r.city, r._count.id]));
  return cities.map(city => ({ city, count: countMap.get(city) ?? 0 }));
}

export default async function HomePage() {
  const t = await getServerTranslations('home');
  const [featured, stats, cityStats, featuredReviews] = await Promise.all([
    getFeaturedListings(), getStats(), getCityStats(), getFeaturedReviews(),
  ]);

  const cityEmojis: Record<string, string> = {
    '台北市': '🏙', '新北市': '🌆', '台中市': '🏞', '高雄市': '🌊',
    '花蓮縣': '⛰', '台南市': '🏯',
  };

  return (
    <>
      {/* ── Schema.org JSON-LD（WebSite + Organization）── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebSiteJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildOrganizationJsonLd()) }}
      />
    <div>
      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-nomad-navy via-blue-800 to-blue-600 text-white overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-yellow-300 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-white text-sm px-4 py-2 rounded-full mb-6 border border-white/20">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            {t('badge')}
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-5 leading-tight">
            {t('heroTitle1')}<span className="text-yellow-300">{t('heroHighlight')}</span><br />
            <span className="text-3xl md:text-4xl font-semibold text-blue-100">{t('heroSubtitle2')}</span>
          </h1>

          <p className="text-lg text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('heroBullets')}<br />
            {t('heroDesc')}
          </p>

          {/* Search bar with autocomplete */}
          <HeroSearch />

          {/* Live stats */}
          <div className="flex justify-center gap-10 mt-10">
            {[
              { value: stats.listings, label: t('statListings') },
              { value: stats.users, label: t('statMembers') },
              { value: stats.applications, label: t('statMatched') },
              { value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—', label: t('statRating') },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-blue-200 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Value Props ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-nomad-navy">{t('valuePropsTitle')}</h2>
            <p className="text-gray-500 mt-2 text-sm">{t('valuePropsSub')}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { emoji: '⚡', title: t('vp1Title'), desc: t('vp1Desc') },
              { emoji: '📅', title: t('vp2Title'), desc: t('vp2Desc') },
              { emoji: '🌍', title: t('vp3Title'), desc: t('vp3Desc') },
              { emoji: '🔒', title: t('vp4Title'), desc: t('vp4Desc') },
            ].map(f => (
              <div key={f.title}
                className="text-center p-6 rounded-2xl bg-gradient-to-b from-blue-50 to-white border border-blue-100 hover:shadow-md transition-shadow">
                <div className="text-4xl mb-3">{f.emoji}</div>
                <h3 className="font-bold text-nomad-navy text-sm mb-2">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why NomadNest — Brand Differentiation ── */}
      <section className="py-16 px-4 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
              為什麼選擇 NomadNest
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              不是一般租屋平台，<span className="text-blue-600">是游牧者的專屬基地</span>
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm">
              我們從零開始為數位游牧工作者設計，每一個功能都圍繞著「遠端工作者真正需要什麼」打造。
            </p>
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium w-2/5">功能 / 保障</th>
                  <th className="py-3 px-4 text-center text-gray-400 font-medium">一般租屋平台<br /><span className="text-xs font-normal">（591 / 臉書社團）</span></th>
                  <th className="py-3 px-4 text-center text-gray-400 font-medium">短租平台<br /><span className="text-xs font-normal">（Airbnb / Booking）</span></th>
                  <th className="py-3 px-4 text-center bg-blue-600 text-white font-bold rounded-t-xl">
                    🏡 NomadNest
                    <span className="block text-xs font-normal text-blue-200 mt-0.5">為游牧者而生</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: '中期租約（1–6 個月）', others: [false, false], us: true },
                  { feature: 'Wi-Fi 速度驗證保證', others: [false, false], us: true },
                  { feature: '外籍友善英文介面', others: [false, false], us: true },
                  { feature: '線上電子合約', others: [false, false], us: true },
                  { feature: '押金第三方托管', others: [false, false], us: true },
                  { feature: '辦公桌 / 工作環境標示', others: [false, true], us: true },
                  { feature: '遠端工作評分（Nomad Score）', others: [false, false], us: true },
                ].map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}>
                    <td className="py-3 px-4 text-gray-700 font-medium">{row.feature}</td>
                    {row.others.map((ok, j) => (
                      <td key={j} className="py-3 px-4 text-center">
                        <span className={ok ? 'text-green-500' : 'text-gray-300'}>
                          {ok ? '✓' : '✕'}
                        </span>
                      </td>
                    ))}
                    <td className="py-3 px-4 text-center bg-blue-50 font-bold text-blue-600">✓</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="py-4 px-4" />
                  <td className="py-4 px-4 text-center" />
                  <td className="py-4 px-4 text-center" />
                  <td className="py-4 px-4 text-center bg-blue-600 rounded-b-xl">
                    <a href="/auth/register"
                      className="inline-block bg-white text-blue-700 font-bold text-xs px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                      免費加入 →
                    </a>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Sub-callouts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
            {[
              {
                icon: '📶',
                title: 'Wi-Fi 速度保證',
                desc: '每間房源都標示實測上傳/下載速度，部分房源提供官方驗證標章。告別「快速網路」的空洞承諾。',
              },
              {
                icon: '🛂',
                title: '外籍工作者友善',
                desc: '支援英文介面與中英文訊息系統，房源可標記「接受外國租客」，讓跨國租屋不再是障礙。',
              },
              {
                icon: '📅',
                title: '中期租約甜蜜點',
                desc: '最短 30 天、最長 6 個月——比 Airbnb 便宜 40–60%，比傳統長租更彈性。真正符合游牧節奏。',
              },
            ].map(c => (
              <div key={c.title} className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5">
                <div className="text-3xl mb-3">{c.icon}</div>
                <h3 className="font-bold text-gray-900 text-sm mb-1.5">{c.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-nomad-navy">{t('howTitle')}</h2>
            <p className="text-gray-500 mt-2 text-sm">{t('howSub')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '1', emoji: '🔍', title: t('step1Title'), desc: t('step1Desc') },
              { step: '2', emoji: '💬', title: t('step2Title'), desc: t('step2Desc') },
              { step: '3', emoji: '🤝', title: t('step3Title'), desc: t('step3Desc') },
            ].map(s => (
              <div key={s.step} className="relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 bg-nomad-navy text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {s.step}
                </div>
                <div className="text-4xl mt-3 mb-3">{s.emoji}</div>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── City Browse ── */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-nomad-navy">{t('citiesTitle')}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{t('citiesSub')}</p>
            </div>
            <Link href="/listings" className="text-sm text-blue-600 hover:underline">{t('viewAllArrow')}</Link>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <Link href="/listings"
              className="col-span-1 flex flex-col items-center gap-2 bg-nomad-navy text-white p-4 rounded-2xl hover:bg-blue-800 transition-colors text-center">
              <span className="text-2xl">🗺️</span>
              <span className="text-xs font-medium">{t('allTaiwan')}</span>
              <span className="text-lg font-bold">{stats.listings}</span>
            </Link>
            {cityStats.map(cs => (
              <Link key={cs.city} href={`/listings?city=${encodeURIComponent(cs.city)}`}
                className="flex flex-col items-center gap-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 p-4 rounded-2xl transition-all text-center">
                <span className="text-2xl">{cityEmojis[cs.city] || '🏙'}</span>
                <span className="text-xs font-medium text-gray-700 leading-tight">{cs.city}</span>
                <span className="text-base font-bold text-nomad-navy">{cs.count}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Listings ── */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-nomad-navy">{t('latestListingsTitle')}</h2>
              <p className="text-gray-500 text-sm mt-1">{t('latestListingsSub')}</p>
            </div>
            <Link href="/listings" className="btn-secondary text-sm">{t('viewAllArrow')}</Link>
          </div>
          {featured.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-4">🏠</div>
              <p>{t('noListingsYet')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((l, idx) => (
                <ListingCard key={l.id} listing={l} priority={idx === 0} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 個人化推薦（client-side，依登入狀態顯示） ── */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <RecommendationSection limit={8} />
        </div>
      </section>

      {/* ── Testimonials / Social proof ── */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-nomad-navy">{t('testimonialsTitle')}</h2>
            <p className="text-sm text-gray-400 mt-1">{t('testimonialsSub')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featuredReviews.length >= 3 ? featuredReviews.map(r => (
              <div key={r.id} className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex flex-col">
                {/* Stars */}
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={i < r.rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                  ))}
                  <span className="text-xs text-gray-400 ml-1">Wi-Fi {'📶'.repeat(r.wifiRating)}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed flex-1 mb-4">
                  &ldquo;{r.content.length > 100 ? r.content.slice(0, 100) + '…' : r.content}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                    {r.reviewer.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{r.reviewer.name}</p>
                    <Link href={`/listings/${r.listing.id}`}
                      className="text-xs text-blue-500 hover:underline truncate block">
                      {r.listing.city} · {r.listing.type}
                    </Link>
                  </div>
                </div>
              </div>
            )) : [
              { avatar: 'J', name: 'Jason L.', city: '台北市', role: '前端工程師', text: '找到一間 500Mbps 光纖、附工作桌的套房，價格很實惠，只租了 3 個月！' },
              { avatar: 'S', name: 'Sarah W.', city: '花蓮縣', role: '內容創作者', text: '第一次在台灣租房擔心語言問題，標示「外籍友善」的房東真的很耐心，全程英文溝通。' },
              { avatar: '王', name: '王小明', city: '台中市', role: 'UI 設計師', text: '站內訊息系統很方便，和房東確認細節都在平台上，不用交換私人聯絡，感覺很安全。' },
            ].map(t => (
              <div key={t.name} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <div className="text-yellow-400 mb-3">★★★★★</div>
                <p className="text-sm text-gray-700 leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role} · {t.city}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dual CTA ── */}
      <section className="py-16 px-4 bg-nomad-navy text-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl font-bold mb-3">{t('ctaLandlordTitle')}</h2>
              <p className="text-blue-200 text-sm leading-relaxed mb-5">
                {t('ctaLandlordDesc')}
              </p>
              <Link href="/auth/register" className="bg-yellow-400 text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-colors inline-block text-sm">
                {t('ctaListFree')}
              </Link>
            </div>
            <div className="border-t md:border-t-0 md:border-l border-white/20 md:pl-8 pt-6 md:pt-0">
              <h2 className="text-2xl font-bold mb-3">{t('ctaTenantTitle')}</h2>
              <p className="text-blue-200 text-sm leading-relaxed mb-5">
                {t('ctaTenantDesc')}
              </p>
              <Link href="/listings" className="bg-white text-nomad-navy font-bold px-6 py-3 rounded-xl hover:bg-gray-100 transition-colors inline-block text-sm">
                {t('ctaSearchNow')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
