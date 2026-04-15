import type { MetadataRoute } from 'next';
import { getServerLocale } from '@/i18n/request';

/**
 * Web App Manifest — NomadNest Taiwan
 *
 * 改善項目：
 *  - locale-aware：shortcuts / description 依使用者 cookie 語系回傳
 *  - id 欄位：確保跨 URL PWA 身份識別一致
 *  - display_override：桌面版 Window Controls Overlay → standalone fallback
 *  - prefer_related_applications: false：優先推薦自家 PWA 安裝
 *  - theme_color 統一為 #0f2033（與 layout.tsx metadata 一致）
 *  - start_url 加 ?source=pwa 供 Analytics 追蹤安裝來源
 *  - shortcuts 新增「訊息中心」第三個快捷入口
 *  - 移除 screenshots: []（空陣列在部分 PWA 驗證器會產生警告）
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getServerLocale();
  const isEn   = locale === 'en';

  return {
    // ── 身份識別 ──────────────────────────────────────────────────────────────
    id:         '/',
    name:       'NomadNest Taiwan',
    short_name: 'NomadNest',
    description: isEn
      ? "Taiwan's #1 rental platform for digital nomads — verified Wi-Fi, foreigner-friendly, mid-to-long stays"
      : '台灣數位游牧者的租屋媒合平台 — Wi-Fi 保證、中長租、外籍友善、線上申請',

    // ── 顯示設定 ─────────────────────────────────────────────────────────────
    start_url:        '/?source=pwa',
    scope:            '/',
    /**
     * display_override：瀏覽器依序嘗試支援的模式
     *   1. window-controls-overlay — 桌面版 PWA 標題列整合（Chromium 支援）
     *   2. standalone              — 全螢幕 App 體驗（主流支援）
     *   3. minimal-ui              — 最小瀏覽器 UI fallback
     */
    display:          'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    orientation:      'portrait-primary',

    // ── 顏色（與 layout.tsx metadata['theme-color'] 保持一致）──────────────
    background_color: '#ffffff',
    theme_color:      '#0f2033',

    // ── 語系與方向 ───────────────────────────────────────────────────────────
    lang: locale,
    dir:  'ltr',

    // ── 分類 ─────────────────────────────────────────────────────────────────
    categories: ['lifestyle', 'travel', 'productivity'],

    // 明確告知瀏覽器優先推薦安裝自家 PWA，不跳轉到應用商店
    prefer_related_applications: false,

    // ── 圖示（含 maskable，用於圓角遮罩環境）────────────────────────────────
    icons: [
      { src: '/icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png' },
      { src: '/icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png' },
      { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
      { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { src: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png' },
      // any：正常顯示（背景透明，用於 Android 啟動器 adaptive icon）
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      // maskable：安全區域內包含 icon（20% padding），用於圓形遮罩平台
      // TODO: 如需完美 maskable 體驗，建議製作獨立的 icon-192x192-maskable.png
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],

    // ── Shortcuts（主畫面長按 → 快捷選單，依語系）────────────────────────
    shortcuts: [
      {
        name:        isEn ? 'Browse Listings'                         : '瀏覽房源',
        short_name:  isEn ? 'Listings'                                : '房源列表',
        description: isEn ? 'Browse all available nomad-friendly rentals' : '快速瀏覽所有可租房源',
        url:         '/listings?source=shortcut',
        icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
      },
      {
        name:        isEn ? 'Messages'                  : '訊息中心',
        short_name:  isEn ? 'Inbox'                     : '訊息',
        description: isEn ? 'Check your latest messages' : '查看最新訊息',
        url:         '/messages?source=shortcut',
        icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
      },
      {
        name:        isEn ? 'My Account'                              : '我的帳號',
        short_name:  isEn ? 'Account'                                 : '帳號',
        description: isEn ? 'View applications and profile settings'  : '查看申請狀態與個人資料',
        url:         '/dashboard?source=shortcut',
        icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
      },
    ],
  };
}
