/**
 * GET /api/cron/lease-reminders
 *
 * 租約到期提醒 Cron Job
 * ─ 建議設定每日執行一次（例如每天早上 9:00 UTC+8）
 * ─ 保護方式：需帶 ?secret=<CRON_SECRET>（在 .env 設定 CRON_SECRET=...）
 * ─ Vercel Cron 設定範例（vercel.json）：
 *     "crons": [{ "path": "/api/cron/lease-reminders", "schedule": "0 1 * * *" }]
 * ─ 本機測試：直接 GET http://localhost:3001/api/cron/lease-reminders?secret=dev
 *
 * 觸發條件：
 *   - milestone 30：租約到期日 ≤ 30 天，且尚未寄過 30 天提醒
 *   - milestone 7 ：租約到期日 ≤ 7 天，且尚未寄過 7 天提醒
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendLeaseExpiryReminder } from '@/lib/email';

// NOTE: LeaseReminder 是新增的 model，需要在本機執行以下指令才能取得正確型別：
//   npx prisma db push
// 執行後即可移除下方的 eslint-disable 與 prismaAny
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;

export async function GET(req: NextRequest) {
  // ── 身份驗證 ──────────────────────────────────────────────────────────────
  // ✅ 安全改善：優先讀取 Authorization: Bearer <secret> header（不在 URL 暴露 secret）
  // 向後相容：若無 header 則嘗試 query param ?secret=（標記為棄用）
  const cronSecret = process.env.CRON_SECRET || 'dev';

  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('secret');

  const providedSecret = bearerToken ?? querySecret;
  if (querySecret && !bearerToken) {
    console.warn('[cron/lease-reminders] ?secret= query param is deprecated. Use Authorization: Bearer header instead.');
  }

  // 長度相等時使用 Buffer 比較防止 timing attack
  const expectedBuf = Buffer.from(cronSecret);
  const providedBuf = Buffer.from(providedSecret ?? '');
  const isValid =
    expectedBuf.length === providedBuf.length &&
    Buffer.compare(expectedBuf, providedBuf) === 0;

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 取得所有已核准且有入住日期的申請 ──────────────────────────────
  const approvedApps = await prisma.application.findMany({
    where: {
      status: 'approved',
      moveInDate: { not: '' },
    },
    include: {
      tenant: { select: { id: true, name: true, email: true } },
      listing: {
        select: {
          id: true, title: true, city: true, district: true,
        },
      },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results = {
    processed: 0,
    sent30: 0,
    sent7: 0,
    skipped: 0,
    errors: 0,
  };

  for (const app of approvedApps) {
    if (!app.moveInDate || !app.duration) { results.skipped++; continue; }

    const moveIn = new Date(app.moveInDate);
    if (isNaN(moveIn.getTime())) { results.skipped++; continue; }

    const expiry = new Date(moveIn);
    expiry.setMonth(expiry.getMonth() + app.duration);

    // 已過期超過 7 天 → 不再提醒
    const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < -7 || daysLeft > 30) { results.skipped++; continue; }

    results.processed++;

    // 決定要觸發哪些 milestone
    const milestones: number[] = [];
    if (daysLeft <= 30) milestones.push(30);
    if (daysLeft <= 7)  milestones.push(7);

    for (const milestone of milestones) {
      try {
        // 確認尚未寄過此 milestone
        const existing = await prismaAny.leaseReminder.findUnique({
          where: {
            applicationId_milestone: {
              applicationId: app.id,
              milestone,
            },
          },
        });
        if (existing) continue; // 已寄過，跳過

        // 寄送 Email
        await sendLeaseExpiryReminder({
          tenantEmail:     app.tenant.email,
          tenantName:      app.tenant.name,
          listingTitle:    app.listing.title,
          listingCity:     app.listing.city,
          listingDistrict: app.listing.district,
          moveInDate:      new Date(app.moveInDate).toLocaleDateString('zh-TW'),
          expiryDate:      expiry.toLocaleDateString('zh-TW'),
          daysLeft:        Math.max(daysLeft, 0),
          listingId:       app.listing.id,
        });

        // 記錄已寄送（防止重複）
        await prismaAny.leaseReminder.create({
          data: { applicationId: app.id, milestone },
        });

        if (milestone === 30) results.sent30++;
        if (milestone === 7)  results.sent7++;

      } catch (err) {
        console.error(`[lease-reminders] 寄信失敗 app=${app.id} milestone=${milestone}:`, err);
        results.errors++;
      }
    }
  }

  console.log('[lease-reminders] 執行完成', results);
  return NextResponse.json({
    ok: true,
    runAt: new Date().toISOString(),
    ...results,
  });
}
