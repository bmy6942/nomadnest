/**
 * i18n 伺服器端工具函式
 *
 * 注意：我們使用 next-intl "without plugin" 模式。
 * 翻譯透過 NextIntlClientProvider（在 layout.tsx 中）提供給 Client Components。
 * Server Components 若需翻譯，使用下方的 getServerTranslations() 工具函式。
 */
import { cookies } from 'next/headers';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from './routing';

/** 從 cookie 讀取當前語系（Server Component / Route Handler 使用） */
export async function getServerLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const val = cookieStore.get('NEXT_LOCALE')?.value;
    if (val && (SUPPORTED_LOCALES as readonly string[]).includes(val)) {
      return val as Locale;
    }
  } catch { /* 靜默降級 */ }
  return DEFAULT_LOCALE;
}

/** 從 messages JSON 載入翻譯物件（Server Component 使用） */
export async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  try {
    return (await import(`../../messages/${locale}.json`)).default as Record<string, unknown>;
  } catch {
    return (await import(`../../messages/zh-TW.json`)).default as Record<string, unknown>;
  }
}

/**
 * 載入 zh-TW fallback 翻譯（當目前語系非 zh-TW 時使用）
 * 回傳值傳入 I18nProvider 的 fallbackMessages，確保缺 key 時顯示中文而非 key 字串
 */
export async function loadFallbackMessages(): Promise<Record<string, unknown>> {
  return (await import('../../messages/zh-TW.json')).default as Record<string, unknown>;
}

type Params = Record<string, string | number>;

/**
 * Server Component 翻譯函式
 *
 * 用法（Server Component / async function）：
 *   const t = await getServerTranslations('home');
 *   t('heroTitle1')                     // → '找到你的' 或 'Find Your'
 *   t('copyright', { year: 2026 })      // → '© 2026 NomadNest Taiwan.'
 *
 * Fallback 優先順序：
 *  1. 目前語系翻譯
 *  2. zh-TW 翻譯（避免顯示 key 字串）
 *  3. `${namespace}.${key}`（最終保底）
 */
export async function getServerTranslations(namespace: string) {
  const locale   = await getServerLocale();
  const messages = await loadMessages(locale);
  const ns = messages[namespace] as Record<string, string> | undefined;

  // 若目前語系非 zh-TW，載入 fallback 以防 key 缺漏
  let fallbackNs: Record<string, string> | undefined;
  if (locale !== DEFAULT_LOCALE) {
    try {
      const fallback = await loadFallbackMessages();
      fallbackNs = fallback[namespace] as Record<string, string> | undefined;
    } catch { /* 靜默降級 */ }
  }

  return function t(key: string, params?: Params): string {
    let value = ns?.[key] ?? fallbackNs?.[key] ?? `${namespace}.${key}`;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return value;
  };
}
