import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME, verifyToken, hashToken, cleanupExpiredRevokedTokens } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        const tokenHash = hashToken(token);
        const id = crypto.randomUUID();
        // JWT exp 欄位是 UNIX 秒，轉換為 ISO 字串供 SQLite 使用
        const expiresAt = payload.exp
          ? new Date(payload.exp * 1000).toISOString()
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // INSERT OR IGNORE 防止重複登出時的唯一鍵衝突
        // 使用 $executeRaw 繞過 Prisma client 型別限制（generate 在沙箱無法執行）
        await prisma.$executeRaw`
          INSERT OR IGNORE INTO RevokedToken (id, tokenHash, expiresAt, revokedAt)
          VALUES (${id}, ${tokenHash}, ${expiresAt}, datetime('now'))
        `;

        // 非同步清除過期舊記錄（不 await，不阻塞回應）
        cleanupExpiredRevokedTokens();
      }
    }
  } catch {
    // 撤銷失敗時不阻止登出，Cookie 仍會被刪除
    // 這確保用戶能成功登出，即使 DB 暫時不可用
  }

  const res = NextResponse.json({ success: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
