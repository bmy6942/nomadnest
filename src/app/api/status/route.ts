/**
 * GET /api/status
 * 超輕量 Navbar 角標 API：一次請求取得未讀訊息數 + 未讀通知數
 * 取代原本 Navbar 每 30s 同時打 /api/conversations（N+1）+ /api/notifications（5 查詢）的設計
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ unreadMessages: 0, unreadNotifications: 0 });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [unreadMessages, notifData] = await Promise.all([
    // ① 未讀訊息數：一個 count 查詢搞定
    prisma.message.count({
      where: {
        read: false,
        senderId: { not: user.id },
        conversation: user.role === 'tenant'
          ? { tenantId: user.id }
          : user.role === 'landlord'
          ? { landlordId: user.id }
          : {},
      },
    }),

    // ② 通知計數：依角色並行統計（取代逐條遍歷）
    (async () => {
      if (user.role === 'tenant') {
        const [approvedApps, rejectedApps, repliedApps, confirmedViewings, unreadMsgConvs] = await Promise.all([
          // 申請已接受（最近 7 天）
          prisma.application.count({
            where: { tenantId: user.id, status: 'approved', updatedAt: { gte: sevenDaysAgo } },
          }),
          // 申請被婉拒（最近 7 天）
          prisma.application.count({
            where: { tenantId: user.id, status: 'rejected', updatedAt: { gte: sevenDaysAgo } },
          }),
          // 房東回覆（最近 7 天，有 landlordReply）
          prisma.application.count({
            where: {
              tenantId: user.id,
              landlordReply: { not: null },
              updatedAt: { gte: sevenDaysAgo },
            },
          }),
          // 看房已確認（最近 7 天）
          prisma.viewingRequest.count({
            where: { tenantId: user.id, status: 'confirmed', updatedAt: { gte: sevenDaysAgo } },
          }),
          // 未讀訊息對話數
          prisma.message.groupBy({
            by: ['conversationId'],
            where: { read: false, senderId: { not: user.id }, conversation: { tenantId: user.id } },
            _count: { id: true },
          }),
        ]);
        return approvedApps + rejectedApps + repliedApps + confirmedViewings + unreadMsgConvs.length;

      } else if (user.role === 'landlord') {
        const [newApps, newViewings, reviewedListings, unreadMsgConvs] = await Promise.all([
          prisma.application.count({
            where: { listing: { ownerId: user.id }, status: 'pending', createdAt: { gte: sevenDaysAgo } },
          }),
          prisma.viewingRequest.count({
            where: { listing: { ownerId: user.id }, status: 'pending', createdAt: { gte: sevenDaysAgo } },
          }),
          prisma.listing.count({
            where: { ownerId: user.id, status: { in: ['active', 'rejected'] }, updatedAt: { gte: sevenDaysAgo } },
          }),
          prisma.message.groupBy({
            by: ['conversationId'],
            where: { read: false, senderId: { not: user.id }, conversation: { landlordId: user.id } },
            _count: { id: true },
          }),
        ]);
        return newApps + newViewings + reviewedListings + unreadMsgConvs.length;

      } else {
        // admin：只看未讀訊息
        return 0;
      }
    })(),
  ]);

  return NextResponse.json(
    { unreadMessages, unreadNotifications: notifData },
    {
      headers: {
        // 最多 30 秒快取（對應 Navbar 輪詢間隔），過期後 stale-while-revalidate 仍可顯示舊值
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    }
  );
}
