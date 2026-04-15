/**
 * GET /api/metrics
 *
 * 聚合監控指標 API，供監控儀表板拉取資料。
 *
 * 安全性：僅 admin 可存取
 *
 * 回傳：
 *  - Web Vitals p50/p75/p95 統計（過去 1 小時）
 *  - API 回應時間分布（過去 1 小時）
 *  - 錯誤計數（按 HTTP status 分類）
 *  - 最近 20 筆 API 錯誤
 *  - 最近 20 筆客戶端 JS 錯誤
 *  - 最近 10 筆 Web Vitals 事件
 *  - 記憶體快照
 *  - process uptime
 *
 * 快取：5 秒（避免儀表板拉取太頻繁）
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { metricsStore } from '@/lib/metrics';

export async function GET() {
  // ── 認證：僅限 admin ──────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const windowMs = 60 * 60 * 1000; // 1 小時

  const [vitalStats, timingStats, errorCounts, memory] = await Promise.all([
    Promise.resolve(metricsStore.vitalStats(windowMs)),
    Promise.resolve(metricsStore.timingStats(windowMs)),
    Promise.resolve(metricsStore.errorCounts(windowMs)),
    Promise.resolve(metricsStore.memorySnapshot()),
  ]);

  return NextResponse.json({
    timestamp:     new Date().toISOString(),
    uptimeSeconds: metricsStore.uptimeSeconds(),
    storeUptimeSeconds: metricsStore.storeUptimeSeconds(),

    // Web Vitals 聚合統計
    vitals: {
      stats:  vitalStats,
      recent: metricsStore.vitals.toArray(20),
      total:  metricsStore.vitals.size,
    },

    // API 回應時間
    timings: {
      stats: timingStats,
      total: metricsStore.apiTimings.size,
    },

    // 錯誤統計
    errors: {
      api: {
        counts:  errorCounts,
        recent:  metricsStore.apiErrors.toArray(20),
        total:   metricsStore.apiErrors.size,
      },
      client: {
        recent:  metricsStore.clientErrors.toArray(20),
        total:   metricsStore.clientErrors.size,
      },
    },

    // 系統資源
    memory,
  }, {
    headers: {
      'Cache-Control': 'private, max-age=5, stale-while-revalidate=10',
    },
  });
}
