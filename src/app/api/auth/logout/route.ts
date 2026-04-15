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
        // JWT exp 欄位是 UNIX 秒，轉換為 Date 物件供 PostgreSQL 使用
        const expiresAt = payload.exp
          ? new Date(payload.exp * 1000)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // ON CONFLICT DO NOTHING 防止重複登出時的唯一鍵衝突（PostgreSQL 語法）
        // 使用 $executeRaw 繞過 Prisma client 型別限制
        await prisma.$executeRaw`
          INSERT INTO "RevokedToken" (id, "tokenHash", "expiresAt", "revokedAt")
          VALUES (${id}, ${tokenHash}, ${expiresAt}, NOW())
          ON CONFLICT ("tokenHash") DO NOTHING
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
