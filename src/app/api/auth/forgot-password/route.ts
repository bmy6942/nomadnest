import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';
import jwt from 'jsonwebtoken';
import { forgotPasswordLimiter } from '@/lib/rateLimit';
import { getJwtSecret } from '@/lib/auth';

// ✅ 透過 getJwtSecret() 取得 secret：生產環境未設定時會拋出錯誤
const SECRET = getJwtSecret();

export async function POST(req: NextRequest) {
  try {
    // ✅ 速率限制：同一 IP 3 次 / 10 分鐘，防止 Email 轟炸
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limitResult = forgotPasswordLimiter.check(`forgot:ip:${ip}`);
    if (!limitResult.ok) {
      return NextResponse.json(
        { error: `請求過於頻繁，請 ${Math.ceil((limitResult.retryAfter ?? 600) / 60)} 分鐘後再試` },
        { status: 429, headers: { 'Retry-After': String(limitResult.retryAfter ?? 600) } }
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
      return NextResponse.json({ error: '請輸入電子郵件' }, { status: 400 });
    }

    // 查找用戶（無論找不找到都回傳相同訊息，避免帳號枚舉攻擊）
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true, password: true },
    });

    if (user) {
      // 使用 JWT 生成無狀態重設 Token
      // 將目前密碼 hash 的最後 8 碼作為 secret suffix，確保改密後舊 token 失效
      const tokenSecret = SECRET + user.password.slice(-8);
      const token = jwt.sign(
        { userId: user.id, email: user.email, purpose: 'password-reset' },
        tokenSecret,
        { expiresIn: '1h' }
      );

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
      const resetLink = `${baseUrl}/auth/reset-password?token=${token}&uid=${user.id}`;

      await sendPasswordResetEmail({
        userEmail: user.email,
        userName: user.name,
        resetLink,
      });
    }

    // 永遠回傳相同訊息（防止帳號枚舉）
    return NextResponse.json({
      message: '若此電子郵件已註冊，您將會收到重設密碼的連結。',
    });
  } catch (e) {
    console.error('[forgot-password]', e);
    return NextResponse.json({ error: '系統錯誤，請稍後再試' }, { status: 500 });
  }
}
