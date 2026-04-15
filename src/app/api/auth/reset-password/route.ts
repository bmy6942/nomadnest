import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { resetPasswordLimiter } from '@/lib/rateLimit';
import { getJwtSecret } from '@/lib/auth';

// ✅ 透過 getJwtSecret() 取得 secret：生產環境未設定時會拋出錯誤
const SECRET = getJwtSecret();

export async function POST(req: NextRequest) {
  try {
    // ✅ 速率限制：同一 IP 5 次 / 30 分鐘
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limitResult = resetPasswordLimiter.check(`reset:ip:${ip}`);
    if (!limitResult.ok) {
      return NextResponse.json(
        { error: '請求過於頻繁，請稍後再試' },
        { status: 429, headers: { 'Retry-After': String(limitResult.retryAfter ?? 1800) } }
      );
    }

    // ── JSON 解析（防止畸形請求觸發 500）──────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
    }

    const { token, uid, password } = body;

    if (!token || typeof token !== 'string' || !uid || typeof uid !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: '密碼須介於 8 到 128 個字元' }, { status: 400 });
    }

    // 先取得用戶的現有密碼 hash（作為 secret suffix）
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true, password: true },
    });

    if (!user) {
      return NextResponse.json({ error: '重設連結無效或已過期' }, { status: 400 });
    }

    // 驗證 JWT（使用舊密碼 hash 後 8 碼作為 secret suffix）
    const tokenSecret = SECRET + user.password.slice(-8);
    let payload: { userId: string; email: string; purpose: string };
    try {
      payload = jwt.verify(token, tokenSecret) as typeof payload;
    } catch {
      return NextResponse.json({ error: '重設連結無效或已過期，請重新申請' }, { status: 400 });
    }

    if (payload.purpose !== 'password-reset' || payload.userId !== uid) {
      return NextResponse.json({ error: '重設連結無效' }, { status: 400 });
    }

    // 更新密碼
    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return NextResponse.json({ message: '密碼已成功重設，請重新登入。' });
  } catch (e) {
    console.error('[reset-password]', e);
    return NextResponse.json({ error: '系統錯誤，請稍後再試' }, { status: 500 });
  }
}
