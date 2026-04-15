import Link from 'next/link';
import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: '房東招商 — NomadNest Taiwan | 讓閒置空間月入不停',
  description: '加入 NomadNest，將你的空間租給穩定付費的數位游牧工作者。免仲介費、線上合約、押金保障，30 分鐘完成刊登。',
  alternates: { canonical: `${BASE_URL}/for-landlords` },
  openGraph: {
    type: 'website',
    url: `${BASE_URL}/for-landlords`,
    title: '房東招商 — NomadNest Taiwan',
    description: '加入 NomadNest，將你的空間租給穩定付費的數位游牧工作者。免仲介費、線上合約、押金保障。',
  },
};

// ── Static data ────────────────────────────────────────────────────────────────

const BENEFITS = [
  {
    icon: '💰',
    title: '穩定月租收入',
    desc: '數位游牧工作者偏好 1–6 個月的中期租約，比短租更穩定、比長租更彈性。減少空租期，收入更可預測。',
  },
  {
    icon: '📋',
    title: '線上合約 & 押金保障',
    desc: '平台提供電子合約模板與押金第三方托管機制，租客入住前確認付款，保護你的財產安全。',
  },
  {
    icon: '🌏',
    title: '接觸高素質國際租客',
    desc: '我們的租客多為遠端工作者、創業者與自由職業者，收入穩定、愛護環境，且能接受英文溝通。',
  },
  {
    icon: '📊',
    title: '房源分析儀表板',
    desc: '即時查看瀏覽次數、收藏數、詢問率。了解哪些設施最吸引租客，持續優化你的出租條件。',
  },
  {
    icon: '✅',
    title: '已驗證身份徽章',
    desc: '完成身份驗證的房東享有「已驗證」標章，在搜尋結果中優先曝光，建立租客信任感。',
  },
  {
    icon: '🔒',
    title: '零仲介費用',
    desc: '直接與租客溝通，無需支付任何仲介抽成。平台採透明訂閱制，你的每一分收益都是你的。',
  },
];

const STEPS = [
  {
    step: '01',
    title: '建立帳號並驗證身份',
    desc: '填寫基本資料、上傳身份證件，完成驗證後取得「已驗證房東」徽章，提升租客信任度。',
    time: '約 5 分鐘',
  },
  {
    step: '02',
    title: '刊登你的空間',
    desc: '填寫房源資訊、上傳照片、設定 Wi-Fi 速度、可入住日期與租金。系統提供欄位引導，不會漏填。',
    time: '約 15–20 分鐘',
  },
  {
    step: '03',
    title: '審核通過，開始接租',
    desc: '平台在 24 小時內完成審核。上架後即出現在搜尋結果中，租客可直接申請入住並發送訊息。',
    time: '24 小時內',
  },
  {
    step: '04',
    title: '確認租客、簽約收款',
    desc: '收到申請後在儀表板審核租客資料，同意後線上完成合約簽署，押金與首月租金安全入帳。',
    time: '隨時管理',
  },
];

const STATS = [
  { value: '4,200+', label: '全球數位游牧工作者造訪台灣（2024）' },
  { value: '65%', label: '游牧工作者偏好中期租約（1–6 個月）' },
  { value: 'NT$28,000', label: '台北市游牧友善房源平均月租' },
  { value: '3.2×', label: '驗證房東的詢問率是未驗證房東的 3.2 倍' },
];

const FAQS = [
  {
    q: '我需要是合法房東才能刊登嗎？',
    a: '是的，刊登房源即表示您是該空間的合法持有者或擁有轉租授權。平台會要求身份驗證，但不強制要求「包租公/媽」執照。如您不確定自身情況，建議諮詢法律專業人士。',
  },
  {
    q: '平台收取什麼費用？',
    a: '目前 Beta 階段對房東完全免費。正式上線後將採取透明的按成交收費模式或輕量訂閱方案，詳情上線前會提前公告。',
  },
  {
    q: '租客不付款怎麼辦？',
    a: '平台透過押金托管機制保護您。租客在申請被接受前需完成押金預授權，入住後才正式扣款。若發生糾紛，平台提供調解流程並有專人協助。',
  },
  {
    q: '我的空間需要達到什麼標準？',
    a: '基本要求：有穩定 Wi-Fi（建議 ≥ 50 Mbps）、乾淨整潔的私人或共用空間、合法居住用途。其他設施（辦公桌、獨立浴室等）越完善，吸引到的租客品質越高、詢問率越好。',
  },
  {
    q: '外國房客會有溝通障礙嗎？',
    a: '平台介面支援繁中與英文，訊息系統也提供翻譯輔助功能（開發中）。大多數數位游牧工作者具備基礎日常英文，且目前大多數來台工作者也習慣使用翻譯 App 溝通。',
  },
  {
    q: '一個帳號可以刊登多個房源嗎？',
    a: '可以！房東帳號不限刊登數量，所有房源都在同一個儀表板集中管理，方便追蹤各房源的詢問、申請與收益狀況。',
  },
];

const FEATURES = [
  { icon: '📱', label: '手機友善介面，隨時管理' },
  { icon: '🔔', label: '即時推播：新詢問 / 新申請' },
  { icon: '📄', label: '電子合約，無需紙本' },
  { icon: '📸', label: '多張照片上傳 & 順序拖拉' },
  { icon: '🗓️', label: '可入住日期與最短租期設定' },
  { icon: '💬', label: '平台內建訊息系統' },
  { icon: '⭐', label: '租後評價累積口碑' },
  { icon: '📊', label: '瀏覽 / 收藏 / 申請數據報表' },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ForLandlordsPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-nomad-navy via-blue-800 to-indigo-900 text-white">
        {/* Decorative circles */}
        <div aria-hidden="true" className="absolute -top-32 -right-32 w-96 h-96 bg-white/5 rounded-full" />
        <div aria-hidden="true" className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/5 rounded-full" />

        <div className="relative max-w-5xl mx-auto px-6 py-24 md:py-32 text-center">
          {/* Label */}
          <span className="inline-block bg-white/15 border border-white/25 text-white text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full mb-6">
            🏠 NomadNest 房東招商計劃
          </span>

          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            讓閒置空間，<br />
            <span className="text-blue-300">成為游牧者的家</span>
          </h1>

          <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            數千名數位游牧工作者正在台灣尋找中期租屋。
            把你的空間刊登在 NomadNest，接觸高素質、穩定付款的租客，
            <strong className="text-white"> 30 分鐘完成刊登，免仲介費</strong>。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-14">
            <Link
              href="/auth/register?role=landlord"
              className="bg-white text-nomad-navy font-bold px-8 py-4 rounded-xl text-base hover:bg-blue-50 transition-colors shadow-lg shadow-black/20">
              🚀 免費開始刊登房源
            </Link>
            <a
              href="#how-it-works"
              className="border border-white/40 text-white font-medium px-8 py-4 rounded-xl text-base hover:bg-white/10 transition-colors">
              了解刊登流程 ↓
            </a>
          </div>

          {/* Quick trust signals */}
          <div className="flex flex-wrap gap-6 justify-center text-sm text-blue-200">
            {['✅ 零仲介費', '🔒 押金托管保障', '📋 電子合約', '⚡ 24hr 審核上架'].map(t => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          MARKET STATS
      ════════════════════════════════════════ */}
      <section className="bg-blue-50 border-y border-blue-100 py-14">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-sm font-semibold text-blue-600 uppercase tracking-widest mb-10">
            台灣數位游牧市場數據
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-nomad-navy mb-2">{s.value}</div>
                <div className="text-sm text-gray-500 leading-snug">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-8">
            * 數據來源：Nomad List、台灣觀光局、NomadNest 平台內部統計（2024）
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════
          BENEFITS
      ════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">為什麼選擇 NomadNest？</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              我們專為數位游牧租屋設計，房東享有比一般租屋平台更完善的保障與工具。
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map(b => (
              <div
                key={b.title}
                className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-3xl mb-4">{b.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2 text-base">{b.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════════════ */}
      <section id="how-it-works" className="bg-gray-50 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">刊登流程，四步搞定</h2>
            <p className="text-gray-500">從建立帳號到接到第一筆租金，整個流程清楚透明。</p>
          </div>

          <div className="space-y-5">
            {STEPS.map((s, i) => (
              <div
                key={s.step}
                className="flex gap-6 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm items-start">
                {/* Step number */}
                <div className="shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                  {s.step}
                </div>
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-gray-900">{s.title}</h3>
                    <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full font-medium shrink-0">
                      {s.time}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/auth/register?role=landlord"
              className="btn-primary px-8 py-3 text-base inline-block">
              立即免費刊登 →
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          PLATFORM FEATURES
      ════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">房東專屬功能</h2>
            <p className="text-gray-500">一個儀表板管理所有事務，省時省力。</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURES.map(f => (
              <div
                key={f.label}
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <span className="text-2xl shrink-0">{f.icon}</span>
                <span className="text-sm text-gray-700 font-medium leading-snug">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SOCIAL PROOF — LANDLORD TYPES
      ════════════════════════════════════════ */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            哪些空間最受游牧工作者青睞？
          </h2>
          <p className="text-blue-200 mb-10 max-w-2xl mx-auto">
            只要有穩定網路與辦公環境，各種類型的空間都有市場。
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🏢', label: '獨立套房', note: '最受歡迎' },
              { icon: '🏡', label: '整層公寓', note: '高單價' },
              { icon: '🛏️', label: '雅房 / 分租', note: '高詢問率' },
              { icon: '🏨', label: '短租月租混合', note: '彈性定價' },
            ].map(t => (
              <div key={t.label} className="bg-white/10 border border-white/20 rounded-2xl p-5">
                <div className="text-3xl mb-2">{t.icon}</div>
                <div className="font-bold text-white text-sm mb-0.5">{t.label}</div>
                <div className="text-xs text-blue-200">{t.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FAQ
      ════════════════════════════════════════ */}
      <section className="py-20 px-6" id="faq">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">常見問題</h2>
            <p className="text-gray-500">還有疑問？歡迎透過訊息直接聯繫我們。</p>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <details
                key={i}
                className="group bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none">
                  <span className="font-semibold text-gray-900 text-sm md:text-base pr-4">
                    {faq.q}
                  </span>
                  {/* Chevron via CSS */}
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

      {/* ════════════════════════════════════════
          FINAL CTA
      ════════════════════════════════════════ */}
      <section className="bg-gray-950 text-white py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-5xl mb-6">🏡</div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            準備好迎接你的第一位<br />游牧房客了嗎？
          </h2>
          <p className="text-gray-400 mb-10 text-base leading-relaxed">
            Beta 階段免費刊登，不限房源數量。<br />
            立即加入，在台灣數位游牧社群建立你的品牌。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register?role=landlord"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-10 py-4 rounded-xl text-base transition-colors shadow-lg shadow-blue-900/40">
              🚀 免費開始刊登
            </Link>
            <Link
              href="/listings"
              className="border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white font-medium px-10 py-4 rounded-xl text-base transition-colors">
              先看看其他房源 →
            </Link>
          </div>
          <p className="text-gray-600 text-xs mt-8">
            不需要信用卡 · Beta 階段完全免費 · 隨時可以下架房源
          </p>
        </div>
      </section>

    </div>
  );
}
