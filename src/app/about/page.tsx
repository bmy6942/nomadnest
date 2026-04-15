import Link from 'next/link';
import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: '關於我們 — NomadNest Taiwan | 為數位游牧者而生',
  description: 'NomadNest 是台灣第一個專為數位游牧工作者設計的中長期租屋媒合平台。了解我們的故事、使命與價值觀。',
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    type: 'website',
    url: `${BASE_URL}/about`,
    title: '關於我們 — NomadNest Taiwan',
    description: '台灣第一個專為數位游牧工作者設計的中長期租屋媒合平台。',
  },
};

const MILESTONES = [
  { year: '2023 Q3', event: '創始人在花蓮遠端工作三個月，親身經歷找房困境：無法確認 Wi-Fi 速度、語言障礙、短租太貴長租太死。' },
  { year: '2023 Q4', event: '開始訪談 30+ 位台灣遊牧工作者與房東，確認痛點。決定打造一個「真正懂游牧節奏」的租屋平台。' },
  { year: '2024 Q1', event: '完成 MVP 技術驗證，核心功能：Wi-Fi 驗證、外籍友善標示、線上電子合約、押金托管。' },
  { year: '2024 Q2', event: '首批 10 位房東加入 Beta，收錄台北、台中、花蓮精選房源。平台開始對外測試。' },
  { year: '2024 Q3', event: '推出 Onboarding 引導流程、訊息中心、評價系統。累計 50+ 活躍房源，用戶覆蓋 12 個國籍。' },
  { year: '2025 ↗', event: '持續擴大房源覆蓋率，目標 200+ 驗證房源。規劃 Nomad Score 系統、付款整合與共享辦公媒合。' },
];

const VALUES = [
  {
    icon: '🔭',
    title: '游牧者優先',
    desc: '每一個產品決策，我們都先問：「這對遠端工作者有幫助嗎？」而不是「這對平台有利嗎？」。我們相信服務好用戶，平台才能長久。',
  },
  {
    icon: '🔍',
    title: '透明與誠實',
    desc: 'Wi-Fi 速度有實測數字，費用有清楚明細，合約沒有小字。我們拒絕模糊地帶，給房東與租客都值得信賴的平台體驗。',
  },
  {
    icon: '🌏',
    title: '跨文化包容',
    desc: '台灣是東亞游牧者的樞紐。我們相信不同國籍、語言、工作型態的人都應該能輕鬆在台灣生活工作，語言不應該是障礙。',
  },
  {
    icon: '🔧',
    title: '持續迭代',
    desc: '我們是工程師與設計師組成的小團隊，快速試錯、快速修正。用戶的每一個意見回饋，都會進入下一個版本的規劃。',
  },
];

const TEAM = [
  {
    initial: '白',
    name: '白小妹',
    role: '創辦人 & 產品負責人',
    desc: '前端工程師出身，曾在台北、花蓮、清邁分別遠端工作超過 6 個月。因為深刻體驗「找不到好網路的租屋之苦」，決定自己來解決這個問題。',
    color: 'bg-blue-600',
  },
  {
    initial: 'AI',
    name: 'Claude AI',
    role: '首席工程師（AI 輔助開發）',
    desc: 'NomadNest 平台核心功能由 AI 輔助工程大幅加速開發。我們相信善用工具才能以小團隊打造大平台，這也是我們幫用戶省錢、快速迭代的底氣。',
    color: 'bg-indigo-600',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ═══════════ HERO ═══════════ */}
      <section className="bg-gradient-to-br from-nomad-navy to-blue-700 text-white py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-5xl mb-6">🏡</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-5">
            為游牧者而生，<br />
            <span className="text-blue-300">在台灣落地生根</span>
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed max-w-2xl mx-auto">
            NomadNest 是台灣第一個專為數位游牧工作者設計的中長期租屋媒合平台。
            我們相信，擁有好網路、好工作環境、好鄰居，才是真正的游牧自由。
          </p>
        </div>
      </section>

      {/* ═══════════ MISSION ═══════════ */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3 block">我們的使命</span>
              <h2 className="text-3xl font-bold text-gray-900 mb-5">
                讓「在台灣遠端工作」<br />
                成為一件<span className="text-blue-600">簡單的事</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-4">
                全球數位游牧族群正在快速成長，台灣憑藉安全環境、美食文化與相對親民的物價，
                成為越來越多外籍工作者的首選目的地。
              </p>
              <p className="text-gray-500 leading-relaxed mb-4">
                但現實是：租屋流程混亂、Wi-Fi 品質無法確認、中文合約讀不懂、找短租貴，
                長租又綁定太久。這些問題困擾著每一個想在台灣停留 1–6 個月的工作者。
              </p>
              <p className="text-gray-500 leading-relaxed">
                <strong className="text-gray-900">NomadNest 的答案是：</strong>
                建立一個專屬通道——有驗證的 Wi-Fi 速度、有中英文介面、有合理的中期租約、
                有平台保障的電子合約。讓房東與游牧者都能輕鬆、安心地建立連結。
              </p>
            </div>
            {/* Visual: stat cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '4,200+', label: '游牧者造訪台灣', sub: '2024 年估算', color: 'bg-blue-50 border-blue-100' },
                { value: '12+', label: '用戶所屬國籍', sub: 'Beta 階段', color: 'bg-indigo-50 border-indigo-100' },
                { value: '50+', label: '已驗證房源', sub: '台北 / 台中 / 花蓮', color: 'bg-green-50 border-green-100' },
                { value: '< 24h', label: '房源審核時效', sub: '上架最快一天', color: 'bg-orange-50 border-orange-100' },
              ].map(s => (
                <div key={s.label} className={`border rounded-2xl p-5 ${s.color}`}>
                  <div className="text-2xl font-bold text-gray-900 mb-1">{s.value}</div>
                  <div className="text-sm font-medium text-gray-700">{s.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ STORY / MILESTONES ═══════════ */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3 block">平台故事</span>
            <h2 className="text-3xl font-bold text-gray-900">從痛點出發的旅程</h2>
          </div>
          <ol className="relative border-l-2 border-blue-200 pl-8 space-y-8">
            {MILESTONES.map((m, i) => (
              <li key={i} className="relative">
                <div className="absolute -left-[2.15rem] w-4 h-4 bg-blue-600 rounded-full border-4 border-white shadow" />
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2 block">
                    {m.year}
                  </span>
                  <p className="text-sm text-gray-600 leading-relaxed">{m.event}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════ VALUES ═══════════ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3 block">核心價值</span>
            <h2 className="text-3xl font-bold text-gray-900">我們相信的事</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {VALUES.map(v => (
              <div key={v.title} className="flex gap-5 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <div className="text-3xl shrink-0 mt-0.5">{v.icon}</div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">{v.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ TEAM ═══════════ */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3 block">團隊</span>
            <h2 className="text-3xl font-bold text-gray-900">建造者</h2>
            <p className="text-gray-500 mt-3 max-w-lg mx-auto text-sm">
              小團隊、大決心。我們用 AI 輔助開發加速迭代，讓有限資源發揮最大效益。
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {TEAM.map(p => (
              <div key={p.name} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex gap-5 items-start">
                <div className={`w-14 h-14 ${p.color} text-white rounded-full flex items-center justify-center font-bold text-xl shrink-0`}>
                  {p.initial}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{p.name}</div>
                  <div className="text-xs text-blue-600 font-semibold mb-2">{p.role}</div>
                  <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PRESS / CONTACT ═══════════ */}
      <section className="py-16 px-6 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">媒體與合作洽詢</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-lg mx-auto">
            歡迎媒體採訪、投資者洽詢、企業合作提案，以及對台灣游牧生態系有興趣的夥伴聯繫。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:hello@nomadnest.tw"
              className="btn-primary px-8 py-3 inline-block">
              ✉️ 聯繫我們
            </a>
            <Link href="/for-landlords" className="btn-secondary px-8 py-3 inline-block">
              🏠 成為房東夥伴
            </Link>
          </div>
          <p className="text-gray-400 text-xs mt-6">
            我們承諾在 2 個工作天內回覆所有洽詢。
          </p>
        </div>
      </section>

    </div>
  );
}
