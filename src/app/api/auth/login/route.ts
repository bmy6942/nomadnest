import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signToken, COOKIE_NAME } from '@/lib/auth';
import { loginLimiter } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: '請提供 email 與密碼' }, { status: 400 });
    }

    // ✅ 型別守衛（body 欄位為 unknown，需明確驗證）
    const emailRaw    = body.email;
    const passwordRaw = body.password;

    // ✅ 基本欄位驗證（避免空值進 DB 查詢產生 500）
    if (!emailRaw || typeof emailRaw !== 'string' || !emailRaw.includes('@')) {
      return NextResponse.json({ error: '請輸入有效的 Email' }, { status: 400 });
    }
    if (!passwordRaw || typeof passwordRaw !== 'string' || passwordRaw.length < 1) {
      return NextResponse.json({ error: '請輸入密碼' }, { status: 400 });
    }

    // ✅ 先正規化 email，再用於 rate-limit key
    // 若先建 key 再正規化，攻擊者可用大小寫變體（User@Example.com 與 user@example.com）
    // 繞過 per-email 速率限制，讓有效攻擊次數翻倍
    const normalizedEmail = emailRaw.trim().toLowerCase();
    const ip     = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ipKey  = `login:ip:${ip}`;
    const emlKey = `login:email:${normalizedEmail}`;

    // ✅ 速率限制：以 IP + email 雙重 key 防止暴力破解（改用 loginLimiter 直接呼叫）
    const ipLimit  = loginLimiter.check(ipKey);
    const emlLimit = loginLimiter.check(emlKey);

    if (!ipLimit.ok || !emlLimit.ok) {
      const retryAfter = Math.max(ipLimit.retryAfter ?? 0, emlLimit.retryAfter ?? 0);
      return NextResponse.json(
        { error: `登入嘗試次數過多，請 ${Math.ceil(retryAfter / 60)} 分鐘後再試` },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': '10',
          },
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, password: true, role: true, banned: true, verificationStatus: true },
    });
    if (!user) return NextResponse.json({ error: 'Email 或密碼錯誤' }, { status: 401 });

    const valid = await bcrypt.compare(passwordRaw, user.password);
    if (!valid) return NextResponse.json({ error: 'Email 或密碼錯誤' }, { status: 401 });

    if (user.banned) {
      return NextResponse.json({ error: '此帳號已被停用，請聯繫客服' }, { status: 403 });
    }

    // ✅ 登入成功 → 清除速率計數
    loginLimiter.clear(ipKey);
    loginLimiter.clear(emlKey);

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const res = NextResponse.json({
      success: true,
      emailPending: user.verificationStatus === 'emailPending',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      maxAge:   60 * 60 * 24 * 7,
      path:     '/',
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
    });
    return res;
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
