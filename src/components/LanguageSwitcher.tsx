'use client';
/**
 * LanguageSwitcher — 語系切換按鈕
 *
 * 工作原理：
 *  1. 呼叫 /api/i18n/set-locale（POST），設定 NEXT_LOCALE cookie
 *  2. 使用 router.refresh() 重新取得 Server Component 資料（new locale messages）
 *
 * 支援：繁體中文（zh-TW）和英文（en）
 */
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/i18n/provider';

const LOCALES = [
  { code: 'zh-TW', label: '繁中', fullLabel: '繁體中文' },
  { code: 'en',    label: 'EN',   fullLabel: 'English'  },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function switchLocale(newLocale: LocaleCode) {
    if (newLocale === locale) return;

    try {
      await fetch('/api/i18n/set-locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale }),
      });
      startTransition(() => {
        router.refresh();
      });
    } catch {
      // fallback：直接設定 cookie 並重載
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
      window.location.reload();
    }
  }

  return (
    <div
      className={`flex items-center gap-1 rounded-full border border-gray-200 p-0.5 bg-white ${className}`}
      role="group"
      aria-label="Language / 語言"
    >
      {LOCALES.map(({ code, label, fullLabel }) => {
        const isActive = locale === code;
        return (
          <button
            key={code}
            onClick={() => switchLocale(code)}
            disabled={isPending}
            aria-label={fullLabel}
            aria-pressed={isActive}
            title={fullLabel}
            className={`
              px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-150
              ${isActive
                ? 'bg-nomad-navy text-white shadow-sm'
                : 'text-gray-500 hover:text-nomad-navy hover:bg-gray-100'
              }
              ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
