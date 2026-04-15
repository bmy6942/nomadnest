/**
 * 集中式結構化日誌工具 (Centralized Structured Logger)
 *
 * 功能：
 *  - 統一 API 錯誤格式（含 requestId、路由、userId）
 *  - 開發環境彩色輸出 / 生產環境 JSON 格式（方便 log aggregator 解析）
 *  - Web Vitals 指標記錄
 *  - 客戶端錯誤上報（可擴充至 Sentry / Datadog）
 *
 * 使用範例：
 *   logger.error('API 錯誤', { route: '/api/listings', userId: '...' }, err);
 *   logger.warn('Rate limit 觸發', { ip: '...' });
 *   logger.info('房源建立成功', { listingId: '...' });
 */

// 延遲載入 metricsStore，避免 circular import（metrics → logger → metrics）
type MetricsStoreType = typeof import('@/lib/metrics').metricsStore;
let _metricsStore: MetricsStoreType | null = null;
function getMetricsStore(): MetricsStoreType | null {
  if (_metricsStore) return _metricsStore;
  try {
    // dynamic require 僅在 server side 執行，client bundle 不會包含
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _metricsStore = require('@/lib/metrics').metricsStore;
  } catch {
    // 測試環境 / 模組尚未初始化時靜默跳過
  }
  return _metricsStore;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  route?:     string;
  userId?:    string;
  requestId?: string;
  [key: string]: unknown;
}

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_SERVER = typeof window === 'undefined';

// ── 核心 log 函式 ──────────────────────────────────────────────────────────────

function log(
  level: LogLevel,
  message: string,
  context: LogContext = {},
  error?: unknown,
): void {
  const timestamp = new Date().toISOString();
  const requestId = context.requestId ?? generateRequestId();

  if (IS_PROD && IS_SERVER) {
    // 生產伺服器：JSON 格式（方便 log aggregator 解析）
    const entry = {
      timestamp,
      level,
      message,
      requestId,
      ...context,
      ...(error ? { error: serializeError(error) } : {}),
    };
    // eslint-disable-next-line no-console
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(JSON.stringify(entry));
  } else {
    // 開發環境：易讀彩色格式
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // cyan
      info:  '\x1b[32m', // green
      warn:  '\x1b[33m', // yellow
      error: '\x1b[31m', // red
    };
    const reset = '\x1b[0m';
    const prefix = `${colors[level]}[${level.toUpperCase()}]${reset} ${timestamp}`;
    const ctx = Object.keys(context).length > 0 ? ` | ${JSON.stringify(context)}` : '';
    // eslint-disable-next-line no-console
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (error) {
      fn(`${prefix} ${message}${ctx}`, error);
    } else {
      fn(`${prefix} ${message}${ctx}`);
    }
  }
}

// ── 公開 API ──────────────────────────────────────────────────────────────────

export const logger = {
  debug: (msg: string, ctx?: LogContext, err?: unknown) => log('debug', msg, ctx, err),
  info:  (msg: string, ctx?: LogContext, err?: unknown) => log('info',  msg, ctx, err),
  warn:  (msg: string, ctx?: LogContext, err?: unknown) => log('warn',  msg, ctx, err),
  error: (msg: string, ctx?: LogContext, err?: unknown) => log('error', msg, ctx, err),

  /** API 錯誤快捷方式 — 同步寫入 metricsStore，供監控儀表板即時顯示 */
  apiError: (route: string, err: unknown, ctx: LogContext = {}) => {
    log('error', `API Error: ${route}`, { route, ...ctx }, err);

    // 寫入 in-memory metrics store（非同步不影響 response 速度）
    try {
      const store = getMetricsStore();
      if (store) {
        const message = err instanceof Error ? err.message : String(err);
        const method  = typeof ctx['method'] === 'string' ? ctx['method'] : 'UNKNOWN';
        const status  = typeof ctx['status'] === 'number' ? ctx['status'] : 500;
        const userId  = typeof ctx['userId'] === 'string' ? ctx['userId'] : undefined;
        store.recordApiError({ route, method, status, message, userId });
      }
    } catch {
      // 上報失敗不影響主流程，靜默忽略
    }
  },

  /** 上報給外部監控服務（可擴充 Sentry / Datadog）*/
  captureException: (err: unknown, ctx: LogContext = {}) => {
    log('error', 'Unhandled Exception', ctx, err);
    // TODO: 接入 Sentry → Sentry.captureException(err, { extra: ctx });
    // TODO: 接入 Datadog → datadogLogs.logger.error(message, ctx, err);
  },
};

// ── 工具函式 ──────────────────────────────────────────────────────────────────

function generateRequestId(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name:    err.name,
      message: err.message,
      stack:   IS_PROD ? undefined : err.stack, // 生產環境不暴露 stack trace
    };
  }
  return { raw: String(err) };
}

// ── Web Vitals 指標記錄（供 WebVitals 元件使用）────────────────────────────────

export interface WebVitalMetric {
  name:   string;  // LCP / INP / CLS / FCP / TTFB
  value:  number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta:  number;
  id:     string;
}

/** 記錄 Web Vitals 指標（生產環境可擴充至分析服務）*/
export function reportWebVital(metric: WebVitalMetric): void {
  const { name, value, rating, delta, id } = metric;

  // 開發：直接打印
  if (!IS_PROD) {
    const color = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
    // eslint-disable-next-line no-console
    console.log(`[Web Vitals] ${color} ${name}: ${value.toFixed(2)} (${rating}) Δ${delta.toFixed(2)} [${id}]`);
    return;
  }

  // 生產：使用 sendBeacon 非同步上報，不阻塞使用者操作
  const body = JSON.stringify({ name, value, rating, delta, id, url: window.location.href });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  }
  // TODO: 接入 Vercel Analytics → va.track('Web Vitals', { name, value, rating });
  // TODO: 接入 Google Analytics → gtag('event', name, { value: Math.round(value), event_label: id });
}
