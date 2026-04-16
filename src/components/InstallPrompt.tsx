'use client';

/**
 * InstallPrompt — PWA 安裝引導組件
 *
 * Android Chrome：攔截 beforeinstallprompt 事件，顯示自訂安裝橫幅
 * iOS Safari：偵測 iOS + 非 standalone 模式，顯示手動安裝說明
 * 其他瀏覽器：不顯示
 *
 * 用戶按「稍後再說」後，30 天內不再顯示（localStorage）
 * v2：加入 i18n 支援（useTranslations）+ SW 更新通知橫幅
 */

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useTranslations } from '@/i18n/provider';

const DISMISSED_KEY    = 'nomadnest_install_dismissed_at';
const DISMISS_TTL      = 30 * 24 * 60 * 60 * 1000; // 30 天
const SW_DISMISSED_KEY = 'nomadnest_sw_update_dismissed_at';
const SW_DISMISS_TTL   = 24 * 60 * 60 * 1000; // 24 小時

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'android' | 'ios' | 'none';

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'none';

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
  const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  if (isStandalone) return 'none'; // 已安裝，不顯示
  if (isIOS) return 'ios';
  return 'none'; // Android 由 beforeinstallprompt 觸發
}

function isDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISSED_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < DISMISS_TTL;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  } catch { /* ignore */ }
}

// ── SW 更新通知的靜音 ────────────────────────────────────────────
function isSwUpdateSnoozed(): boolean {
  try {
    const ts = localStorage.getItem(SW_DISMISSED_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < SW_DISMISS_TTL;
  } catch {
    return false;
  }
}

function snoozeSwUpdate() {
  try {
    localStorage.setItem(SW_DISMISSED_KEY, Date.now().toString());
  } catch { /* ignore */ }
}

// ── SW 更新通知橫幅 ────────────────────────────────────────────────────────────
function SwUpdateBanner({ onRefresh, onDismiss }: { onRefresh: () => void; onDismiss: () => void }) {
  const t = useTranslations('pwa');
  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-20 left-4 right-4 z-50 max-w-sm mx-auto
                 bg-nomad-navy text-white rounded-2xl shadow-2xl p-4
                 animate-in slide-in-from-top-4 duration-300"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{t('swUpdateTitle')}</p>
          <p className="text-xs text-blue-200 mt-0.5">{t('swUpdateDesc')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDismiss}
            className="text-xs text-blue-300 hover:text-white px-2 py-1 transition-colors"
          >
            {t('swUpdateDismiss')}
          </button>
          <button
            onClick={onRefresh}
            className="text-xs font-semibold bg-white text-nomad-navy px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {t('swUpdateRefresh')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Android 安裝橫幅 ──────────────────────────────────────────────────────────
function AndroidBanner({ onInstall, onDismiss }: { onInstall: () => void; onDismiss: () => void }) {
  const t = useTranslations('pwa');
  return (
    <div
      role="dialog"
      aria-label={t('installTitle')}
      className="fixed bottom-20 lg:bottom-4 left-4 right-4 z-50 max-w-sm mx-auto
                 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4
                 animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-3">
        <img
          src="/icons/icon-96x96.png"
          alt="NomadNest"
          className="w-12 h-12 rounded-xl shrink-0 shadow-sm"
        />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">{t('installTitle')}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t('installDesc')}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onDismiss}
          className="flex-1 text-sm text-gray-500 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          {t('installLater')}
        </button>
        <button
          onClick={onInstall}
          className="flex-1 text-sm font-semibold text-white py-2 rounded-xl bg-nomad-navy hover:bg-nomad-navy/90 transition-colors"
        >
          {t('installNow')}
        </button>
      </div>
    </div>
  );
}

// ── iOS 安裝說明 ──────────────────────────────────────────────────────────────
function IOSGuide({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations('pwa');
  return (
    <div
      role="dialog"
      aria-label={t('iosTitle')}
      className="fixed bottom-20 lg:bottom-4 left-4 right-4 z-50 max-w-sm mx-auto
                 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4
                 animate-in slide-in-from-bottom-4 duration-300"
    >
      {/* 小三角指向 Safari 底部工具列 */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r border-b border-gray-100 rotate-45" />
      <button
        onClick={onDismiss}
        aria-label={t('iosClose')}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1"
      >
        ✕
      </button>
      <div className="flex items-center gap-2 mb-3">
        <Image src="/icons/icon-96x96.png" alt="NomadNest" width={36} height={36} className="rounded-xl shadow-sm" />
        <div>
          <p className="font-bold text-gray-900 text-sm">{t('iosTitle')}</p>
          <p className="text-xs text-gray-400">{t('iosDesc')}</p>
        </div>
      </div>
      <ol className="space-y-2 text-sm text-gray-700">
        {[t('iosStep1'), t('iosStep2'), t('iosStep3')].map((step, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-nomad-navy text-white text-xs flex items-center justify-center font-bold shrink-0">
              {i + 1}
            </span>
            <span>{step}{i === 0 && <span className="inline-block bg-gray-100 px-1 rounded text-xs ml-1">⬆︎</span>}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── 主組件 ────────────────────────────────────────────────────────────────────
export default function InstallPrompt() {
  const [platform, setPlatform]             = useState<Platform>('none');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible]               = useState(false);
  const [swUpdated, setSwUpdated]           = useState(false);

  useEffect(() => {
    // ── SW 更新通知監聽 ─────────────────────────────────────────────────────
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED' && !isSwUpdateSnoozed()) {
        setSwUpdated(true);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSwMessage);

    // ── PWA 安裝提示 ────────────────────────────────────────────────────────
    if (!isDismissed()) {
      // Android：等待瀏覽器觸發 beforeinstallprompt
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setPlatform('android');
        setTimeout(() => setVisible(true), 3000);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstall);

      // iOS：立即偵測
      const ios = detectPlatform();
      if (ios === 'ios') {
        setTimeout(() => { setPlatform('ios'); setVisible(true); }, 3000);
      }

      // 已安裝後隱藏
      const handleInstalled = () => setVisible(false);
      window.addEventListener('appinstalled', handleInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        window.removeEventListener('appinstalled', handleInstalled);
        navigator.serviceWorker?.removeEventListener('message', handleSwMessage);
      };
    }

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    markDismissed();
  }, []);

  const handleSwRefresh = useCallback(() => {
    // 發送 SKIP_WAITING 讓新 SW 立即接管，然後重新載入
    navigator.serviceWorker?.controller?.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(() => window.location.reload(), 300);
  }, []);

  // SW 更新橫幅優先顯示
  if (swUpdated) {
    return (
      <SwUpdateBanner
        onRefresh={handleSwRefresh}
        onDismiss={() => { setSwUpdated(false); snoozeSwUpdate(); }}
      />
    );
  }

  if (!visible) return null;
  if (platform === 'android' && deferredPrompt) {
    return <AndroidBanner onInstall={handleInstall} onDismiss={handleDismiss} />;
  }
  if (platform === 'ios') {
    return <IOSGuide onDismiss={handleDismiss} />;
  }
  return null;
}
