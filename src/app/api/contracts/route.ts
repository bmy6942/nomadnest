/**
 * GET  /api/contracts        — 列出目前用戶的所有合約
 * POST /api/contracts        — 房東建立合約（需已核准的申請）
 *
 * ⚠️ 請在本機執行 `npx prisma db push` 以建立 Contract 資料表
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// 文字欄位字數上限
const TEXT_MAX = 2000;
// 金額上限（新台幣，合理租金範圍）
const AMOUNT_MAX = 1_000_000;

// ---------- GET ----------
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const contracts = await prisma.contract.findMany({
    where: {
      OR: [{ landlordId: user.id }, { tenantId: user.id }],
    },
    include: {
      // 取關聯資料供列表顯示
      application: {
        include: {
          listing: { select: { id: true, title: true, city: true, district: true, images: true } },
          tenant:  { select: { id: true, name: true, email: true, phone: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ contracts });
}

// ---------- POST ----------
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
  if (user.role !== 'landlord' && user.role !== 'admin') {
    return NextResponse.json({ error: '只有房東可以建立合約' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      applicationId,
      rentAmount, depositAmount,
      startDate, endDate,
      paymentDay = 5,
      rules = '', utilities = '', otherTerms = '',
    } = body;

    if (!applicationId || rentAmount == null || depositAmount == null || !startDate || !endDate) {
      return NextResponse.json({ error: '請填寫所有必填欄位' }, { status: 400 });
    }

    // 確認申請存在且屬於此房東
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        listing: { select: { id: true, ownerId: true, title: true } },
        tenant:  { select: { id: true, name: true, email: true } },
      },
    });
    if (!application) return NextResponse.json({ error: '申請不存在' }, { status: 404 });
    if (application.listing.ownerId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: '無權操作此申請' }, { status: 403 });
    }
    if (application.status !== 'approved') {
      return NextResponse.json({ error: '只有已核准的申請才能建立合約' }, { status: 400 });
    }

    // ── 數值欄位驗證 ──────────────────────────────────────────────────────────
    const rentNum    = Number(rentAmount);
    const depositNum = Number(depositAmount);
    const payDay     = Number(paymentDay);

    if (!Number.isFinite(rentNum) || rentNum <= 0 || rentNum > AMOUNT_MAX) {
      return NextResponse.json({ error: '租金需為 1~1,000,000 的正整數' }, { status: 400 });
    }
    if (!Number.isFinite(depositNum) || depositNum < 0 || depositNum > AMOUNT_MAX) {
      return NextResponse.json({ error: '押金需為 0~1,000,000 的整數' }, { status: 400 });
    }
    if (!Number.isInteger(payDay) || payDay < 1 || payDay > 28) {
      return NextResponse.json({ error: '繳租日需為 1~28 的整數' }, { status: 400 });
    }

    // ── 日期格式與邏輯驗證 ───────────────────────────────────────────────────
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (!ISO_DATE.test(startDate) || isNaN(Date.parse(startDate))) {
      return NextResponse.json({ error: '開始日期格式錯誤（需為 YYYY-MM-DD）' }, { status: 400 });
    }
    if (!ISO_DATE.test(endDate) || isNaN(Date.parse(endDate))) {
      return NextResponse.json({ error: '結束日期格式錯誤（需為 YYYY-MM-DD）' }, { status: 400 });
    }
    if (endDate <= startDate) {
      return NextResponse.json({ error: '結束日期必須晚於開始日期' }, { status: 400 });
    }

    // ── 文字欄位長度驗證 ─────────────────────────────────────────────────────
    if (typeof rules === 'string' && rules.length > TEXT_MAX) {
      return NextResponse.json({ error: `住宅規則不可超過 ${TEXT_MAX} 字元` }, { status: 400 });
    }
    if (typeof utilities === 'string' && utilities.length > TEXT_MAX) {
      return NextResponse.json({ error: `水電費說明不可超過 ${TEXT_MAX} 字元` }, { status: 400 });
    }
    if (typeof otherTerms === 'string' && otherTerms.length > TEXT_MAX) {
      return NextResponse.json({ error: `其他條款不可超過 ${TEXT_MAX} 字元` }, { status: 400 });
    }

    // 防止重複建立
    const existing = await prisma.contract.findUnique({ where: { applicationId } });
    if (existing) {
      return NextResponse.json({ error: '此申請已有合約', contractId: existing.id }, { status: 409 });
    }

    const contract = await prisma.contract.create({
      data: {
        applicationId,
        listingId:    application.listingId,
        landlordId:   user.id,
        tenantId:     application.tenantId,
        rentAmount:   rentNum,
        depositAmount: depositNum,
        startDate, endDate,
        paymentDay:   payDay,
        rules, utilities, otherTerms,
        status: 'pending_tenant', // 等待租客簽名
      },
    });

    // 寄通知給租客（非同步）
    import('@/lib/email').then(({ notifyContractCreated }) => {
      notifyContractCreated({
        tenantEmail: application.tenant.email,
        tenantName:  application.tenant.name,
        listingTitle: application.listing.title,
        contractId:  contract.id,
      }).catch(() => {});
    });

    return NextResponse.json({ contract }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
