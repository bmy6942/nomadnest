/**
 * POST /api/errors
 *
 * 接收客戶端 JavaScript 錯誤上報（由 ErrorBoundary 元件發送）。
 *
 * Body:
 *   { message, stack, url, context, userId }
 *
 * 限制：
 *  - 僅接受 POST
 *  - message 長度限制 2000 字元（防濫用）
 *  - stack 長度限制 5000 字元
 *  - 不需要認證（ErrorBoundary 在未登入頁也需要回報錯誤）
 *  - Rate limiting: 10 次/分鐘/IP（防刷）
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { metricsStore } from '@/lib/metrics';

// 簡易 IP Rate Limiter（防止錯誤上報濫用）
const errorRateLimit = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const limit = errorRateLimit.get(ip);
  if (!limit || now > limit.resetAt) {
    errorRateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (limit.count >= 10) return true;
  limit.count++;
  return false;
}

export async function POST(req: NextRequest) {
  // Rate limit check
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const message = String(body.message ?? '').slice(0, 2000);
  const stack   = body.stack   ? String(body.stack).slice(0, 5000)  : undefined;
  const url     = String(body.url     ?? '').slice(0, 500);
  const context = body.context ? String(body.context).slice(0, 200) : undefined;
  const userId  = body.userId  ? String(body.userId)                 : undefined;

  if (!message) {
    return NextResponse.json({ ok: false, error: 'message_required' }, { status: 400 });
  }

  // 存入 metrics store
  metricsStore.recordClientError({ message, stack, url, context, userId });

  // 記錄至 logger（生產環境會輸出到 JSON log）
  logger.error('Client JS Error', {
    message,
    url,
    context,
    userId,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
