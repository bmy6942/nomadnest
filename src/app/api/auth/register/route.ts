import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/db';
import { signToken, COOKIE_NAME, getJwtSecret } from '@/lib/auth';
import { sendEmailVerification } from '@/lib/email';
import { registerLimiter } from '@/lib/rateLimit';

// ✅ 透過 getJwtSecret() 取得 secret：在生產環境未設定時會拋出錯誤，避免使用弱預設值
const SECRET = getJwtSecret();

// ── 欄位長度限制 ──────────────────────────────────────────────────────────────
const NAME_MAX  = 50;
const EMAIL_MAX = 100;
const PASS_MIN  = 8;   // 強制 8 位（比舊版 6 位更安全）
const PASS_MAX  = 128;

// 簡單 email 格式驗證（不依賴第三方 library）
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    // ── 速率限制：每 IP 最多 5 次 / 60 分鐘，防止批量建帳 ──────────────────
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limitResult = registerLimiter.check(`register:ip:${ip}`);
    if (!limitResult.ok) {
      return NextResponse.json(
        { error: `註冊嘗試過於頻繁，請 ${Math.ceil((limitResult.retryAfter ?? 3600) / 60)} 分鐘後再試` },
        {
          status: 429,
          headers: { 'Retry-After': String(limitResult.retryAfter ?? 3600) },
        }
      );
    }

    // ── 解析 body ─────────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
    }

    const { name, email, password, role } = body as {
      name?: unknown; email?: unknown; password?: unknown; role?: unknown;
    };

    // ── 型別檢查 ──────────────────────────────────────────────────────────────
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: '請填寫所有必填欄位' }, { status: 400 });
    }

    // ── 長度 / 格式驗證 ───────────────────────────────────────────────────────
    const trimmedName  = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || trimmedName.length > NAME_MAX) {
      return NextResponse.json(
        { error: `姓名不得為空且不超過 ${NAME_MAX} 個字元` },
        { status: 400 }
      );
    }
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail) || trimmedEmail.length > EMAIL_MAX) {
      return NextResponse.json({ error: '請輸入有效的 Email 地址' }, { status: 400 });
    }
    if (password.length < PASS_MIN || password.length > PASS_MAX) {
      return NextResponse.json(
        { error: `密碼須介於 ${PASS_MIN} 到 ${PASS_MAX} 個字元` },
        { status: 400 }
      );
    }

    // role 白名單（外部用戶只能是 tenant 或 landlord）
    const safeRole = role === 'landlord' ? 'landlord' : 'tenant';

    // ── 重複 email 檢查 ───────────────────────────────────────────────────────
    const exists = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (exists) {
      return NextResponse.json({ error: '此 Email 已被註冊' }, { status: 400 });
    }

    // ── 建立帳號 ──────────────────────────────────────────────────────────────
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name:               trimmedName,
        email:              trimmedEmail,
        password:           hashed,
        role:               safeRole,
        verificationStatus: 'emailPending', // 驗證後改回 'none'
      },
    });

    // ── 發送 Email 驗證信 ─────────────────────────────────────────────────────
    const verifyToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'email-verify' },
      SECRET,
      { expiresIn: '7d' }
    );
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    const verifyLink = `${baseUrl}/auth/verify-email?token=${verifyToken}`;
    sendEmailVerification({ userEmail: user.email, userName: user.name, verifyLink }).catch(() => {});

    // ── 簽發 session cookie ───────────────────────────────────────────────────
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const res = NextResponse.json({
      success:      true,
      emailPending: true,
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
    return NextResponse.json({ error: '系統錯誤，請稍後再試' }, { status: 500 });
  }
}
