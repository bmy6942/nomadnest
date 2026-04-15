import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '服務條款 — NomadNest Taiwan',
  description: 'NomadNest Taiwan 服務條款，請於使用平台前詳細閱讀。',
};

const SECTIONS = [
  {
    title: '第一條　服務說明',
    content: `NomadNest Taiwan（以下簡稱「本平台」）為數位游牧工作者提供租屋資訊媒合服務，包括但不限於房源刊登、租屋搜尋、線上申請、看房預約及雙方訊息往來等功能。

本平台係媒合服務平台，並非租賃契約之當事人。租賃關係之成立、履行及爭議，均由房東與租客雙方自行承擔法律責任。`,
  },
  {
    title: '第二條　會員資格與帳號安全',
    content: `使用本平台服務，您須完成會員註冊並提供正確、完整之個人資料。您有責任維護帳號密碼之保密性，不得轉讓或授權他人使用您的帳號。

如發現帳號遭未經授權使用，請立即通知本平台。因帳號保管不當所造成之損失，本平台不負任何責任。`,
  },
  {
    title: '第三條　禁止行為',
    content: `使用本平台服務時，您同意不得從事以下行為：

• 刊登虛假、誤導性或不實之房源資訊
• 以任何方式規避平台交易，要求租客直接匯款至平台外帳戶
• 騷擾、恐嚇或歧視其他會員
• 上傳含有病毒、惡意程式或違法內容之檔案
• 以自動化程式大量存取或爬取平台資料
• 從事任何可能損害本平台或其他用戶權益之行為`,
  },
  {
    title: '第四條　平台安全交易',
    content: `為保障租客及房東雙方之法律權益，本平台強烈建議所有看房預約、租約簽署及金錢往來均透過本平台完成。

本平台對於私下交易所產生之糾紛、損失，不負任何賠償責任。如遭遇詐騙或糾紛，請保留相關證據並向主管機關申訴。`,
  },
  {
    title: '第五條　內容所有權',
    content: `您上傳至本平台之房源圖片、描述文字等內容，您仍保有原始著作權，但您授權本平台在提供服務範圍內使用、展示、複製及傳播前述內容。

本平台之商標、介面設計及軟體程式碼，受智慧財產權法律保護，未經授權不得使用或複製。`,
  },
  {
    title: '第六條　服務中斷與免責聲明',
    content: `本平台保留隨時修改、暫停或終止全部或部分服務之權利，並得在不事先通知的情況下進行系統維護或升級。

本平台對以下情況不負賠償責任：
• 不可抗力因素（天災、戰爭、政府行為等）導致的服務中斷
• 因您違反本服務條款而遭受的損失
• 房東與租客之間的租賃糾紛
• 第三方服務中斷所造成之影響`,
  },
  {
    title: '第七條　條款修改',
    content: `本平台保留隨時修改本服務條款之權利。修改後的條款將公告於本頁面，並以顯著方式通知會員。繼續使用本平台服務即視為同意修改後的條款。`,
  },
  {
    title: '第八條　準據法與管轄',
    content: `本服務條款之解釋及適用，以中華民國法律為準據法。因本服務條款所生之爭議，雙方同意以台灣台北地方法院為第一審管轄法院。`,
  },
];

export default function TermsPage() {
  const lastUpdated = '2026 年 1 月 1 日';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="text-blue-600 hover:underline text-sm">← 返回首頁</Link>
        <h1 className="text-3xl font-bold text-nomad-navy mt-4 mb-2">服務條款</h1>
        <p className="text-gray-500 text-sm">最後更新：{lastUpdated}</p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          📋 請在使用 NomadNest Taiwan 服務前仔細閱讀以下條款。使用本平台即表示您同意遵守這些條款。
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {SECTIONS.map((sec, i) => (
          <section key={i}>
            <h2 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              {sec.title}
            </h2>
            <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
              {sec.content}
            </div>
          </section>
        ))}
      </div>

      {/* Footer links */}
      <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3 text-sm">
        <Link href="/privacy" className="text-blue-600 hover:underline">隱私政策</Link>
        <span className="text-gray-300 hidden sm:block">|</span>
        <Link href="/" className="text-blue-600 hover:underline">返回首頁</Link>
        <span className="text-gray-300 hidden sm:block">|</span>
        <span className="text-gray-500">如有疑問，請聯絡 support@nomadnest.tw</span>
      </div>
    </div>
  );
}
