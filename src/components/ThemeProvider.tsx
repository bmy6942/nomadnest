'use client';
/**
 * ThemeProvider — 全站暗色模式管理器
 *
 * 使用 localStorage 持久化用戶偏好，並在 <html> 加 / 移除 "dark" class。
 * 利用 blocking script（在 <head> 注入）避免 FOUC（閃白）。
 *
 * 不依賴 next-themes，純 React + DOM 實作。
 */
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme:     Theme;
  isDark:    boolean;
  setTheme:  (t: Theme) => void;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system', isDark: false,
  setTheme: () => {}, toggleDark: () => {},
});

export function useTheme() { return useContext(ThemeContext); }

const STORAGE_KEY = 'nomadnest_theme';

function getStoredTheme(): Theme {
  try { return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system'; }
  catch { return 'system'; }
}

function resolveIsDark(theme: Theme): boolean {
  if (theme === 'dark')  return true;
  if (theme === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyTheme(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,  setThemeState]  = useState<Theme>('system');
  const [isDark, setIsDark]      = useState(false);
  const [mounted, setMounted]    = useState(false);

  // ① 初始化 — 必須在 client 才能讀 localStorage / matchMedia
  useEffect(() => {
    const stored = getStoredTheme();
    const dark   = resolveIsDark(stored);
    setThemeState(stored);
    setIsDark(dark);
    applyTheme(dark);
    setMounted(true);

    // 監聽系統主題變更（只在 theme === 'system' 時生效）
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (getStoredTheme() !== 'system') return;
      const d = e.matches;
      setIsDark(d);
      applyTheme(d);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const setTheme = (t: Theme) => {
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* noop */ }
    const dark = resolveIsDark(t);
    setThemeState(t);
    setIsDark(dark);
    applyTheme(dark);
  };

  const toggleDark = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleDark }}>
      {/* suppress hydration warning：server renders 'light', client may override */}
      <div suppressHydrationWarning style={{ display: 'contents' }}>
        {mounted ? children : <>{children}</>}
      </div>
    </ThemeContext.Provider>
  );
}
