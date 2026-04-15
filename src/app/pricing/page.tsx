import Link from 'next/link';
import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: '定價方案 — NomadNest Taiwan | Beta 階段免費',
  description: 'NomadNest Beta 階段對房東完全免費。了解我們的商業模式、未來收費規劃，以及平台如何保持對用戶的公平承諾。',
  alternates: { canonical: `${BASE_URL}/pricing` },
  openGraph: {
    type: 'website',
    url: `${BASE_URL}/pricing`,
    title: '定價方案 — NomadNest Taiwan',
    description: 'Beta 階段完全免費，無抽成、無隱藏費用。',
  },
};

// ── Plan data ──────────────────────────────────────────────────────────────────

const TENANT_FEATURES = [
  { ok: true,  text: '瀏覽所有上架房源' },
  { ok: true,  text: 'Wi-Fi 速度 & 工作環境篩選' },
  { ok: true,  text: '站內訊息系統（與房東直接溝通）' },
  { ok: true,  text: '申請入住 & 電子合約' },
  { ok: true,  text: '收藏清單 & 對比功能' },
  { ok: true,  text: 'Nomad Score 游牧評分查看' },
  { ok: true,  text: '評論 & 評分系統' },
  { ok: false, text: '付費推薦置頂（房東方案）' },
];

const LANDLORD_BETA_FEATURES = [
  { ok: true,  text: '刊登無上限房源數' },
  { ok: true,  text: '房源儀表板（瀏覽 / 收藏 / 詢問統計）' },
  { ok: true,  text: '站內訊息 & 申請管理' },
  { ok: true,  text: '電子合約生成' },
  { ok: true,  text: '「已驗證房東」徽章申請' },
  { ok: true,  text: '搜尋結果自然排序曝光' },
  { ok: false, text: '付費置頂排名（正式版功能）' },
  { ok: false, text: '數據分析進階報表（正式版）' },
];

const FUTURE_PLANS = [
  {
    name: '房東 · 基本版',
    price: '免費',
    priceNote: '永久',
    highlight: false,
    features: [
      '最多 3 個房源',
      '自然搜尋排序',
      '基本數據儀表板',
      '站內訊息 & 電子合約',
    ],
    cta: '立即加入（目前免費）',
    href: '/auth/register?role=landlord',
  },
  {
    name: '房東 · 專業版',
    price: 'NT$299',
    priceNote: '/ 月（預估，正式版）',
    highlight: true,
    features: [
      '無上限房源刊登',
      '搜尋結果優先顯示',
      '進階數據報表 & 趨勢分析',
      '驗證徽章 + 優先審核',
      '多房源批次管理',
    ],
    cta: '加入候補名單',
    href: '/auth/register?role=landlord',
  },
  {
    name: '企業 / 機構',
    price: '洽詢定價',
    priceNote: '依需求客製',
    highlight: false,
    features: [
      '無上限房源 + 多帳號管理',
      'API 串接 & 數據匯出',
      '專屬客服與上架協助',
      '聯名品牌合作',
    ],
    cta: '聯繫商務合作',
    href: 'mailto:hello@nomadnest.tw',
  },
];

const FAQS = [
  {
    q: 'Beta 階段真的完全免費嗎？',
    a: '是的。目前所有房東功能（含無限刊登）全部免費，不需要信用卡。我們希望先建立房源生態，再引入商業化機制，不想在平台成熟前讓房東承擔成本。',
  },
  {
    q: '正式收費後，現有房東會受影響嗎？',
    a: '正式收費前，我們會提前至少 60 天公告。Beta 期間加入的房東將享有「創始房東」優惠，細節上線前公布，但你的利益一定在我們的首要考量中。',
  },
  {
    q: '平台從哪裡賺錢？',
    a: '長期商業模式為：①房東訂閱方案（基本版免費，進階版付費）②成交服務費（按租賃成交金額抽取小比例）③企業合作。我們不賣用戶數據，不顯示廣告。',
  },
  {
    q: '租客需要付費嗎？',
    a: '不需要。租客使用所有功能永遠免費，包括搜尋、申請、訊息、電子合約。我們相信降低租客門檻，才能為房東帶來更多優質詢問。',
  },
  {
    q: '押金托管收費嗎？',
    a: '押金托管功能（開發中）計劃以極低手續費運作（類似信用卡預授權），具體費率確定後會在上線前公告。保障雙方安全是此機制的核心目的，不是獲利工具。',
  },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ══════ HERO ══════ */}
      <section className="bg-gradient-to-br from-nomad-navy to-blue-700 text-white py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <span className="inline-block bg-green-400 text-green-900 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5">
            🎉 Beta 階段 — 房東完全免費
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            簡單透明的定價，<br />
            <span className="text-blue-300">沒有隱藏費用</span>
          </h1>
          <p className="text-blue-100 text-base leading-relaxed mb-8">
            我們相信定價應該透明。Beta 階段免費不是行銷話術——
            我們就是想先把平台做好，再談商業模式。
          </p>
          <Link
            href="/auth/register"
            className="bg-white text-nomad-navy font-bold px-8 py-3 rounded-xl hover:bg-blue-50 transition-colors inline-block">
            免費開始使用
          </Link>
        </div>
      </section>

      {/* ══════ CURRENT PLANS: Tenant vs Landlord ══════ */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900">目前方案一覽</h2>
            <p className="text-gray-500 mt-2 text-sm">Beta 階段所有功能全面開放</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Tenant plan */}
            <div className="border border-gray-100 rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🧳</span>
                <div>
                  <div className="font-bold text-gray-900 text-lg">租客 / 游牧者</div>
                  <div className="text-green-600 font-bold">永久免費</div>
                </div>
              </div>
              <ul className="space-y-3">
                {TENANT_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <span className={f.ok ? 'text-green-500 shrink-0' : 'text-gray-300 shrink-0'}>
                      {f.ok ? '✓' : '✕'}
                    </span>
                    <span className={f.ok ? 'text-gray-700' : 'text-gray-400'}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?role=tenant" className="btn-secondary w-full mt-8 py-3 block text-center">
                免費註冊租客帳號
              </Link>
            </div>

            {/* Landlord Beta plan */}
            <div className="border-2 border-blue-600 rounded-2xl p-8 shadow-md relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                🎉 Beta 限時免費
              </div>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🏠</span>
                <div>
                  <div className="font-bold text-gray-900 text-lg">房東 / 物業方</div>
                  <div className="text-blue-600 font-bold">Beta 期間免費</div>
                </div>
              </div>
              <ul className="space-y-3">
                {LANDLORD_BETA_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <span className={f.ok ? 'text-blue-500 shrink-0' : 'text-gray-300 shrink-0'}>
                      {f.ok ? '✓' : '—'}
                    </span>
                    <span className={f.ok ? 'text-gray-700' : 'text-gray-400'}>{f.text}</span>
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?role=landlord" className="btn-primary w-full mt-8 py-3 block text-center">
                🚀 免費開始刊登
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ FUTURE ROADMAP PLANS ══════ */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 block">
              正式版規劃（預覽，尚未開放）
            </span>
            <h2 className="text-2xl font-bold text-gray-900">未來方案預覽</h2>
            <p className="text-gray-500 mt-2 text-sm max-w-lg mx-auto">
              以下為正式版計劃方向，細節仍在規劃中。Beta 創始用戶將享有優惠資格。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {FUTURE_PLANS.map(plan => (
              <div
                key={plan.name}
                className={`rounded-2xl p-7 flex flex-col ${
                  plan.highlight
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 scale-[1.02]'
                    : 'bg-white border border-gray-100 shadow-sm text-gray-900'
                }`}>
                <div className="mb-4">
                  <div className={`font-bold text-lg mb-1 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                    {plan.name}
                  </div>
                  <div className={`text-3xl font-bold mb-0.5 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                    {plan.price}
                  </div>
                  <div className={`text-xs ${plan.highlight ? 'text-blue-200' : 'text-gray-400'}`}>
                    {plan.priceNote}
                  </div>
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm ${plan.highlight ? 'text-blue-100' : 'text-gray-600'}`}>
                      <span className={`shrink-0 ${plan.highlight ? 'text-blue-300' : 'text-blue-500'}`}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  className={`block text-center py-3 rounded-xl font-bold text-sm transition-colors ${
                    plan.highlight
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
                  }`}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 mt-8">
            * 正式收費前至少 60 天公告，Beta 期間加入的房東享有創始用戶優惠。價格僅供參考，可能調整。
          </p>
        </div>
      </section>

      {/* ══════ BUSINESS MODEL ══════ */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">我們怎麼維持運營？</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-lg mx-auto">
            我們承諾永遠不賣用戶數據，不投放廣告。平台收入完全來自為用戶創造真實價值的服務。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
            {[
              {
                icon: '📋',
                title: '房東訂閱方案',
                desc: '基本版免費，進階功能（數據報表、優先排名）採月訂閱。大多數房東的基本需求都在免費版滿足。',
              },
              {
                icon: '🤝',
                title: '成交服務費',
                desc: '租賃成功後按月租金抽取小比例（計劃 2-3%），直到中期目標實現後逐步降低。',
              },
              {
                icon: '🏢',
                title: '企業合作',
                desc: '與共享辦公室、跨國企業遠端員工安置計劃、數位游牧社群合作，提供 B2B 解決方案。',
              },
            ].map(m => (
              <div key={m.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
                <div className="text-2xl mb-3">{m.icon}</div>
                <div className="font-bold text-gray-900 mb-1.5 text-sm">{m.title}</div>
                <p className="text-xs text-gray-500 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">定價常見問題</h2>
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <details
                key={i}
                className="group bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none">
                  <span className="font-semibold text-gray-900 text-sm pr-4">{faq.q}</span>
                  <svg
                    aria-hidden="true"
                    className="w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 group-open:rotate-180"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-5">
                  <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ CTA ══════ */}
      <section className="py-16 px-6 bg-nomad-navy text-white text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">現在加入，永遠免費起步</h2>
          <p className="text-blue-200 text-sm mb-8">
            Beta 期間完全免費，不需信用卡。正式收費前 60 天公告，你可以隨時決定是否繼續。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/register?role=landlord" className="bg-yellow-400 text-gray-900 font-bold px-8 py-3 rounded-xl hover:bg-yellow-300 transition-colors inline-block text-sm">
              🏠 我是房東，免費刊登
            </Link>
            <Link href="/listings" className="border border-white/40 text-white font-medium px-8 py-3 rounded-xl hover:bg-white/10 transition-colors inline-block text-sm">
              🧳 我是租客，看看房源
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
