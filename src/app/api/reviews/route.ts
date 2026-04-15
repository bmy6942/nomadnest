import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { reviewLimiter } from '@/lib/rateLimit';
import { Prisma } from '@prisma/client';

// 評價內容長度限制
const CONTENT_MIN = 10;
const CONTENT_MAX = 2000;

// POST /api/reviews — 提交評價（需曾申請過該房源）
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ── 角色守衛：僅租客可提交評價（防止房東評價自己/他人房源）────────────────
  if (user.role !== 'tenant') {
    return NextResponse.json({ error: '只有租客帳號可以提交評價' }, { status: 403 });
  }

  // ── 速率限制：每用戶每天 10 次 ───────────────────────────────────────────
  const rateCheck = reviewLimiter.check(`review:${user.id}`);
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: `評價次數過多，請於 ${rateCheck.retryAfter} 秒後再試` },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  // ── JSON 解析（防止格式錯誤觸發 500）────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { listingId, rating, wifiRating, content } = body;

  // ── listingId 型別驗證 ──────────────────────────────────────────────────
  if (typeof listingId !== 'string' || !listingId.trim()) {
    return NextResponse.json({ error: '請提供有效的房源 ID' }, { status: 400 });
  }

  if (rating == null || wifiRating == null || !content) {
    return NextResponse.json({ error: '請填寫所有欄位' }, { status: 400 });
  }

  // ── 評分型別 + 整數 + 範圍驗證 ────────────────────────────────────────────
  if (
    typeof rating !== 'number' || typeof wifiRating !== 'number' ||
    !Number.isInteger(rating) || !Number.isInteger(wifiRating) ||
    rating < 1 || rating > 5 || wifiRating < 1 || wifiRating > 5
  ) {
    return NextResponse.json({ error: '評分需為 1~5 的整數' }, { status: 400 });
  }

  if (typeof content !== 'string' || content.trim().length < CONTENT_MIN || content.length > CONTENT_MAX) {
    return NextResponse.json(
      { error: `評價內容需介於 ${CONTENT_MIN}~${CONTENT_MAX} 字元` },
      { status: 400 }
    );
  }

  // ── 確認房源存在（避免對不存在的房源執行多次 DB 查詢）────────────────────
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true },
  });
  if (!listing) {
    return NextResponse.json({ error: '找不到此房源' }, { status: 404 });
  }

  // 取得今天日期（YYYY-MM-DD），與 moveInDate 字串比較
  const today = new Date().toISOString().slice(0, 10);

  // 路徑 A：申請已批准 且 moveInDate 已到或已過
  const application = await prisma.application.findFirst({
    where: {
      listingId,
      tenantId: user.id,
      status: 'approved',
      moveInDate: { lte: today }, // 入住日 ≤ 今天（字串 YYYY-MM-DD 可直接比較）
    },
    select: { id: true },
  });

  let canReview = !!application;

  // 路徑 B：有已批准申請但入住日尚未到 → 提示具體可評價日期
  if (!canReview) {
    const futureApp = await prisma.application.findFirst({
      where: { listingId, tenantId: user.id, status: 'approved' },
      select: { moveInDate: true },
      orderBy: { moveInDate: 'asc' },
    });
    if (futureApp) {
      return NextResponse.json(
        { error: `您的申請已通過，入住日（${futureApp.moveInDate}）後才能撰寫評價` },
        { status: 403 }
      );
    }
  }

  // 路徑 C：已完成看房（確認時間已過）
  if (!canReview) {
    const now = new Date();
    const confirmedViewings = await prisma.viewingRequest.findMany({
      where: {
        listingId,
        tenantId: user.id,
        status: { in: ['confirmed', 'completed'] },
        confirmedTime: { not: null },
      },
      select: { confirmedTime: true },
    });
    canReview = confirmedViewings.some(v => v.confirmedTime && new Date(v.confirmedTime) < now);
  }

  if (!canReview) {
    return NextResponse.json({ error: '只有已入住或已完成看房的租客才能評價' }, { status: 403 });
  }

  // ── 重複評價防護（應用層預檢 + DB 層唯一約束雙保險）────────────────────────
  // DB 層：schema 應有 @@unique([listingId, reviewerId])；
  // 若約束不存在，此 findFirst 仍能防止大多數重複；
  // 若兩個請求同時通過此檢查（競爭條件），DB 唯一約束會攔截並以 P2002 回傳 409
  const existing = await prisma.review.findFirst({
    where: { listingId, reviewerId: user.id },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: '你已評價過此房源' }, { status: 409 });
  }

  try {
    const review = await prisma.review.create({
      data: { listingId, reviewerId: user.id, rating, wifiRating, content: content.trim() },
      include: { reviewer: { select: { name: true } } },
    });
    return NextResponse.json(review, { status: 201 });
  } catch (err) {
    // P2002 = 唯一約束衝突（競爭條件：兩個請求同時通過上方 findFirst）
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: '你已評價過此房源' }, { status: 409 });
    }
    console.error('[reviews] POST create error:', err);
    return NextResponse.json({ error: '評價提交失敗，請稍後再試' }, { status: 500 });
  }
}
