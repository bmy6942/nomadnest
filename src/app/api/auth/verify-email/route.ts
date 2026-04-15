import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/db';
import { verifyEmailLimiter } from '@/lib/rateLimit';
import { getJwtSecret } from '@/lib/auth';

// ✅ 透過 getJwtSecret() 取得 secret：生產環境未設定時會拋出錯誤
const SECRET = getJwtSecret();

/**
 * GET /api/auth/verify-email?token=...
 * 驗證 Email token 並將用戶的 verificationStatus 從 'emailPending' 改為 'none'
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/auth/verify-email?error=missing', req.url));
  }

  try {
    const payload = jwt.verify(token, SECRET) as {
      userId: string; email: string; purpose: string;
    };

    if (payload.purpose !== 'email-verify') {
      return NextResponse.redirect(new URL('/auth/verify-email?error=invalid', req.url));
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return NextResponse.redirect(new URL('/auth/verify-email?error=notfound', req.url));
    }
    if (user.email !== payload.email) {
      return NextResponse.redirect(new URL('/auth/verify-email?error=mismatch', req.url));
    }

    // ✅ 已驗證（之前就已經驗證過）
    if (user.verificationStatus !== 'emailPending') {
      return NextResponse.redirect(new URL('/auth/verify-email?success=already', req.url));
    }

    // ✅ 標記 Email 為已驗證（還原為 'none'，不影響管理員的 ID 審核流程）
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationStatus: 'none' },
    });

    return NextResponse.redirect(new URL('/auth/verify-email?success=true', req.url));
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    return NextResponse.redirect(
      new URL(`/auth/verify-email?error=${isExpired ? 'expired' : 'invalid'}`, req.url)
    );
  }
}

/**
 * POST /api/auth/verify-email
 * 重新發送驗證信
 */
export async function POST(req: NextRequest) {
  try {
    // ✅ 速率限制：同一 IP 3 次 / 60 分鐘，防止 Email 轟炸
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limitResult = verifyEmailLimiter.check(`verify-resend:ip:${ip}`);
    if (!limitResult.ok) {
      return NextResponse.json(
        { error: `請求過於頻繁，請 ${Math.ceil((limitResult.retryAfter ?? 3600) / 60)} 分鐘後再試` },
        { status: 429, headers: { 'Retry-After': String(limitResult.retryAfter ?? 3600) } }
      );
    }

    // ── JSON 解析（防止畸形請求觸發 500）──────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
    }

    const { email } = body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: '請提供 Email' }, { status: 400 });
    }

    // ✅ 正規化 email（lowercase + trim）— 與 register 儲存格式一致
    // 未正規化時大小寫不同（如 USER@EXAMPLE.COM）會查不到已存在的帳號
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    // 不論是否找到都回傳相同訊息（防止帳號枚舉）
    if (!user || user.verificationStatus !== 'emailPending') {
      return NextResponse.json({ ok: true });
    }

    const verifyToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'email-verify' },
      SECRET,
      { expiresIn: '7d' }
    );
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    const verifyLink = `${baseUrl}/auth/verify-email?token=${verifyToken}`;

    const { sendEmailVerification } = await import('@/lib/email');
    sendEmailVerification({ userEmail: user.email, userName: user.name, verifyLink }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
