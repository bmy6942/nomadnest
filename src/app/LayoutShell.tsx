'use client';
/**
 * LayoutShell — Client Component 佈局殼層（含 I18nProvider）
 *
 * ✅ 架構重點（工程師必讀）：
 *
 * ── 為什麼把 I18nProvider 移入此 Client Component？ ──
 *
 * 原架構（有問題）：
 *   layout.tsx (Server)
 *     └─ <I18nProvider>    ← RSC 客戶端參照 #1  ← 此層是 Lazy
 *          └─ <LayoutShell> ← RSC 客戶端參照 #2  ← 此層是 Lazy，factory 找不到
 *
 * Next.js dev mode on-demand compilation 為不同路由建立獨立 webpack 編譯，
 * 可能造成 LayoutShell / I18nProvider 的 chunk ID 在不同編譯間漂移：
 *   - 首頁載入：LayoutShell chunk ID = A
 *   - 導航 /listings：RSC payload 中 LayoutShell chunk ID = B
 *   - 客戶端 __webpack_modules__[B] 找不到 → options.factory undefined → TypeError
 *
 * ── 修正後架構 ──
 *   layout.tsx (Server)
 *     └─ <LayoutShell locale messages fallbackMessages>
 *           ← 只剩一個 RSC 客戶端參照，chunk ID 漂移機率減半
 *           ← LayoutShell 內部直接渲染 I18nProvider（Client 內 Client，無 RSC lazy）
 *
 * ── 為什麼 Navbar/MobileNav 等不再用 dynamic({ ssr:false }) ──
 *
 * 這些元件全是 'use client'，已用 useEffect 防護瀏覽器 API。
 * dynamic() 會為每個元件建立額外 lazy chunk，加劇 chunk ID 漂移問題。
 * 直接 import 讓它們與 LayoutShell 合併進同一 chunk，chunk 結構穩定。
 */
import { I18nProvider } from '@/i18n/provider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import WebVitals from '@/components/WebVitals';
import Navbar from '@/components/Navbar';
import MobileNav from '@/components/MobileNav';
import Footer from '@/components/Footer';
import InstallPrompt from '@/components/InstallPrompt';
import ThemeProvider from '@/components/ThemeProvider';

interface LayoutShellProps {
  children: React.ReactNode;
  locale: string;
  messages: Record<string, Record<string, string>>;
  fallbackMessages: Record<string, Record<string, string>>;
}

export default function LayoutShell({
  children,
  locale,
  messages,
  fallbackMessages,
}: LayoutShellProps) {
  return (
    <ThemeProvider>
      <I18nProvider locale={locale} messages={messages} fallbackMessages={fallbackMessages}>
        <ErrorBoundary>
          <WebVitals />
          <Navbar />
          <main className="pb-16 lg:pb-0" id="main-content">
            {children}
          </main>
          <MobileNav />
          <InstallPrompt />
          <Footer locale={locale} />
        </ErrorBoundary>
      </I18nProvider>
    </ThemeProvider>
  );
}
