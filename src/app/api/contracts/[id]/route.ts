/**
 * GET   /api/contracts/[id]   — 取得合約詳情
 * PATCH /api/contracts/[id]   — 簽名 / 取消合約
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// 簽名 Base64 大小上限（約 150KB 的 PNG 已足夠畫布簽名）
const SIGNATURE_MAX_LENGTH = 200_000;

// ---------- GET ----------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      application: {
        include: {
          listing: {
            select: {
              id: true, title: true, city: true, district: true,
              address: true, images: true, price: true,
              owner: { select: { id: true, name: true, email: true, phone: true, lineId: true } },
            },
          },
          tenant: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
    },
  });

  if (!contract) return NextResponse.json({ error: '合約不存在' }, { status: 404 });

  // 只有合約雙方與管理員可查看
  if (
    contract.landlordId !== user.id &&
    contract.tenantId   !== user.id &&
    user.role !== 'admin'
  ) {
    return NextResponse.json({ error: '無權查看此合約' }, { status: 403 });
  }

  return NextResponse.json({ contract });
}

// ---------- PATCH ----------
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const contract = await prisma.contract.findUnique({ where: { id: params.id } });
  if (!contract) return NextResponse.json({ error: '合約不存在' }, { status: 404 });

  if (
    contract.landlordId !== user.id &&
    contract.tenantId   !== user.id &&
    user.role !== 'admin'
  ) {
    return NextResponse.json({ error: '無權操作此合約' }, { status: 403 });
  }

  const body = await req.json();
  const { action, signature } = body; // action: 'sign' | 'cancel'

  if (action === 'cancel') {
    if (contract.status === 'completed') {
      return NextResponse.json({ error: '合約已完成，無法取消' }, { status: 400 });
    }
    if (contract.status === 'cancelled') {
      return NextResponse.json({ error: '合約已經是取消狀態' }, { status: 400 });
    }
    const updated = await prisma.contract.update({
      where: { id: params.id },
      data: { status: 'cancelled' },
    });
    return NextResponse.json({ contract: updated });
  }

  if (action === 'sign') {
    if (!signature) {
      return NextResponse.json({ error: '請提供簽名' }, { status: 400 });
    }
    // ── 簽名格式與大小驗證 ────────────────────────────────────────────────────
    if (
      typeof signature !== 'string' ||
      !signature.startsWith('data:image/') ||
      signature.length > SIGNATURE_MAX_LENGTH
    ) {
      return NextResponse.json(
        { error: '簽名格式錯誤或檔案過大（上限 200KB）' },
        { status: 400 }
      );
    }
    if (contract.status === 'cancelled') {
      return NextResponse.json({ error: '合約已取消' }, { status: 400 });
    }
    if (contract.status === 'completed') {
      return NextResponse.json({ error: '合約已完成簽署' }, { status: 400 });
    }

    const isTenant   = contract.tenantId   === user.id;
    const isLandlord = contract.landlordId === user.id;

    // 防止重複簽名
    if (isTenant   && contract.tenantSignedAt)   return NextResponse.json({ error: '您已簽署' }, { status: 400 });
    if (isLandlord && contract.landlordSignedAt) return NextResponse.json({ error: '您已簽署' }, { status: 400 });

    // 租客 → 等待房東；房東 → 直接完成（房東建立合約時已確認條款）
    const now = new Date();
    let newStatus = contract.status;
    const updateData: Record<string, unknown> = {};

    if (isTenant) {
      updateData.tenantSignature = signature;
      updateData.tenantSignedAt  = now;
      // 若房東已簽 → 完成；否則等待房東
      newStatus = contract.landlordSignedAt ? 'completed' : 'pending_landlord';
      updateData.status = newStatus;
    } else if (isLandlord) {
      updateData.landlordSignature = signature;
      updateData.landlordSignedAt  = now;
      // 若租客已簽 → 完成；否則等待租客
      newStatus = contract.tenantSignedAt ? 'completed' : 'pending_tenant';
      updateData.status = newStatus;
    }

    const updated = await prisma.contract.update({
      where: { id: params.id },
      data: updateData,
    });

    // 雙方都簽完 → 寄完成通知
    if (newStatus === 'completed') {
      import('@/lib/email').then(async ({ notifyContractCompleted }) => {
        const full = await prisma.contract.findUnique({
          where: { id: params.id },
          include: {
            application: {
              include: {
                listing: { select: { title: true } },
                tenant:  { select: { name: true, email: true } },
              },
            },
          },
        });
        if (!full) return;
        const landlordUser = await prisma.user.findUnique({
          where: { id: full.landlordId },
          select: { name: true, email: true },
        });
        if (!landlordUser) return;
        notifyContractCompleted({
          landlordEmail: landlordUser.email,
          landlordName:  landlordUser.name,
          tenantEmail:   full.application.tenant.email,
          tenantName:    full.application.tenant.name,
          listingTitle:  full.application.listing.title,
          contractId:    params.id,
        }).catch(() => {});
      });
    }

    return NextResponse.json({ contract: updated });
  }

  return NextResponse.json({ error: '不支援的操作' }, { status: 400 });
}
