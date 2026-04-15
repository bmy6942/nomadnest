/**
 * [locale] 重定向 shim
 * 此路由只在有人直接訪問 /en 或 /zh-TW 時觸發（因靜態路由優先，/ 由 app/page.tsx 處理）。
 * 設定對應語系 cookie 後重定向至首頁，讓 next-intl 在下一個請求中讀取正確語系。
 */
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

const SUPPORTED = ['zh-TW', 'en'] as const;

export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const cookieStore = await cookies();
  if (SUPPORTED.includes(locale as 'zh-TW' | 'en')) {
    cookieStore.set('NEXT_LOCALE', locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  }
  redirect('/');
}
