import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

// ── 管理員 Email 白名單（從環境變數讀取，避免個人資料寫死在程式碼）────────────
// Vercel 設定：ADMIN_EMAILS=your@gmail.com,other@gmail.com（逗號分隔）
// 也會保留 DB 中已有 role='admin' 的用戶（見下方 isAdmin 判斷）
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
  verified_email: boolean;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

  // ── 用戶拒絕授權 ──────────────────────────────────────────────────────────────
  if (error) {
    return NextResponse.redirect(`${baseUrl}/auth/login?error=google_cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/auth/login?error=google_invalid`);
  }

  // ── 驗證 CSRF state ────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const savedState = cookieStore.get('oauth_state')?.value;
  cookieStore.delete('oauth_state');

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${baseUrl}/auth/login?error=google_csrf`);
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri  = `${baseUrl}/api/auth/google/callback`;

  try {
    // ── Step 1：用 code 換 access token ──────────────────────────────────────────
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${baseUrl}/auth/login?error=google_token`);
    }

    // ── Step 2：取得 Google 用戶資訊 ─────────────────────────────────────────────
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser: GoogleUserInfo = await userInfoRes.json();

    if (!googleUser.email || !googleUser.verified_email) {
      return NextResponse.redirect(`${baseUrl}/auth/login?error=google_email_unverified`);
    }

    // ── Step 3：找或建立用戶 ──────────────────────────────────────────────────────
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: googleUser.id },
          { email: googleUser.email.toLowerCase() },
        ],
      },
    });

    // isAdmin：email 在白名單，OR 資料庫中已是 admin（合併帳號時保留角色）
    const isAdmin = ADMIN_EMAILS.includes(googleUser.email.toLowerCase())
      || user?.role === 'admin';
    let isNewUser = false;

    if (!user) {
      // 全新用戶 → 建立帳號（role 預設 tenant，onboarding 頁面會讓他選）
      user = await prisma.user.create({
        data: {
          name:         googleUser.name,
          email:        googleUser.email.toLowerCase(),
          password:     '', // Google 用戶無密碼
          role:         isAdmin ? 'admin' : 'tenant',
          avatar:       googleUser.picture,
          verified:     true, // Google 已驗證 email
          verificationStatus: 'approved',
          googleId:     googleUser.id,
          authProvider: 'google',
          onboardingCompleted: isAdmin, // admin 跳過 onboarding
        },
      });
      isNewUser = true;
    } else {
      // 現有用戶 → 自動合併（加上 googleId）
      const updateData: Record<string, unknown> = {};

      if (!user.googleId) {
        updateData.googleId     = googleUser.id;
        updateData.authProvider = 'both'; // 同時有 email + Google 登入
      }
      // 如果原本沒有頭像，補上 Google 大頭貼
      if (!user.avatar && googleUser.picture) {
        updateData.avatar = googleUser.picture;
      }
      // 確保 email 已驗證
      if (!user.verified) {
        updateData.verified = true;
        updateData.verificationStatus = 'approved';
      }
      // 管理員升級
      if (isAdmin && user.role !== 'admin') {
        updateData.role = 'admin';
      }

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    // ── Step 4：簽發 nn_token（與現有系統完全相容）──────────────────────────────
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // ── Step 5：決定重導向目標 ────────────────────────────────────────────────────
    const redirectTo = (isNewUser && !isAdmin)
      ? `${baseUrl}/onboarding`   // 新用戶 → 角色選擇
      : `${baseUrl}/dashboard`;   // 舊用戶 / admin → 直接進 dashboard

    // ── Step 6：設定 cookie 並重導向 ─────────────────────────────────────────────
    const response = NextResponse.redirect(redirectTo);
    response.cookies.set('nn_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 7, // 7 天
      path:     '/',
    });

    return response;

  } catch (err) {
    console.error('[Google OAuth callback error]', err);
    return NextResponse.redirect(`${baseUrl}/auth/login?error=google_server`);
  }
}
