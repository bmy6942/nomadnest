import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '隱私政策 — NomadNest Taiwan',
  description: 'NomadNest Taiwan 隱私政策，說明我們如何收集、使用及保護您的個人資料。',
};

const SECTIONS = [
  {
    title: '一、資料控管者',
    content: `NomadNest Taiwan（以下簡稱「本平台」或「我們」）為您個人資料之資料控管者，依據中華民國《個人資料保護法》及相關法規處理您的個人資料。`,
  },
  {
    title: '二、我們收集的資料',
    content: `當您使用本平台時，我們可能收集以下資料：

【您主動提供的資料】
• 帳號資料：姓名、電子郵件、電話號碼、LINE ID
• 房源資料：地址、照片、房源描述
• 交易資料：申請紀錄、看房預約、訊息往來
• 身份驗證文件：身分證、護照圖片（僅供審核用途）

【自動收集的資料】
• 使用紀錄：頁面瀏覽、搜尋紀錄、房源點擊
• 裝置資訊：瀏覽器類型、作業系統、IP 位址`,
  },
  {
    title: '三、資料使用目的',
    content: `我們使用您的個人資料用於以下目的：

• 提供、維護及改善平台服務
• 媒合房東與租客的租賃需求
• 傳送服務相關通知（申請更新、預約確認等）
• 處理身份驗證申請
• 偵測及防範詐騙、濫用行為
• 分析使用行為以優化平台體驗
• 遵守法律義務`,
  },
  {
    title: '四、資料分享與揭露',
    content: `我們不會販售您的個人資料給第三方。我們僅在以下情況下分享資料：

• 媒合用途：申請通過後，將您的聯絡方式提供給房東/租客
• 法律要求：依法院命令或主管機關要求配合揭露
• 服務供應商：委託處理技術服務的第三方（如雲端儲存），均受保密協議約束
• 企業異動：在合併、收購等情況下，資料可能移轉至新的資料控管者`,
  },
  {
    title: '五、Cookie 與追蹤技術',
    content: `本平台使用 Cookie 及類似技術以維持登入狀態、記住使用偏好及分析使用行為。

• 必要性 Cookie：維持基本功能運作，無法停用
• 分析 Cookie：協助我們了解用戶如何使用平台

您可以透過瀏覽器設定管理 Cookie，但關閉 Cookie 可能影響部分功能的正常使用。`,
  },
  {
    title: '六、資料安全',
    content: `我們採取以下措施保護您的個人資料：

• 密碼採用 bcrypt 雜湊加密儲存，絕不明文保存
• 資料傳輸使用 HTTPS 加密
• 定期進行安全性審查
• 限制內部人員存取權限

然而，網際網路傳輸並非百分之百安全。如發現資料外洩，我們將依法定期限通知受影響用戶。`,
  },
  {
    title: '七、您的權利',
    content: `依據個人資料保護法，您享有以下權利：

• 查詢及閱覽：您可要求查看我們持有的個人資料
• 補充或更正：如資料有誤，您可要求更正
• 停止收集、處理或利用：在特定情況下，您可要求停止處理
• 刪除：您可要求刪除個人資料（法律保存義務範圍除外）

如欲行使上述權利，請聯絡 support@nomadnest.tw。我們將於 30 日內回覆。`,
  },
  {
    title: '八、資料保存期間',
    content: `• 帳號資料：帳號存續期間，以及帳號刪除後 1 年（以處理潛在糾紛）
• 交易紀錄：依稅務及法律要求保存
• 身份驗證文件：審核完成後 6 個月
• 日誌資料：90 天`,
  },
  {
    title: '九、未成年人',
    content: `本平台不針對 18 歲以下未成年人提供服務。如我們得知收集了未成年人的個人資料，將立即刪除相關資料。`,
  },
  {
    title: '十、隱私政策更新',
    content: `我們可能隨時更新本隱私政策。重大變更將透過平台公告或電子郵件通知。繼續使用本平台服務即視為同意更新後的隱私政策。`,
  },
];

export default function PrivacyPage() {
  const lastUpdated = '2026 年 1 月 1 日';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="text-blue-600 hover:underline text-sm">← 返回首頁</Link>
        <h1 className="text-3xl font-bold text-nomad-navy mt-4 mb-2">隱私政策</h1>
        <p className="text-gray-500 text-sm">最後更新：{lastUpdated}</p>
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          🔒 我們重視您的隱私。本政策說明我們如何收集、使用及保護您的個人資料，請詳細閱讀。
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

      {/* Contact */}
      <div className="mt-10 bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-800 mb-2">聯絡我們</h3>
        <p className="text-sm text-gray-600">
          如對本隱私政策有任何疑問，或希望行使您的個人資料權利，請透過以下方式聯絡我們：
        </p>
        <p className="text-sm text-blue-600 mt-2">📧 support@nomadnest.tw</p>
      </div>

      {/* Footer links */}
      <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3 text-sm">
        <Link href="/terms" className="text-blue-600 hover:underline">服務條款</Link>
        <span className="text-gray-300 hidden sm:block">|</span>
        <Link href="/" className="text-blue-600 hover:underline">返回首頁</Link>
      </div>
    </div>
  );
}
