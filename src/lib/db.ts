import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// ✅ 全域單例，避免開發模式下 Hot Reload 不斷建立新連線
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']  // 開發：顯示錯誤與警告，方便除錯
      : ['error'],          // 生產：僅記錄錯誤
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
