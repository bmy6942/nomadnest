/**
 * i18n Middleware — Cookie-based locale detection (without URL rewriting)
 *
 * 策略：不改變 URL 結構，語系由 NEXT_LOCALE cookie 決定。
 * 若 cookie 不存在，則根據 Accept-Language header 自動選擇最佳語系，
 * 並透過 Set-Cookie 寫回 cookie 讓 next-intl 的 getLocale() 能讀取。
 */
import { NextRequest, NextResponse } from 'next/server';

const SUPPORTED_LOCALES = ['zh-TW', 'en'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'zh-TW';
const COOKIE_NAME = 'NEXT_LOCALE';

function detectLocale(req: NextRequest): Locale {
  // 1. Cookie 優先
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie && SUPPORTED_LOCALES.includes(cookie as Locale)) {
    return cookie as Locale;
  }

  // 2. Accept-Language header 自動偵測
  const acceptLang = req.headers.get('accept-language') || '';
  // 如果瀏覽器偏好英文 (en) 且不包含中文
  const hasEnglish = /\ben(-[A-Z]{2})?\b/i.test(acceptLang);
  const hasChinese = /\bzh(-[A-Z]{2,})?\b/i.test(acceptLang);
  if (hasEnglish && !hasChinese) return 'en';

  return DEFAULT_LOCALE;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 跳過不需要 i18n 的路徑
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname.includes('.') // 靜態資源（.png, .ico, .svg…）
  ) {
    return NextResponse.next();
  }

  const locale = detectLocale(req);
  const res = NextResponse.next();

  // 將語系設定回 cookie（若尚未設定）
  if (!req.cookies.get(COOKIE_NAME)) {
    res.cookies.set(COOKIE_NAME, locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 年
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icons|sw.js|manifest.webmanifest).*)',
  ],
};
