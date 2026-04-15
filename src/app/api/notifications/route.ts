import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// 從現有資料動態產生通知（不需要新增 Notification 資料表）
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const notifications: Array<{
    id: string; type: string; title: string; body: string;
    href: string; createdAt: string; read: boolean;
  }> = [];

  if (user.role === 'tenant') {
    // ── 租客通知 ────────────────────────────────────────────────
    // 1a. 申請獲接受（最近 7 天）
    const approvedApps = await prisma.application.findMany({
      where: { tenantId: user.id, status: 'approved', updatedAt: { gte: sevenDaysAgo } },
      include: { listing: { select: { id: true, title: true, city: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    for (const a of approvedApps) {
      notifications.push({
        id: `app-approved-${a.id}`,
        type: 'success',
        title: '🎉 申請已獲接受！',
        body: `${a.listing.title}（${a.listing.city}）的房東已接受你的入住申請`,
        href: `/dashboard`,
        createdAt: a.updatedAt.toISOString(),
        read: false,
      });
    }

    // 1b. 申請被婉拒（最近 7 天）
    const rejectedApps = await prisma.application.findMany({
      where: { tenantId: user.id, status: 'rejected', updatedAt: { gte: sevenDaysAgo } },
      include: { listing: { select: { id: true, title: true, city: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    for (const a of rejectedApps) {
      notifications.push({
        id: `app-rejected-${a.id}`,
        type: 'warning',
        title: '申請未通過',
        body: `${a.listing.title}（${a.listing.city}）的申請未被接受，可繼續瀏覽其他房源`,
        href: '/listings',
        createdAt: a.updatedAt.toISOString(),
        read: false,
      });
    }

    // 1c. 房東回覆申請（最近 7 天，不論申請狀態）
    const repliedApps = await prisma.application.findMany({
      where: {
        tenantId: user.id,
        landlordReply: { not: null },
        updatedAt: { gte: sevenDaysAgo },
      },
      include: { listing: { select: { id: true, title: true, city: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    for (const a of repliedApps) {
      notifications.push({
        id: `app-reply-${a.id}`,
        type: 'reply',
        title: '💬 房東回覆了你的申請',
        body: `「${a.listing.title}」的房東留了訊息：${(a.landlordReply || '').slice(0, 40)}${(a.landlordReply || '').length > 40 ? '…' : ''}`,
        href: '/dashboard',
        createdAt: a.updatedAt.toISOString(),
        read: false,
      });
    }

    // 2. 看房預約確認（最近 7 天）
    const viewings = await prisma.viewingRequest.findMany({
      where: { tenantId: user.id, status: 'confirmed', updatedAt: { gte: sevenDaysAgo } },
      include: { listing: { select: { id: true, title: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    for (const v of viewings) {
      const confirmedTime = v.confirmedTime
        ? new Date(v.confirmedTime).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
      notifications.push({
        id: `viewing-confirmed-${v.id}`,
        type: 'info',
        title: '📅 看房時間已確認',
        body: `${v.listing.title} 的看房已排定${confirmedTime ? `：${confirmedTime}` : ''}`,
        href: '/dashboard',
        createdAt: v.updatedAt.toISOString(),
        read: false,
      });
    }

    // 4. 租約即將到期提醒（30 天以內）
    const approvedForLease = await prisma.application.findMany({
      where: { tenantId: user.id, status: 'approved', moveInDate: { not: '' } },
      include: { listing: { select: { id: true, title: true, city: true } } },
    });
    for (const a of approvedForLease) {
      if (!a.moveInDate || !a.duration) continue;
      const moveIn = new Date(a.moveInDate);
      if (isNaN(moveIn.getTime())) continue;
      const expiry = new Date(moveIn);
      expiry.setMonth(expiry.getMonth() + a.duration);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiry < today) continue; // 已過期（另外有 expired 通知）
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 60) {
        const urgency = daysLeft <= 7 ? '🔴' : daysLeft <= 14 ? '🟠' : '⚠️';
        notifications.push({
          id: `lease-expiry-${a.id}`,
          type: daysLeft <= 7 ? 'warning' : 'info',
          title: `${urgency} 租約即將到期（剩 ${daysLeft} 天）`,
          body: `「${a.listing.title}」（${a.listing.city}）的租約將於 ${expiry.toLocaleDateString('zh-TW')} 到期，請提早安排續租或搬遷事宜`,
          href: '/dashboard',
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    }

    // 3. 新訊息（未讀）
    const unreadMsgs = await prisma.message.findMany({
      where: {
        read: false,
        senderId: { not: user.id },
        conversation: { tenantId: user.id },
      },
      include: {
        conversation: { include: { listing: { select: { id: true, title: true } }, landlord: { select: { name: true } } } },
        sender: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    // Group by conversation
    const convMap = new Map<string, typeof unreadMsgs[0]>();
    for (const m of unreadMsgs) {
      if (!convMap.has(m.conversationId)) convMap.set(m.conversationId, m);
    }
    for (const [convId, m] of convMap) {
      notifications.push({
        id: `msg-${convId}`,
        type: 'message',
        title: `💬 ${m.sender.name} 傳來新訊息`,
        body: m.content.length > 50 ? m.content.slice(0, 50) + '…' : m.content,
        href: `/messages/${convId}`,
        createdAt: m.createdAt.toISOString(),
        read: false,
      });
    }

  } else if (user.role === 'landlord' || user.role === 'admin') {
    // ── 房東通知 ────────────────────────────────────────────────
    // 1. 新申請（最近 7 天）
    const newApps = await prisma.application.findMany({
      where: {
        status: 'pending',
        createdAt: { gte: sevenDaysAgo },
        listing: { ownerId: user.id },
      },
      include: {
        listing: { select: { id: true, title: true } },
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    for (const a of newApps) {
      notifications.push({
        id: `new-app-${a.id}`,
        type: 'info',
        title: '📩 收到新的入住申請',
        body: `${a.tenant.name} 申請入住「${a.listing.title}」，預計 ${a.moveInDate} 入住`,
        href: '/applications',
        createdAt: a.createdAt.toISOString(),
        read: false,
      });
    }

    // 2. 新看房預約（最近 7 天）
    const newViewings = await prisma.viewingRequest.findMany({
      where: {
        status: 'pending',
        createdAt: { gte: sevenDaysAgo },
        listing: { ownerId: user.id },
      },
      include: {
        listing: { select: { id: true, title: true } },
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    for (const v of newViewings) {
      notifications.push({
        id: `new-viewing-${v.id}`,
        type: 'calendar',
        title: '📅 新的看房預約',
        body: `${v.tenant.name} 想預約看「${v.listing.title}」，請確認候選時間`,
        href: '/dashboard',
        createdAt: v.createdAt.toISOString(),
        read: false,
      });
    }

    // 3. 房源審核結果（最近 7 天）
    const reviewedListings = await prisma.listing.findMany({
      where: {
        ownerId: user.id,
        status: { in: ['active', 'rejected'] },
        updatedAt: { gte: sevenDaysAgo },
      },
      orderBy: { updatedAt: 'desc' },
    });
    for (const l of reviewedListings) {
      if (l.status === 'active') {
        notifications.push({
          id: `listing-approved-${l.id}`,
          type: 'success',
          title: '✅ 房源審核通過，已上架',
          body: `「${l.title}」已審核通過並正式上架，開始接受租客申請`,
          href: `/listings/${l.id}`,
          createdAt: l.updatedAt.toISOString(),
          read: false,
        });
      } else if (l.status === 'rejected') {
        notifications.push({
          id: `listing-rejected-${l.id}`,
          type: 'warning',
          title: '⚠ 房源未通過審核',
          body: `「${l.title}」未通過審核，請修改後重新提交`,
          href: `/listings/${l.id}/edit`,
          createdAt: l.updatedAt.toISOString(),
          read: false,
        });
      }
    }

    // 4. 新訊息（未讀）
    const unreadMsgs = await prisma.message.findMany({
      where: {
        read: false,
        senderId: { not: user.id },
        conversation: { landlordId: user.id },
      },
      include: {
        conversation: { include: { listing: { select: { id: true, title: true } }, tenant: { select: { name: true } } } },
        sender: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const convMap = new Map<string, typeof unreadMsgs[0]>();
    for (const m of unreadMsgs) {
      if (!convMap.has(m.conversationId)) convMap.set(m.conversationId, m);
    }
    for (const [convId, m] of convMap) {
      notifications.push({
        id: `msg-${convId}`,
        type: 'message',
        title: `💬 ${m.sender.name} 傳來新訊息`,
        body: m.content.length > 50 ? m.content.slice(0, 50) + '…' : m.content,
        href: `/messages/${convId}`,
        createdAt: m.createdAt.toISOString(),
        read: false,
      });
    }
  }

  // 依時間排序，最新在前
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    notifications: notifications.slice(0, 20),
    unreadCount: notifications.length,
  });
}
