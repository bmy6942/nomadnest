/**
 * POST /api/push/send  — 伺服器端主動推播（供內部 API 呼叫）
 *
 * 請求格式：
 * {
 *   userId:  string       // 接收者 userId
 *   payload: PushPayload  // 通知內容
 *   secret:  string       // CRON_SECRET（防止外部濫用）
 * }
 *
 * 或用 Authorization: Bearer <CRON_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendPushNotification, type PushPayload } from '@/lib/webpush';

export async function POST(req: NextRequest) {
  // ── 驗證內部呼叫權限 ──────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  let body: { userId?: string; payload?: PushPayload; secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '格式錯誤' }, { status: 400 });
  }

  const providedSecret = bearerToken || body.secret;
  const cronSecret     = process.env.CRON_SECRET;

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, payload } = body;
  if (!userId || !payload?.title || !payload?.body) {
    return NextResponse.json({ error: '缺少必要欄位：userId, payload.title, payload.body' }, { status: 400 });
  }

  // ── 取得用戶的所有 Push 訂閱 ─────────────────────────────────────────────
  let subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;
  try {
    subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
  } catch (err) {
    console.error('[Push/Send] DB error:', err);
    return NextResponse.json({ error: 'DB 查詢失敗' }, { status: 500 });
  }

  if (subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: '該用戶無推播訂閱' });
  }

  // ── 逐一發送，收集失效的訂閱 ──────────────────────────────────────────────
  const goneIds: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendPushNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      if (result === 'gone') {
        goneIds.push(sub.id);
      } else {
        sent++;
      }
    })
  );

  // ── 清除失效訂閱 ───────────────────────────────────────────────────────────
  if (goneIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: goneIds } } }).catch(() => {});
  }

  return NextResponse.json({ ok: true, sent, gone: goneIds.length });
}
