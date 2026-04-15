/**
 * InstallPrompt PWA 組件單元測試
 *
 * 覆蓋：
 *  - 預設不渲染任何 UI（platform = none）
 *  - SW_UPDATED 訊息 → 顯示 SwUpdateBanner
 *  - SwUpdateBanner 點擊「稍後」→ 橫幅消失
 *  - SwUpdateBanner 點擊「立即重新整理」→ postMessage SKIP_WAITING
 *  - beforeinstallprompt 觸發 → 3 秒後顯示 AndroidBanner
 *  - AndroidBanner 點擊「稍後」→ 橫幅消失 + 寫入 localStorage
 *  - AndroidBanner 點擊「立即安裝」→ 呼叫 deferredPrompt.prompt()
 *  - appinstalled → 橫幅隱藏
 *  - dismissed 內 30 天 → 不顯示安裝提示
 *  - iOS 平台偵測 → 3 秒後顯示 IOSGuide
 *  - IOSGuide 關閉按鈕 → 橫幅消失
 *  - dismissed TTL 超過 30 天 → 視為未 dismissed
 */

// This file uses the real @/i18n/provider so InstallPrompt can get real strings.
vi.unmock('@/i18n/provider');

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import InstallPrompt from '@/components/InstallPrompt';
import { I18nProvider } from '@/i18n/provider';

// ── pwa 翻譯 stub ──────────────────────────────────────────────────────────────
const pwaMessages = {
  pwa: {
    installTitle:    'Install NomadNest App',
    installDesc:     'Add to home screen for offline browsing',
    installLater:    'Maybe Later',
    installNow:      'Install Now',
    iosTitle:        'Install NomadNest App',
    iosDesc:         'Add to home screen for quick access',
    iosStep1:        'Tap the Share button',
    iosStep2:        'Tap Add to Home Screen',
    iosStep3:        'Tap Add to finish',
    iosClose:        'Close',
    swUpdateTitle:   '🔄 New Version Ready',
    swUpdateDesc:    'Refresh to apply the latest update',
    swUpdateRefresh: 'Refresh Now',
    swUpdateDismiss: 'Later',
  },
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider locale="en" messages={pwaMessages}>
      {children}
    </I18nProvider>
  );
}

function renderPrompt() {
  return render(<InstallPrompt />, { wrapper: Wrapper });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared mock state
// ─────────────────────────────────────────────────────────────────────────────
let swListeners: Record<string, ((e: MessageEvent) => void)[]> = {};
let reloadMock: ReturnType<typeof vi.fn>;
let postMessageMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  swListeners = {};
  reloadMock  = vi.fn();
  postMessageMock = vi.fn();

  // Stub window.location with a writable reload (jsdom's location.reload is non-configurable)
  vi.stubGlobal('location', {
    reload:   reloadMock,
    href:     'http://localhost:3000/',
    origin:   'http://localhost:3000',
    pathname: '/',
    assign:   vi.fn(),
    replace:  vi.fn(),
  });

  // Mock navigator.serviceWorker
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      addEventListener: vi.fn((event: string, cb: (e: MessageEvent) => void) => {
        if (!swListeners[event]) swListeners[event] = [];
        swListeners[event].push(cb);
      }),
      removeEventListener: vi.fn(),
      controller: { postMessage: postMessageMock },
    } as unknown as ServiceWorkerContainer,
    configurable: true,
    writable: true,
  });

  // Ensure matchMedia → not standalone
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });

  // Default: Android Chrome user-agent
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Linux; Android 9; Chrome/120)',
    configurable: true,
  });
  Object.defineProperty(navigator, 'standalone', {
    value: undefined,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

// ── 輔助：觸發 SW message event ────────────────────────────────────────────────
function fireSwMessage(type: string) {
  swListeners['message']?.forEach(cb =>
    cb(new MessageEvent('message', { data: { type } }))
  );
}

// ─── 預設狀態 ─────────────────────────────────────────────────────────────────
describe('預設狀態', () => {
  it('初始渲染不顯示任何 UI', () => {
    const { container } = renderPrompt();
    // No visible banner; only possible child is the container itself
    expect(container.firstChild).toBeNull();
  });
});

// ─── SW 更新橫幅 ──────────────────────────────────────────────────────────────
describe('SW 更新橫幅', () => {
  it('收到 SW_UPDATED 訊息 → 顯示更新橫幅', async () => {
    renderPrompt();

    await act(async () => { fireSwMessage('SW_UPDATED'); });

    expect(screen.getByText('🔄 New Version Ready')).toBeTruthy();
    expect(screen.getByText('Refresh Now')).toBeTruthy();
    expect(screen.getByText('Later')).toBeTruthy();
  });

  it('點擊「Later」→ 橫幅消失', async () => {
    renderPrompt();
    await act(async () => { fireSwMessage('SW_UPDATED'); });

    await act(async () => { fireEvent.click(screen.getByText('Later')); });

    expect(screen.queryByText('🔄 New Version Ready')).toBeNull();
  });

  it('點擊「Refresh Now」→ postMessage SKIP_WAITING', async () => {
    renderPrompt();
    await act(async () => { fireSwMessage('SW_UPDATED'); });

    await act(async () => {
      fireEvent.click(screen.getByText('Refresh Now'));
      vi.advanceTimersByTime(400); // past the 300ms reload delay
    });

    expect(postMessageMock).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});

// ─── Android 安裝橫幅 ─────────────────────────────────────────────────────────
describe('Android 安裝橫幅', () => {
  function dispatchBeforeInstallPrompt() {
    const mockDeferredPrompt = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    };
    const event = Object.assign(new Event('beforeinstallprompt'), mockDeferredPrompt);
    window.dispatchEvent(event);
    return mockDeferredPrompt;
  }

  it('beforeinstallprompt + 3 秒 → 顯示 AndroidBanner', async () => {
    renderPrompt();
    dispatchBeforeInstallPrompt();

    expect(screen.queryByText('Install NomadNest App')).toBeNull();

    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(screen.getByText('Install NomadNest App')).toBeTruthy();
    expect(screen.getByText('Maybe Later')).toBeTruthy();
    expect(screen.getByText('Install Now')).toBeTruthy();
  });

  it('點擊「Maybe Later」→ 橫幅消失 + localStorage 有 dismissed 記錄', async () => {
    renderPrompt();
    dispatchBeforeInstallPrompt();
    await act(async () => { vi.advanceTimersByTime(3000); });

    await act(async () => { fireEvent.click(screen.getByText('Maybe Later')); });

    expect(screen.queryByText('Install NomadNest App')).toBeNull();
    expect(localStorage.getItem('nomadnest_install_dismissed_at')).not.toBeNull();
  });

  it('點擊「Install Now」→ 呼叫 deferredPrompt.prompt()', async () => {
    renderPrompt();
    const mockDeferredPrompt = dispatchBeforeInstallPrompt();
    await act(async () => { vi.advanceTimersByTime(3000); });

    await act(async () => {
      fireEvent.click(screen.getByText('Install Now'));
    });
    await act(async () => {}); // flush promises

    expect(mockDeferredPrompt.prompt).toHaveBeenCalled();
  });

  it('localStorage 有效 dismissed 記錄 → 不顯示橫幅', async () => {
    localStorage.setItem('nomadnest_install_dismissed_at', Date.now().toString());
    renderPrompt();
    dispatchBeforeInstallPrompt();
    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(screen.queryByText('Install NomadNest App')).toBeNull();
  });

  it('appinstalled 事件 → 橫幅消失', async () => {
    renderPrompt();
    dispatchBeforeInstallPrompt();
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('Install NomadNest App')).toBeTruthy();

    await act(async () => { window.dispatchEvent(new Event('appinstalled')); });

    expect(screen.queryByText('Install NomadNest App')).toBeNull();
  });
});

// ─── iOS 安裝說明 ─────────────────────────────────────────────────────────────
describe('iOS 安裝說明', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    });
    Object.defineProperty(navigator, 'standalone', {
      value: false,
      configurable: true,
    });
  });

  it('iOS 非 standalone → 3 秒後顯示 IOSGuide 三個步驟', async () => {
    renderPrompt();
    expect(screen.queryByText('Tap the Share button')).toBeNull();

    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(screen.getByText('Install NomadNest App')).toBeTruthy();
    expect(screen.getByText('Tap the Share button')).toBeTruthy();
    expect(screen.getByText('Tap Add to Home Screen')).toBeTruthy();
    expect(screen.getByText('Tap Add to finish')).toBeTruthy();
  });

  it('IOSGuide 點擊關閉 → 消失 + localStorage 記錄', async () => {
    renderPrompt();
    await act(async () => { vi.advanceTimersByTime(3000); });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Close'));
    });

    expect(screen.queryByText('Tap the Share button')).toBeNull();
    expect(localStorage.getItem('nomadnest_install_dismissed_at')).not.toBeNull();
  });

  it('已有 dismissed 記錄 → iOS 也不顯示', async () => {
    localStorage.setItem('nomadnest_install_dismissed_at', Date.now().toString());
    renderPrompt();
    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(screen.queryByText('Tap the Share button')).toBeNull();
  });

  it('iOS standalone 模式（已安裝）→ 不顯示 IOSGuide', async () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    renderPrompt();
    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(screen.queryByText('Tap the Share button')).toBeNull();
  });
});

// ─── dismissed TTL ────────────────────────────────────────────────────────────
describe('dismissed TTL（30 天）', () => {
  it('dismissed 記錄超過 30 天 → 視為未 dismissed，可再次顯示橫幅', async () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    localStorage.setItem('nomadnest_install_dismissed_at', thirtyOneDaysAgo.toString());

    renderPrompt();

    const mockDeferredPrompt = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    };
    const event = Object.assign(new Event('beforeinstallprompt'), mockDeferredPrompt);
    window.dispatchEvent(event);

    await act(async () => { vi.advanceTimersByTime(3000); });

    // TTL expired → banner should be visible again
    expect(screen.getByText('Install NomadNest App')).toBeTruthy();
  });
});
