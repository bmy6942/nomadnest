'use client';
/**
 * 自製輕量 i18n Provider
 *
 * 完全取代 next-intl，解決 next-intl v4 與 Next.js 14 的架構不相容問題。
 * API 設計與 next-intl 相容：useTranslations(namespace) / useLocale()
 *
 * 特色：
 *  - 零外部依賴，純 React Context
 *  - 支援巢狀翻譯鍵（e.g. 'nav.browse'）
 *  - 支援參數插值（e.g. t('footer.copyright', { year: 2026 })）
 *  - 語系 fallback（優先順序）：
 *      1. 目前語系的翻譯
 *      2. fallback 語系（zh-TW）的翻譯
 *      3. `${namespace}.${key}`（最終保底，不崩潰）
 */
import { createContext, useContext, type ReactNode } from 'react';

// ── 型別 ────────────────────────────────────────────────────────────────────────
type Messages = Record<string, Record<string, string>>;
type Params   = Record<string, string | number>;

interface I18nCtx {
  locale:           string;
  messages:         Messages;
  fallbackMessages: Messages;
}

// ── Context ─────────────────────────────────────────────────────────────────────
const I18nContext = createContext<I18nCtx>({
  locale:           'zh-TW',
  messages:         {},
  fallbackMessages: {},
});

// ── Provider ─────────────────────────────────────────────────────────────────────
export function I18nProvider({
  locale,
  messages,
  fallbackMessages = {},
  children,
}: {
  locale:            string;
  messages:          Messages;
  fallbackMessages?: Messages;
  children:          ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, messages, fallbackMessages }}>
      {children}
    </I18nContext.Provider>
  );
}

// ── Hooks ────────────────────────────────────────────────────────────────────────

/** 取得目前語系代碼（e.g. 'zh-TW' 或 'en'） */
export function useLocale(): string {
  return useContext(I18nContext).locale;
}

/**
 * 取得指定 namespace 的翻譯函式
 *
 * Fallback 優先順序：
 *  1. 目前語系翻譯
 *  2. zh-TW 翻譯（避免顯示原始 key 字串）
 *  3. `${namespace}.${key}`（最終保底）
 *
 * @example
 *   const t = useTranslations('nav');
 *   t('browse')         // → '瀏覽房源' (zh-TW) / 'Browse Listings' (en)
 *   t('copyright', { year: 2026 }) // → '© 2026 NomadNest Taiwan.'
 */
export function useTranslations(namespace: string) {
  const { messages, fallbackMessages } = useContext(I18nContext);

  return function t(key: string, params?: Params): string {
    // 1. 嘗試目前語系
    // 2. 嘗試 fallback（zh-TW）
    // 3. 最終保底顯示 key 字串
    let value =
      messages[namespace]?.[key] ??
      fallbackMessages[namespace]?.[key] ??
      `${namespace}.${key}`;

    // 參數插值：{year} → 2026
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return value;
  };
}
