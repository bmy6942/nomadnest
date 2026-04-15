import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import { prisma } from './db';

// ⚠️ 安全規則：JWT_SECRET 必須在環境變數中設定。
// 若未設定，生產環境將拋出錯誤，開發環境使用臨時隨機 secret（每次重啟失效）。
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[auth] JWT_SECRET environment variable is not set. ' +
        'Set a strong random secret (≥ 32 characters) before deploying.'
      );
    }
    // 開發環境：使用隨機 secret（重啟後 token 失效，強制開發者設定真正的 secret）
    console.warn(
      '[auth] WARNING: JWT_SECRET is not set. Using a temporary random secret. ' +
      'Add JWT_SECRET to your .env file.'
    );
    return 'dev-only-' + Math.random().toString(36).slice(2);
  }
  // 強度警告：少於 32 字元在生產環境不夠安全
  if (secret.length < 32 && process.env.NODE_ENV === 'production') {
    throw new Error(
      '[auth] JWT_SECRET is too short (< 32 characters). ' +
      'Use: openssl rand -hex 32  to generate a strong secret.'
    );
  }
  if (secret.length < 32) {
    console.warn(
      `[auth] WARNING: JWT_SECRET is only ${secret.length} chars. ` +
      'For production, use at least 32 characters (openssl rand -hex 32).'
    );
  }
  return secret;
}

const SECRET = getSecret();
const COOKIE = 'nn_token';

/**
 * 匯出 JWT secret getter 供其他路由使用（email verify、password reset token 等）
 * 禁止直接使用 process.env.JWT_SECRET || 'hardcoded-fallback'
 * 所有 JWT 操作必須透過此函式取得 secret，確保生產環境安全性一致
 */
export function getJwtSecret(): string {
  return SECRET;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  /** JWT 標準欄位：到期時間（UNIX timestamp，秒）— jsonwebtoken 自動填入 */
  exp?: number;
  /** JWT 標準欄位：簽發時間（UNIX timestamp，秒）— jsonwebtoken 自動填入 */
  iat?: number;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * 計算 JWT 原始字串的 SHA-256 hash（hex 格式）
 * 用於 RevokedToken 表的唯一索引，避免直接儲存原始 token。
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * 非同步清除過期的撤銷 token（靜默失敗，不影響主流程）
 * 在 logout 路由呼叫，避免 RevokedToken 表無限增長。
 * 使用 $executeRaw 繞過 Prisma client 型別限制（表在 schema 但 client 尚未重新生成）。
 */
export function cleanupExpiredRevokedTokens(): void {
  prisma
    .$executeRaw`DELETE FROM RevokedToken WHERE expiresAt < datetime('now')`
    .catch(() => { /* 靜默失敗，不影響主流程 */ });
}

export async function getCurrentUser() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE)?.value;
    if (!token) return null;

    // ① 驗證 JWT 簽章與有效期
    const payload = verifyToken(token);
    if (!payload) return null;

    // ② 檢查 token 是否已被主動撤銷（登出後防止重用）
    //    使用 $queryRaw 繞過 Prisma client 型別限制
    const tokenHash = hashToken(token);
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM RevokedToken WHERE tokenHash = ${tokenHash} LIMIT 1
    `;
    if (rows.length > 0) return null;

    // ③ 查詢用戶資料
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, name: true, email: true, role: true,
        verified: true, banned: true, avatar: true,
        verificationStatus: true, onboardingCompleted: true, bio: true,
      },
    });

    // 被封鎖的帳號視同未登入
    if (user?.banned) return null;
    return user;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = COOKIE;
