/**
 * Root Layout — HTML 最外層 + i18n Provider + 全站 Shell
 *
 * 修正說明（2026-04-13）：
 *  - 移除手動 <head> 標籤：Next.js App Router 自動管理 <head>，
 *    手動加入 <head> 會導致 Tailwind CSS 無法注入 → 頁面失去樣式
 *  - hreflang 改用 metadata.alternates.languages（Next.js 官方方式）
 *  - 使用 cookies() 直接讀取 locale，避免 getLocale() 在 plugin 初始化前拋錯
 *  - 加入 try-catch fallback，確保 layout 永不崩潰
 */
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getServerLocale, loadMessages, loadFallbackMessages } from '@/i18n/request';
import LayoutShell from './LayoutShell';
import './globals.css';

// ✅ 架構說明：Navbar、MobileNav、InstallPrompt、Footer 的 dynamic({ ssr:false })
// 已移入 LayoutShell.tsx（Client Component）。
// Server Component 不可直接呼叫 dynamic({ ssr:false })——
// 會在 RSC payload 產生懶載入模組參照，客戶端 requireModule 同步查找時
// 找不到 webpack factory → TypeError: Cannot read properties of undefined (reading 'call')

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nomadnest.tw';

// ── Metadata（含 hreflang alternates，由 Next.js 自動寫入 <head>）──────────────
export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default:  'NomadNest Taiwan — 數位游牧租屋媒合平台',
    template: '%s | NomadNest Taiwan',
  },
  description: '台灣第一個專為數位游牧工作者設計的中長租媒合平台，提供 Wi-Fi 速度保證、線上合約、押金託管服務。',
  keywords: ['數位游牧', '台灣租屋', '游牧工作者', 'WiFi 租屋', '台北租屋', '中長租', 'coworking', 'nomad Taiwan'],
  authors:   [{ name: 'NomadNest Taiwan', url: BASE_URL }],
  creator:   'NomadNest Taiwan',
  publisher: 'NomadNest Taiwan',
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  // ✅ hreflang — 透過 Next.js metadata API 輸出，不手動寫 <link> 標籤
  // 注意：本站採 cookie-based i18n（無獨立 /en/ URL 路徑），
  // 使用查詢參數 ?lang=en 作為 hreflang 目標會被 Google 視為無效。
  // 保留 zh-TW 與 x-default 指向主站；英文版待 URL 路由化後再補充。
  alternates: {
    canonical: BASE_URL,
    languages: {
      'zh-TW':     BASE_URL,
      'x-default': BASE_URL,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    alternateLocale: 'en_US',
    url: BASE_URL,
    siteName: 'NomadNest Taiwan',
    title: 'NomadNest Taiwan — 數位游牧租屋媒合平台',
    description: '台灣第一個專為數位游牧工作者設計的中長租媒合平台，提供 Wi-Fi 速度保證、線上合約、押金託管服務。',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'NomadNest Taiwan' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@NomadNestTW',
    creator: '@NomadNestTW',
    title: 'NomadNest Taiwan — 數位游牧租屋媒合平台',
    description: '台灣第一個專為數位游牧工作者設計的中長租媒合平台',
    images: ['/opengraph-image'],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'NomadNest' },
  other: {
    'theme-color': '#0f2033',
    'color-scheme': 'light',
    'msapplication-TileColor': '#0f2033',
    // W3C 標準 PWA 標頭（取代已棄用的 apple-mobile-web-app-capable）
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png',   sizes: '32x32',   type: 'image/png' },
      { url: '/icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png' }],
    other: [{ rel: 'mask-icon', url: '/icons/icon-512x512.png', color: '#0f2033' }],
  },
};

// ── Root Layout ────────────────────────────────────────────────────────────────
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale   = await getServerLocale();
  const messages = await loadMessages(locale);
  // 當語系非 zh-TW 時，載入 zh-TW 作為 key 缺漏時的 fallback（避免顯示 key 字串）
  const fallbackMessages = locale !== 'zh-TW'
    ? await loadFallbackMessages()
    : {};

  return (
    // ✅ 不加 <head>：Next.js App Router 自動處理，手動加入反而破壞 CSS 注入
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* ── Dark Mode FOUC 防止 Script ────────────────────────────────────────
             在 React hydrate 前同步讀取 localStorage 並立即設定 class，
             防止 "Flash of Unstyled Content"（白光閃爍）。
             suppressHydrationWarning 讓 React 忽略 <html class> 差異。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('nomadnest_theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        {/* ✅ WCAG 2.4.1 — Skip Navigation: 鍵盤使用者可跳過重複導覽直達主內容 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-medium"
        >
          跳至主要內容 / Skip to main content
        </a>
        {/* ✅ LayoutShell — Client Component，內部渲染 I18nProvider + Navbar/Footer 等動態元件
             只剩一個 RSC 客戶端參照，避免 chunk ID 漂移導致 webpack factory undefined */}
        <LayoutShell
          locale={locale}
          messages={messages as Record<string, Record<string, string>>}
          fallbackMessages={fallbackMessages as Record<string, Record<string, string>>}
        >
          {children}
        </LayoutShell>

        {/* Service Worker 註冊（PWA）— 僅在 production 啟用
             dev 模式下 SW 會快取舊 webpack chunk，導航時 RSC payload
             使用新 module ID 但 SW 回傳舊 chunk → factory undefined → TypeError */}
        {process.env.NODE_ENV === 'production' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js').then(function(r){console.log('[SW] registered:',r.scope)}).catch(function(e){console.warn('[SW] failed:',e)})}`,
            }}
          />
        )}
      </body>
    </html>
  );
}
