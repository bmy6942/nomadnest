import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { reportLimiter } from '@/lib/rateLimit';

const REASONS: Record<string, string[]> = {
  listing: ['資訊不實', '價格詐欺', '圖片造假', '已出租仍上架', '地址錯誤', '其他'],
  message: ['包含聯絡資訊（跑單）', '騷擾/辱罵', '詐騙內容', '其他'],
  user: ['假帳號', '詐欺房東', '騷擾行為', '其他'],
};

const VALID_TYPES = new Set(Object.keys(REASONS));

// GET /api/reports — 取得可用的檢舉原因
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'listing';
  return NextResponse.json({ reasons: REASONS[type] || REASONS.listing });
}

// POST /api/reports — 提交檢舉
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── 速率限制：每用戶每小時 10 次 ─────────────────────────────────────────
  const rateCheck = reportLimiter.check(`report:${user.id}`);
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: `檢舉次數過多，請於 ${rateCheck.retryAfter} 秒後再試` },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  const { targetType, targetId, reason, detail } = await req.json();

  if (!targetType || !targetId || !reason) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // ── 輸入驗證 ──────────────────────────────────────────────────────────────
  if (!VALID_TYPES.has(String(targetType))) {
    return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 });
  }
  const validReasons = REASONS[targetType as string] ?? [];
  if (!validReasons.includes(String(reason))) {
    return NextResponse.json({ error: 'Invalid reason for this target type' }, { status: 400 });
  }
  if (detail !== undefined && detail !== null) {
    if (typeof detail !== 'string' || detail.length > 500) {
      return NextResponse.json({ error: '補充說明不得超過 500 字元' }, { status: 400 });
    }
  }

  // 防重複：同一用戶對同一目標只能檢舉一次
  const existing = await prisma.report.findFirst({
    where: { reporterId: user.id, targetType, targetId },
  });
  if (existing) {
    return NextResponse.json({ error: 'Already reported', alreadyReported: true }, { status: 409 });
  }

  const report = await prisma.report.create({
    data: { reporterId: user.id, targetType, targetId, reason, detail: detail || null },
  });

  return NextResponse.json({ ok: true, reportId: report.id });
}
