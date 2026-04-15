import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  notifyTenantViewingConfirmed,
  notifyViewingCancelled,
} from '@/lib/email';

/**
 * 驗證值是合法 ISO 日期時間字串且為未來時間
 * 防止 NaN bypass：new Date('invalid') ≤ new Date() 為 false（NaN 比較永遠為 false）
 */
function isValidFutureDateTime(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  const d = new Date(value);
  return !isNaN(d.getTime()) && d > new Date();
}

// PATCH /api/viewings/[id] — 房東確認或取消；租客取消
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const { id } = await params;

  const viewing = await prisma.viewingRequest.findUnique({
    where: { id },
    include: {
      listing: {
        select: {
          id: true, ownerId: true, title: true,
          address: true, city: true, district: true,
          owner: { select: { email: true, name: true, phone: true } },
        },
      },
      tenant: { select: { id: true, email: true, name: true } },
    },
  });
  if (!viewing) return NextResponse.json({ error: '預約不存在' }, { status: 404 });

  const isLandlord = viewing.listing.ownerId === user.id;
  const isTenant   = viewing.tenantId === user.id;
  if (!isLandlord && !isTenant && user.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  // ── JSON 解析（防止畸形請求觸發 500）──────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { status, confirmedTime } = body;

  // 房東可 confirmed / cancelled；租客只能 cancelled
  const validStatuses = isLandlord || user.role === 'admin'
    ? ['confirmed', 'cancelled']
    : ['cancelled'];
  if (typeof status !== 'string' || !validStatuses.includes(status)) {
    return NextResponse.json({ error: '不合法的狀態' }, { status: 400 });
  }

  // ✅ 只有 pending / confirmed 狀態才能操作（終止狀態守衛）
  if (viewing.status === 'cancelled' || viewing.status === 'completed') {
    return NextResponse.json({ error: '此預約已結束，無法再修改' }, { status: 400 });
  }

  // ✅ confirmed 必須提供合法且未來的 confirmedTime（NaN bypass 防護）
  if (status === 'confirmed') {
    if (!confirmedTime) {
      return NextResponse.json({ error: '請選擇確認的看房時間' }, { status: 400 });
    }
    // new Date('invalid') <= new Date() 為 false（NaN 比較永遠 false）
    // 必須用 isValidFutureDateTime 明確攔截非法日期字串
    if (!isValidFutureDateTime(confirmedTime)) {
      return NextResponse.json({ error: '確認時間格式錯誤或不是未來的時間點' }, { status: 400 });
    }
    // 防止房東重複確認已確認的預約（避免意外覆蓋已寄出的通知）
    if (viewing.status === 'confirmed') {
      return NextResponse.json({ error: '此預約已確認，如需修改請先取消後重新預約' }, { status: 400 });
    }
  }

  const updated = await prisma.viewingRequest.update({
    where: { id },
    data: {
      status,
      confirmedTime: status === 'confirmed' ? confirmedTime : null,
    },
  });

  const fullAddress = `${viewing.listing.city}${viewing.listing.district}${viewing.listing.address}`;

  // 📧 Email 通知
  if (status === 'confirmed' && confirmedTime) {
    notifyTenantViewingConfirmed({
      tenantEmail: viewing.tenant.email,
      tenantName: viewing.tenant.name,
      listingTitle: viewing.listing.title,
      confirmedTime,
      address: fullAddress,
      landlordPhone: viewing.listing.owner.phone,
    }).catch(() => {});
  } else if (status === 'cancelled') {
    if (isLandlord || user.role === 'admin') {
      // 房東/管理員取消 → 通知租客
      notifyViewingCancelled({
        recipientEmail: viewing.tenant.email,
        recipientName: viewing.tenant.name,
        cancellerRole: 'landlord',
        listingTitle: viewing.listing.title,
      }).catch(() => {});
    } else {
      // 租客取消 → 通知房東
      notifyViewingCancelled({
        recipientEmail: viewing.listing.owner.email,
        recipientName: viewing.listing.owner.name,
        cancellerRole: 'tenant',
        listingTitle: viewing.listing.title,
      }).catch(() => {});
    }
  }

  return NextResponse.json(updated);
}
