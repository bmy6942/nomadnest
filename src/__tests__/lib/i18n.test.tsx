/**
 * i18n Provider 單元測試
 *
 * 覆蓋：
 *  - I18nProvider 正確提供 locale 與 messages
 *  - useLocale() 回傳當前語系代碼
 *  - useTranslations(namespace) 回傳 t() 函式
 *  - t(key) 正確翻譯已存在的 key
 *  - t(key) fallback 優先順序：
 *      1. 目前語系翻譯
 *      2. fallbackMessages（zh-TW）翻譯
 *      3. "namespace.key" 格式
 *  - t(key) fallback：namespace 不存在 → "namespace.key"
 *  - t(key) fallback：key 不存在 → "namespace.key"（無 fallbackMessages 時）
 *  - t(key) fallback：key 不存在 → zh-TW 翻譯（有 fallbackMessages 時）
 *  - t(key, params) 參數插值：{year} → 實際值
 *  - 多個參數插值同時生效
 *  - 同一參數多次出現時全部替換
 *  - 嵌套 namespace 不存在時不崩潰
 *  - 切換語系：同一組件在不同 Provider 下得到不同翻譯
 */

// This file tests the real @/i18n/provider module — bypass the global mock.
vi.unmock('@/i18n/provider');

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider, useLocale, useTranslations } from '@/i18n/provider';

// ── 測試用訊息字典 ─────────────────────────────────────────────────────────────
const zhMessages = {
  nav: {
    home:   '首頁',
    browse: '瀏覽房源',
  },
  footer: {
    copyright: '© {year} NomadNest Taiwan. 版權所有。',
    madeWith:  'NomadNest — {city} 為 {audience} 而生',
  },
  common: {
    hello: '你好，{name}！歡迎回來，{name}。',
  },
};

const enMessages = {
  nav: {
    home:   'Home',
    browse: 'Browse Listings',
  },
  footer: {
    copyright: '© {year} NomadNest Taiwan. All rights reserved.',
    madeWith:  'NomadNest — built for {audience} in {city}',
  },
  common: {
    hello: 'Hello, {name}! Welcome back, {name}.',
  },
};

// ── 輔助：渲染使用 hook 的組件 ─────────────────────────────────────────────────
function LocaleDisplay() {
  const locale = useLocale();
  return <span data-testid="locale">{locale}</span>;
}

function TranslationDisplay({
  namespace,
  tKey,
  params,
}: {
  namespace: string;
  tKey: string;
  params?: Record<string, string | number>;
}) {
  const t = useTranslations(namespace);
  return <span data-testid="translation">{t(tKey, params)}</span>;
}

// ─── useLocale ────────────────────────────────────────────────────────────────
describe('useLocale', () => {
  it('回傳 zh-TW', () => {
    render(
      <I18nProvider locale="zh-TW" messages={zhMessages}>
        <LocaleDisplay />
      </I18nProvider>
    );
    expect(screen.getByTestId('locale').textContent).toBe('zh-TW');
  });

  it('回傳 en', () => {
    render(
      <I18nProvider locale="en" messages={enMessages}>
        <LocaleDisplay />
      </I18nProvider>
    );
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('未包裹 Provider 時使用預設值 zh-TW', () => {
    render(<LocaleDisplay />);
    expect(screen.getByTestId('locale').textContent).toBe('zh-TW');
  });
});

// ─── useTranslations — 基本翻譯 ───────────────────────────────────────────────
describe('useTranslations — 基本翻譯', () => {
  it('zh-TW：正確回傳 nav.home', () => {
    render(
      <I18nProvider locale="zh-TW" messages={zhMessages}>
        <TranslationDisplay namespace="nav" tKey="home" />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe('首頁');
  });

  it('en：正確回傳 nav.home', () => {
    render(
      <I18nProvider locale="en" messages={enMessages}>
        <TranslationDisplay namespace="nav" tKey="home" />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe('Home');
  });

  it('zh-TW：正確回傳 nav.browse', () => {
    render(
      <I18nProvider locale="zh-TW" messages={zhMessages}>
        <TranslationDisplay namespace="nav" tKey="browse" />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe('瀏覽房源');
  });

  it('en：正確回傳 nav.browse', () => {
    render(
      <I18nProvider locale="en" messages={enMessages}>
        <TranslationDisplay namespace="nav" tKey="browse" />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe('Browse Listings');
  });
});

// ─── useTranslations — Fallback 行為 ─────────────────────────────────────────
describe('useTranslations — fallback 行為', () => {
  it('key 不存在 → 回傳 "namespace.key" 格式', () => {
    render(
      <I18nProvider locale="zh-TW" messages={zhMessages}>
        <TranslationDisplay namespace="nav" tKey="nonexistent" />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe('nav.nonexistent');
  });

  it('namespace 不存在 → 回傳 "namespace.key" 格式', () => {
    render(
      <I18nProvider locale="zh-TW" messages={zhMessages}>
        <TranslationDisplay namespace="unknown" tKey="someKey" />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe('unknown.someKey');
  });

  it('messages 為空物件時不崩潰', () => {
    render(
      <I18nProvider locale="zh-TW" messages={{}}>
        <TranslationDisplay namespace="nav" tKey="home" />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe('nav.home');
  });

  it('未包裹 Provider 時回傳 fallback', () => {
    render(<TranslationDisplay namespace="nav" tKey="home" />);
    expect(screen.getByTestId('translation').textContent).toBe('nav.home');
  });
});

// ─── useTranslations — 參數插值 ───────────────────────────────────────────────
describe('useTranslations — 參數插值', () => {
  it('單一參數 {year} 被替換', () => {
    render(
      <I18nProvider locale="zh-TW" messages={zhMessages}>
        <TranslationDisplay namespace="footer" tKey="copyright" params={{ year: 2026 }} />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe(
      '© 2026 NomadNest Taiwan. 版權所有。'
    );
  });

  it('en 單一參數 {year} 被替換', () => {
    render(
      <I18nProvider locale="en" messages={enMessages}>
        <TranslationDisplay namespace="footer" tKey="copyright" params={{ year: 2025 }} />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe(
      '© 2025 NomadNest Taiwan. All rights reserved.'
    );
  });

  it('多個參數同時替換 {city} 與 {audience}', () => {
    render(
      <I18nProvider locale="zh-TW" messages={zhMessages}>
        <TranslationDisplay
          namespace="footer"
          tKey="madeWith"
          params={{ city: '台北', audience: '數位游牧者' }}
        />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe(
      'NomadNest — 台北 為 數位游牧者 而生'
    );
  });

  it('同一參數 {name} 在字串中出現兩次時全部替換', () => {
    render(
      <I18nProvider locale="zh-TW" messages={zhMessages}>
        <TranslationDisplay namespace="common" tKey="hello" params={{ name: '小美' }} />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe(
      '你好，小美！歡迎回來，小美。'
    );
  });

  it('參數值為數字型別時正確轉換為字串', () => {
    render(
      <I18nProvider locale="en" messages={enMessages}>
        <TranslationDisplay namespace="footer" tKey="copyright" params={{ year: 2030 }} />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toContain('2030');
  });

  it('提供 params 但 key 不存在時 → fallback 字串，不崩潰', () => {
    render(
      <I18nProvider locale="zh-TW" messages={zhMessages}>
        <TranslationDisplay namespace="nav" tKey="missing" params={{ year: 2026 }} />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe('nav.missing');
  });
});

// ─── 語系切換 ─────────────────────────────────────────────────────────────────
describe('語系切換', () => {
  it('同 key，zh-TW vs en 回傳不同翻譯', () => {
    const { unmount } = render(
      <I18nProvider locale="zh-TW" messages={zhMessages}>
        <TranslationDisplay namespace="nav" tKey="browse" />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe('瀏覽房源');
    unmount();

    render(
      <I18nProvider locale="en" messages={enMessages}>
        <TranslationDisplay namespace="nav" tKey="browse" />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe('Browse Listings');
  });
});

// ─── fallbackMessages（I2 跨語系 fallback）──────────────────────────────────
describe('fallbackMessages — 跨語系 fallback', () => {
  // en 翻譯缺少某個 key，但 zh-TW fallback 有 → 應顯示 zh-TW 翻譯
  const enMessagesPartial = {
    nav: {
      home: 'Home',
      // browse 故意缺漏，觸發 fallback
    },
    footer: {
      copyright: '© {year} NomadNest Taiwan. All rights reserved.',
      madeWith:  'NomadNest — built for {audience} in {city}',
    },
    common: {
      hello: 'Hello, {name}! Welcome back, {name}.',
    },
  };

  it('en 缺 key 時，回傳 fallbackMessages（zh-TW）的對應翻譯', () => {
    render(
      <I18nProvider locale="en" messages={enMessagesPartial} fallbackMessages={zhMessages}>
        <TranslationDisplay namespace="nav" tKey="browse" />
      </I18nProvider>
    );
    // en 沒有 browse，fallback 到 zh-TW 的 '瀏覽房源'
    expect(screen.getByTestId('translation').textContent).toBe('瀏覽房源');
  });

  it('en 有 key 時，優先使用 en 翻譯，不回退', () => {
    render(
      <I18nProvider locale="en" messages={enMessagesPartial} fallbackMessages={zhMessages}>
        <TranslationDisplay namespace="nav" tKey="home" />
      </I18nProvider>
    );
    // en 有 home，應回傳 'Home' 而非 zh-TW 的 '首頁'
    expect(screen.getByTestId('translation').textContent).toBe('Home');
  });

  it('en 缺 key 且 zh-TW fallback 也缺 → 回傳 "namespace.key"', () => {
    render(
      <I18nProvider locale="en" messages={enMessagesPartial} fallbackMessages={zhMessages}>
        <TranslationDisplay namespace="nav" tKey="totallyMissing" />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe('nav.totallyMissing');
  });

  it('未傳入 fallbackMessages 時，en 缺 key → 仍回傳 "namespace.key"（向後相容）', () => {
    render(
      <I18nProvider locale="en" messages={enMessagesPartial}>
        <TranslationDisplay namespace="nav" tKey="browse" />
      </I18nProvider>
    );
    expect(screen.getByTestId('translation').textContent).toBe('nav.browse');
  });

  it('fallback 翻譯的參數插值仍正確運作', () => {
    const enNoFooter = { nav: { home: 'Home' }, common: {} };
    render(
      <I18nProvider locale="en" messages={enNoFooter} fallbackMessages={zhMessages}>
        <TranslationDisplay namespace="footer" tKey="copyright" params={{ year: 2026 }} />
      </I18nProvider>
    );
    // en 沒有 footer，fallback 到 zh-TW 的 copyright，再插值 year
    expect(screen.getByTestId('translation').textContent).toBe(
      '© 2026 NomadNest Taiwan. 版權所有。'
    );
  });
});
