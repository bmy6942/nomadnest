/**
 * GET /api/cron/saved-search-notify
 *
 * 已儲存搜尋新房源通知 Cron Job
 * ─ 建議每天執行一次（例如 每天早上 8:00 UTC+8）
 * ─ 保護方式：需帶 ?secret=<CRON_SECRET>
 * ─ Vercel Cron（vercel.json）：
 *     { "path": "/api/cron/saved-search-notify", "schedule": "0 0 * * *" }
 * ─ 本機測試：
 *     curl "http://localhost:3001/api/cron/saved-search-notify?secret=dev"
 *
 * 比對邏輯：
 *   每筆 SavedSearch 有 lastSentAt，只比對「上次通知後」新上架的房源
 *   未曾通知過 → 比對最近 24 小時內上架的房源
 *   符合條件（city / type / maxPrice / minWifi / q）且至少 1 筆 → 寄信並更新 lastSentAt
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { notifySavedSearchMatch } from '@/lib/email';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(req: NextRequest) {
  // ── 身份驗證 ──────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (secret !== (process.env.CRON_SECRET || 'dev')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 取得所有儲存搜尋（含用戶資訊） ──────────────────────────────
  const savedSearches = await db.savedSearch.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  }) as Array<{
    id: string;
    name: string;
    city: string | null;
    type: string | null;
    maxPrice: number | null;
    minWifi: number | null;
    q: string | null;
    lastSentAt: Date | null;
    user: { id: string; name: string; email: string };
  }>;

  const results = {
    checked: savedSearches.length,
    notified: 0,
    skipped: 0,
    errors: 0,
  };

  for (const search of savedSearches) {
    try {
      // 從上次通知時間起算，未通知過則取最近 24 小時
      const since = search.lastSentAt
        ? new Date(search.lastSentAt)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);

      // ── 建立篩選條件 ─────────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        status: 'active',
        createdAt: { gt: since },
      };

      if (search.city)     where.city     = search.city;
      if (search.type)     where.type     = search.type;
      if (search.maxPrice) where.price    = { lte: search.maxPrice };
      if (search.minWifi)  where.wifiSpeed = { gte: search.minWifi };
      if (search.q) {
        const q = search.q.toLowerCase();
        where.OR = [
          { title:       { contains: q } },
          { description: { contains: q } },
          { district:    { contains: q } },
        ];
      }

      const matches = await prisma.listing.findMany({
        where,
        select: { id: true, title: true, city: true, district: true, price: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      if (matches.length === 0) {
        results.skipped++;
        continue;
      }

      // ── 寄送通知 Email ───────────────────────────────────────────
      await notifySavedSearchMatch({
        userEmail:   search.user.email,
        userName:    search.user.name,
        searchName:  search.name,
        matchCount:  matches.length,
        listings:    matches.map(l => ({
          id:    l.id,
          title: l.title,
          city:  `${l.city} ${l.district}`,
          price: l.price,
        })),
      });

      // ── 更新 lastSentAt ──────────────────────────────────────────
      await db.savedSearch.update({
        where: { id: search.id },
        data:  { lastSentAt: new Date() },
      });

      results.notified++;
    } catch (err) {
      console.error(`[saved-search-notify] 處理失敗 id=${search.id}:`, err);
      results.errors++;
    }
  }

  console.log('[saved-search-notify] 執行完成', results);
  return NextResponse.json({
    ok: true,
    runAt: new Date().toISOString(),
    ...results,
  });
}
