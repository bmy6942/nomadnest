/**
 * POST /api/i18n/set-locale
 * 設定 NEXT_LOCALE cookie 以切換語系
 * Body: { locale: 'zh-TW' | 'en' }
 */
import { NextRequest, NextResponse } from 'next/server';

const SUPPORTED_LOCALES = ['zh-TW', 'en'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function POST(req: NextRequest) {
  try {
    const { locale } = await req.json() as { locale: string };

    if (!SUPPORTED_LOCALES.includes(locale as Locale)) {
      return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 });
    }

    const res = NextResponse.json({ success: true, locale });
    res.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: ONE_YEAR,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false, // 允許客戶端讀取（用於 fallback）
    });

    return res;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
