/**
 * i18n 語系設定（Cookie-based，不使用 URL prefix routing）
 * 不依賴 next-intl/routing，避免與 Next.js 14 webpack 產生衝突。
 */
export const SUPPORTED_LOCALES = ['zh-TW', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh-TW';
