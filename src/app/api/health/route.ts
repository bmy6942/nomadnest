/**
 * GET /api/health
 *
 * 生產等級的健康狀態端點，供以下服務使用：
 *  - 負載均衡器（Vercel / Cloudflare）健康探針
 *  - 外部監控服務（UptimeRobot / Better Uptime / Pingdom）
 *  - GitHub Actions smoke test
 *  - 監控儀表板拉取系統狀態
 *
 * 回應：
 *   200 OK   — 所有元件健康
 *   503 Unavailable — 有元件故障（DB 無法連線等）
 *
 * 安全性：
 *  - 不需要認證（外部監控服務需要可公開訪問）
 *  - 不回傳敏感資訊（DB 連線字串、Stack trace 等）
 *  - 設定 Cache-Control: no-store 確保每次都是即時結果
 *
 * 效能：
 *  - DB 查詢加上 2 秒 timeout（不讓健康檢查拖垮服務）
 *  - 各元件並行檢查
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { metricsStore } from '@/lib/metrics';

// ── 型別 ──────────────────────────────────────────────────────────────────────

type ComponentStatus = 'ok' | 'degraded' | 'down';

interface ComponentCheck {
  status:   ComponentStatus;
  latencyMs?: number;
  message?: string;
}

interface HealthReport {
  status:    'ok' | 'degraded' | 'down';
  version:   string;
  timestamp: string;
  uptimeSeconds: number;
  components: {
    database: ComponentCheck;
    memory:   ComponentCheck;
    metrics:  ComponentCheck;
  };
  memory: {
    heapUsedMb:  number;
    heapTotalMb: number;
    rssMb:       number;
    heapUsedPct: number;
  };
}

// ── DB 健康檢查（帶 timeout）──────────────────────────────────────────────────

async function checkDatabase(): Promise<ComponentCheck> {
  const start = Date.now();
  try {
    // 帶 2 秒 timeout 的 DB ping
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 2_000)
      ),
    ]);
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status:   'down',
      latencyMs: Date.now() - start,
      message:  err instanceof Error ? err.message : 'Unknown DB error',
    };
  }
}

// ── 記憶體健康檢查 ─────────────────────────────────────────────────────────────

function checkMemory(): ComponentCheck {
  if (typeof process === 'undefined') {
    return { status: 'ok', message: 'non-node environment' };
  }
  const mem = process.memoryUsage();
  const usedPct = mem.heapUsed / mem.heapTotal;

  if (usedPct > 0.95) {
    return { status: 'down',     message: `Heap usage critical: ${Math.round(usedPct * 100)}%` };
  }
  if (usedPct > 0.80) {
    return { status: 'degraded', message: `Heap usage high: ${Math.round(usedPct * 100)}%` };
  }
  return { status: 'ok' };
}

// ── Metrics Store 健康檢查 ────────────────────────────────────────────────────

function checkMetrics(): ComponentCheck {
  try {
    const snap = metricsStore.memorySnapshot();
    return {
      status:  'ok',
      message: `${metricsStore.vitals.size} vitals, ${metricsStore.apiErrors.size} errors stored`,
    };
    void snap; // suppress unused variable warning
  } catch {
    return { status: 'degraded', message: 'Metrics store unavailable' };
  }
}

// ── 主處理器 ──────────────────────────────────────────────────────────────────

export async function GET() {
  const [db, memory, metrics] = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkMemory()),
    Promise.resolve(checkMetrics()),
  ]);

  const mem = typeof process !== 'undefined' ? process.memoryUsage() : null;
  const heapUsedPct = mem
    ? Math.round((mem.heapUsed / mem.heapTotal) * 100)
    : 0;

  const components = { database: db, memory, metrics };

  // 整體狀態：任一 down → down，任一 degraded → degraded，否則 ok
  const allStatuses = Object.values(components).map(c => c.status);
  const overallStatus: 'ok' | 'degraded' | 'down' =
    allStatuses.includes('down')     ? 'down'     :
    allStatuses.includes('degraded') ? 'degraded' : 'ok';

  const report: HealthReport = {
    status:       overallStatus,
    version:      process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
    timestamp:    new Date().toISOString(),
    uptimeSeconds: metricsStore.uptimeSeconds(),
    components,
    memory: {
      heapUsedMb:  Math.round((mem?.heapUsed  ?? 0) / 1024 / 1024),
      heapTotalMb: Math.round((mem?.heapTotal ?? 0) / 1024 / 1024),
      rssMb:       Math.round((mem?.rss       ?? 0) / 1024 / 1024),
      heapUsedPct,
    },
  };

  const httpStatus = overallStatus === 'down' ? 503 : 200;

  return NextResponse.json(report, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Health-Status': overallStatus,
    },
  });
}
