import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { metricsStore } from '@/lib/metrics';
import type { VitalEvent } from '@/lib/metrics';

/**
 * POST /api/vitals
 *
 * 接收客戶端 Web Vitals 指標上報（由 WebVitals 元件的 sendBeacon 發送）。
 * 生產環境記錄至 log aggregator，可進一步接入 Datadog / Grafana。
 *
 * 限制：
 *  - 僅接受 POST
 *  - Body 必須是合法 JSON（Content-Type 由 sendBeacon 設為 text/plain 或 application/json）
 *  - 不需要認證（公開匿名上報）
 *  - 有效欄位：name, value, rating, delta, id, url, ts
 */

const VALID_METRICS = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB', 'FID']);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { name, value, rating, id, url } = body;

  // 基本驗證
  if (!name || !VALID_METRICS.has(String(name))) {
    return NextResponse.json({ ok: false, error: 'invalid metric name' }, { status: 400 });
  }
  if (typeof value !== 'number') {
    return NextResponse.json({ ok: false, error: 'invalid value' }, { status: 400 });
  }

  // 記錄至 logger（生產環境輸出 JSON log，方便 aggregator 解析）
  logger.info('Web Vital', {
    metric: String(name),
    value:  Number(value),
    rating: String(rating),
    id:     String(id),
    url:    String(url ?? ''),
  });

  // 存入 metricsStore（供 /admin/monitoring 儀表板即時顯示）
  const ratingStr = String(rating);
  const safeRating: VitalEvent['rating'] =
    ratingStr === 'good' || ratingStr === 'needs-improvement' || ratingStr === 'poor'
      ? ratingStr
      : 'poor';

  metricsStore.recordVital({
    name:   String(name),
    value:  Number(value),
    rating: safeRating,
    url:    String(url ?? ''),
    id:     String(id ?? ''),
  });

  // 回傳 204 No Content（sendBeacon 不讀取 response body）
  return new NextResponse(null, { status: 204 });
}
