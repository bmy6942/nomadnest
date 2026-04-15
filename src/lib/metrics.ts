/**
 * NomadNest Taiwan — 輕量級記憶體內監控指標儲存
 *
 * 設計原則：
 *  - 零外部依賴（不需要 Redis / InfluxDB / Prometheus）
 *  - Ring buffer（固定大小，自動覆蓋最舊資料，不增長記憶體）
 *  - 模組單例（Node.js 的 module cache 保證同一 process 只有一份）
 *  - 生產環境直接可用，開發環境同樣有效
 *
 * 儲存的指標：
 *  1. Web Vitals 事件（最多 200 筆）
 *  2. API 錯誤事件（最多 100 筆）
 *  3. 客戶端 JS 錯誤事件（最多 100 筆）
 *  4. API 回應時間分布（滑動視窗，最多 500 筆）
 *
 * 注意：資料儲存在 Node.js process 記憶體中，重啟後清空。
 * 生產環境若要持久化，可擴充至 Redis / Timescale。
 */

// ── 型別定義 ──────────────────────────────────────────────────────────────────

export interface VitalEvent {
  ts:     number;          // Unix timestamp (ms)
  name:   string;          // LCP | INP | CLS | FCP | TTFB
  value:  number;
  rating: 'good' | 'needs-improvement' | 'poor';
  url:    string;
  id:     string;
}

export interface ApiErrorEvent {
  ts:      number;
  route:   string;
  method:  string;
  status:  number;
  message: string;
  userId?: string;
}

export interface ClientErrorEvent {
  ts:      number;
  message: string;
  stack?:  string;
  url:     string;
  userId?: string;
  context?: string;
}

export interface ApiTimingEvent {
  ts:      number;
  route:   string;
  method:  string;
  status:  number;
  durationMs: number;
}

// ── Ring Buffer 實作 ───────────────────────────────────────────────────────────

class RingBuffer<T> {
  private buf:  (T | undefined)[];
  private head: number = 0;
  private _size: number = 0;

  constructor(private readonly capacity: number) {
    this.buf = new Array<T | undefined>(capacity).fill(undefined);
  }

  push(item: T): void {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this._size < this.capacity) this._size++;
  }

  /** 返回最新的 N 筆（時間由新到舊） */
  toArray(limit = this.capacity): T[] {
    const result: T[] = [];
    const n = Math.min(limit, this._size);
    for (let i = 1; i <= n; i++) {
      const idx = (this.head - i + this.capacity) % this.capacity;
      const item = this.buf[idx];
      if (item !== undefined) result.push(item);
    }
    return result;
  }

  get size(): number { return this._size; }
  clear(): void {
    this.buf.fill(undefined);
    this.head = 0;
    this._size = 0;
  }
}

// ── 全局 Metrics Store（模組單例）────────────────────────────────────────────

class MetricsStore {
  readonly vitals:       RingBuffer<VitalEvent>       = new RingBuffer(200);
  readonly apiErrors:    RingBuffer<ApiErrorEvent>    = new RingBuffer(100);
  readonly clientErrors: RingBuffer<ClientErrorEvent> = new RingBuffer(100);
  readonly apiTimings:   RingBuffer<ApiTimingEvent>   = new RingBuffer(500);

  readonly startedAt: number = Date.now();

  // ── 寫入方法 ──────────────────────────────────────────────────────────────
  recordVital(event: Omit<VitalEvent, 'ts'>): void {
    this.vitals.push({ ts: Date.now(), ...event });
  }

  recordApiError(event: Omit<ApiErrorEvent, 'ts'>): void {
    this.apiErrors.push({ ts: Date.now(), ...event });
  }

  recordClientError(event: Omit<ClientErrorEvent, 'ts'>): void {
    this.clientErrors.push({ ts: Date.now(), ...event });
  }

  recordApiTiming(event: Omit<ApiTimingEvent, 'ts'>): void {
    this.apiTimings.push({ ts: Date.now(), ...event });
  }

  // ── 聚合讀取 ──────────────────────────────────────────────────────────────

  /** 計算 Web Vitals p50/p75/p95 統計（過去 windowMs 毫秒內） */
  vitalStats(windowMs = 3_600_000): Record<string, VitalSummary> {
    const cutoff = Date.now() - windowMs;
    const byName: Record<string, number[]> = {};

    for (const v of this.vitals.toArray()) {
      if (v.ts < cutoff) continue;
      if (!byName[v.name]) byName[v.name] = [];
      byName[v.name].push(v.value);
    }

    const result: Record<string, VitalSummary> = {};
    for (const [name, values] of Object.entries(byName)) {
      const sorted = values.slice().sort((a, b) => a - b);
      const count  = sorted.length;
      result[name] = {
        count,
        p50:  percentile(sorted, 0.50),
        p75:  percentile(sorted, 0.75),
        p95:  percentile(sorted, 0.95),
        good: values.filter(v => getRating(name, v) === 'good').length,
        needsImprovement: values.filter(v => getRating(name, v) === 'needs-improvement').length,
        poor: values.filter(v => getRating(name, v) === 'poor').length,
      };
    }
    return result;
  }

  /** 計算 API 回應時間統計（過去 windowMs 毫秒內） */
  timingStats(windowMs = 3_600_000): Record<string, TimingSummary> {
    const cutoff = Date.now() - windowMs;
    const byRoute: Record<string, number[]> = {};

    for (const t of this.apiTimings.toArray()) {
      if (t.ts < cutoff) continue;
      const key = `${t.method} ${t.route}`;
      if (!byRoute[key]) byRoute[key] = [];
      byRoute[key].push(t.durationMs);
    }

    const result: Record<string, TimingSummary> = {};
    for (const [route, durations] of Object.entries(byRoute)) {
      const sorted = durations.slice().sort((a, b) => a - b);
      result[route] = {
        count: sorted.length,
        p50:  percentile(sorted, 0.50),
        p95:  percentile(sorted, 0.95),
        p99:  percentile(sorted, 0.99),
        max:  sorted[sorted.length - 1] ?? 0,
      };
    }
    return result;
  }

  /** 錯誤率：過去 windowMs 內 API 錯誤計數（按 status code 分組） */
  errorCounts(windowMs = 3_600_000): Record<number, number> {
    const cutoff = Date.now() - windowMs;
    const counts: Record<number, number> = {};
    for (const e of this.apiErrors.toArray()) {
      if (e.ts < cutoff) continue;
      counts[e.status] = (counts[e.status] ?? 0) + 1;
    }
    return counts;
  }

  /** process 記憶體快照 */
  memorySnapshot(): MemorySnapshot {
    if (typeof process === 'undefined') {
      return { heapUsed: 0, heapTotal: 0, rss: 0, external: 0, heapUsedMb: 0, heapTotalMb: 0, rssMb: 0 };
    }
    const mem = process.memoryUsage();
    return {
      heapUsed:  mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss:       mem.rss,
      external:  mem.external,
      heapUsedMb:  Math.round(mem.heapUsed  / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      rssMb:       Math.round(mem.rss       / 1024 / 1024),
    };
  }

  /** process 正常運行時間（秒） */
  uptimeSeconds(): number {
    return typeof process !== 'undefined' ? Math.floor(process.uptime()) : 0;
  }

  /** 模組啟動至今時間（秒） */
  storeUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }
}

// ── 型別 ──────────────────────────────────────────────────────────────────────

export interface VitalSummary {
  count:            number;
  p50:              number;
  p75:              number;
  p95:              number;
  good:             number;
  needsImprovement: number;
  poor:             number;
}

export interface TimingSummary {
  count: number;
  p50:   number;
  p95:   number;
  p99:   number;
  max:   number;
}

export interface MemorySnapshot {
  heapUsed:    number;
  heapTotal:   number;
  rss:         number;
  external:    number;
  heapUsedMb:  number;
  heapTotalMb: number;
  rssMb:       number;
}

// ── 工具函式 ──────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * p) - 1;
  return Math.round(sorted[Math.max(0, idx)] * 100) / 100;
}

const VITAL_THRESHOLDS: Record<string, [number, number]> = {
  LCP:  [2500, 4000],
  INP:  [200,  500],
  CLS:  [0.1,  0.25],
  FCP:  [1800, 3000],
  TTFB: [800,  1800],
};

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const [good, poor] = VITAL_THRESHOLDS[name] ?? [Infinity, Infinity];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

// ── 單例匯出 ──────────────────────────────────────────────────────────────────

// 利用 globalThis 保證在 Next.js dev 模式熱重載後仍保留同一份 store
declare global {
  // eslint-disable-next-line no-var
  var __nomadnest_metrics__: MetricsStore | undefined;
}

export const metricsStore: MetricsStore =
  globalThis.__nomadnest_metrics__ ?? (globalThis.__nomadnest_metrics__ = new MetricsStore());
