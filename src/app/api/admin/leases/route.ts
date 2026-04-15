import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET /api/admin/leases
 * 計算已通過申請的預估租約到期狀況
 *
 * 邏輯：
 *   租約開始日 = moveInDate
 *   租約到期日 = moveInDate + duration 個月
 *   已到期 = 到期日 < 今天
 *   即將到期（30天內）= 今天 ≤ 到期日 < 今天 + 30天
 *   進行中 = 到期日 ≥ 今天 + 30天
 *
 * 只回傳已核准（status = 'approved'）且 moveInDate 已到的申請
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  // 只查已入住的（moveInDate <= today）
  const applications = await prisma.application.findMany({
    where: {
      status: 'approved',
      moveInDate: { lte: todayStr },
    },
    include: {
      tenant: { select: { id: true, name: true, email: true, phone: true } },
      listing: {
        select: {
          id: true, title: true, city: true, district: true,
          owner: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { moveInDate: 'asc' },
  });

  const leases = applications.map(app => {
    // 計算到期日
    const moveIn = new Date(app.moveInDate);
    const expiry = new Date(moveIn);
    expiry.setMonth(expiry.getMonth() + app.duration);
    const expiryStr = expiry.toISOString().slice(0, 10);

    // 距離到期的天數
    const diffMs = expiry.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let leaseStatus: 'expired' | 'expiring_soon' | 'active';
    if (daysLeft < 0) leaseStatus = 'expired';
    else if (daysLeft <= 30) leaseStatus = 'expiring_soon';
    else leaseStatus = 'active';

    return {
      applicationId: app.id,
      moveInDate: app.moveInDate,
      duration: app.duration,
      expiryDate: expiryStr,
      daysLeft,
      leaseStatus,
      tenant: app.tenant,
      listing: app.listing,
    };
  });

  // 分組統計
  const summary = {
    total: leases.length,
    expired: leases.filter(l => l.leaseStatus === 'expired').length,
    expiringSoon: leases.filter(l => l.leaseStatus === 'expiring_soon').length,
    active: leases.filter(l => l.leaseStatus === 'active').length,
  };

  return NextResponse.json({ summary, leases });
}
