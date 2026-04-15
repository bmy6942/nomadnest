/**
 * POST /api/push/subscribe  — 儲存 Push 訂閱
 * DELETE /api/push/subscribe — 移除 Push 訂閱（取消通知）
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// ── POST：訂閱 ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }

  let body: {
    subscription?: {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    oldEndpoint?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '格式錯誤' }, { status: 400 });
  }

  const { subscription, oldEndpoint } = body;
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: '訂閱資料不完整' }, { status: 400 });
  }

  const userAgent = req.headers.get('user-agent')?.slice(0, 200) ?? null;

  try {
    // 若有舊 endpoint（pushsubscriptionchange 事件），先刪除
    if (oldEndpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id, endpoint: oldEndpoint },
      });
    }

    // upsert：同 endpoint 只保存一筆（可能跨用戶 → 此用戶覆蓋）
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId:    user.id,
        p256dh:    subscription.keys.p256dh,
        auth:      subscription.keys.auth,
        userAgent,
      },
      create: {
        userId:    user.id,
        endpoint:  subscription.endpoint,
        p256dh:    subscription.keys.p256dh,
        auth:      subscription.keys.auth,
        userAgent,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Push/Subscribe] Error:', err);
    return NextResponse.json({ error: '儲存失敗' }, { status: 500 });
  }
}

// ── DELETE：取消訂閱 ──────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '格式錯誤' }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ error: '缺少 endpoint' }, { status: 400 });
  }

  try {
    await prisma.pushSubscription.deleteMany({
      where: { userId: user.id, endpoint: body.endpoint },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Push/Unsubscribe] Error:', err);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
