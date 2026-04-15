import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { notifyVerificationResult } from '@/lib/email';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: '無權限' }, { status: 403 });

  const listings = await prisma.listing.findMany({
    include: { owner: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500, // 防止大量房源時返回海量資料
  });
  // ✅ 安全解析 images（DB 資料損壞時防止 JSON.parse 拋出 500）
  return NextResponse.json(listings.map(l => ({
    ...l,
    images: (() => { try { return JSON.parse(l.images || '[]'); } catch { return []; } })(),
  })));
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: '無權限' }, { status: 403 });

  // ── JSON 解析（防止畸形請求觸發 500）──────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { id, status, rejectReason } = body;

  // ✅ id 型別守衛
  if (!id || typeof id !== 'string' || !id.trim()) {
    return NextResponse.json({ error: '請提供有效的房源 ID' }, { status: 400 });
  }
  // ✅ status 白名單（防止任意狀態值寫入 DB）
  if (!status || typeof status !== 'string' || !['active', 'rejected', 'inactive', 'pending'].includes(status)) {
    return NextResponse.json({ error: '無效的狀態值' }, { status: 400 });
  }

  const updated = await prisma.listing.update({ where: { id }, data: { status } });

  // 📧 通知房東審核結果
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { owner: { select: { email: true, name: true } } },
  });
  if (listing) {
    const approved = status === 'active';
    const rejected = status === 'rejected';
    if (approved || rejected) {
      notifyVerificationResult({
        userEmail: listing.owner.email,
        userName: listing.owner.name,
        status: approved ? 'approved' : 'rejected',
        note: (typeof rejectReason === 'string' && rejectReason.trim()) ? rejectReason.trim() : (rejected ? '請確認房源資訊是否完整、照片是否清晰，修改後可重新提交' : undefined),
      }).catch(() => {});
    }
  }

  return NextResponse.json(updated);
}
