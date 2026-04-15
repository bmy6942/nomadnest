'use client';

/**
 * /admin/monitoring — 即時監控儀表板
 *
 * 提供：
 *  ① 系統健康狀態（DB / 記憶體 / Uptime）
 *  ② Core Web Vitals p50/p75/p95 統計
 *  ③ API 錯誤計數 + 最近錯誤列表
 *  ④ 客戶端 JS 錯誤列表
 *  ⑤ API 回應時間分布
 *  ⑥ 記憶體使用量量表
 *
 * 資料來源：/api/health + /api/metrics（每 10 秒自動更新）
 * 認證：僅 admin 可訪問（透過 layout.tsx 或 middleware 守護）
 */

import { useEffect, useState, useCallback, useRef } from 'react';

// ── 型別 ──────────────────────────────────────────────────────────────────────

interface ComponentCheck {
  status:    'ok' | 'degraded' | 'down';
  latencyMs?: number;
  message?:  string;
}

interface HealthData {
  status:        'ok' | 'degraded' | 'down';
  version:       string;
  timestamp:     string;
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

interface VitalSummary {
  count: number; p50: number; p75: number; p95: number;
  good: number; needsImprovement: number; poor: number;
}

interface VitalEvent {
  ts: number; name: string; value: number;
  rating: 'good' | 'needs-improvement' | 'poor'; url: string;
}

interface ApiErrorEvent {
  ts: number; route: string; method: string; status: number; message: string;
}

interface ClientErrorEvent {
  ts: number; message: string; url: string; context?: string;
}

interface MetricsData {
  timestamp:     string;
  uptimeSeconds: number;
  vitals: {
    stats:  Record<string, VitalSummary>;
    recent: VitalEvent[];
    total:  number;
  };
  timings: {
    stats: Record<string, { count: number; p50: number; p95: number; p99: number; max: number }>;
    total: number;
  };
  errors: {
    api:    { counts: Record<string, number>; recent: ApiErrorEvent[]; total: number };
    client: { recent: ClientErrorEvent[]; total: number };
  };
  memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number; heapUsedPct: number };
}

// ── 工具 ──────────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  if (seconds < 60)   return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function statusColor(s: 'ok' | 'degraded' | 'down' | string): string {
  if (s === 'ok')       return 'text-green-600 bg-green-50 border-green-200';
  if (s === 'degraded') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function statusDot(s: 'ok' | 'degraded' | 'down' | string): string {
  if (s === 'ok')       return 'bg-green-500';
  if (s === 'degraded') return 'bg-yellow-500';
  return 'bg-red-500';
}

function statusIcon(s: 'ok' | 'degraded' | 'down' | string): string {
  if (s === 'ok')       return '✅';
  if (s === 'degraded') return '⚠️';
  return '❌';
}

function ratingColor(r: string): string {
  if (r === 'good')             return 'text-green-700 bg-green-100';
  if (r === 'needs-improvement') return 'text-yellow-700 bg-yellow-100';
  return 'text-red-700 bg-red-100';
}

const VITAL_UNITS: Record<string, string> = {
  LCP: 'ms', INP: 'ms', FCP: 'ms', TTFB: 'ms', CLS: '',
};

const VITAL_THRESHOLDS: Record<string, { good: number; poor: number }> = {
  LCP:  { good: 2500, poor: 4000 },
  INP:  { good: 200,  poor: 500 },
  CLS:  { good: 0.1,  poor: 0.25 },
  FCP:  { good: 1800, poor: 3000 },
  TTFB: { good: 800,  poor: 1800 },
};

// ── 子元件 ────────────────────────────────────────────────────────────────────

function Card({ title, children, className = '' }: {
  title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'ok' | 'degraded' | 'down' | string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor(status)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusDot(status)}`} />
      {status.toUpperCase()}
    </span>
  );
}

function MemoryBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>{used} / {total} MB ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function VitalBar({ value, name }: { value: number; name: string }) {
  const th = VITAL_THRESHOLDS[name];
  if (!th) return <span className="text-sm font-mono">{value}</span>;
  const pct = Math.min((value / th.poor) * 100, 100);
  const color = value <= th.good ? 'bg-green-500' : value <= th.poor ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-16 text-right text-gray-700">
        {name === 'CLS' ? value.toFixed(3) : Math.round(value)}{VITAL_UNITS[name]}
      </span>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const [health, setHealth]     = useState<HealthData | null>(null);
  const [metrics, setMetrics]   = useState<MetricsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [healthRes, metricsRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/metrics'),
      ]);

      if (!metricsRes.ok) {
        if (metricsRes.status === 403) {
          setError('需要管理員權限 / Admin access required');
          return;
        }
        throw new Error(`Metrics API error: ${metricsRes.status}`);
      }

      const [healthData, metricsData] = await Promise.all([
        healthRes.json() as Promise<HealthData>,
        metricsRes.json() as Promise<MetricsData>,
      ]);

      setHealth(healthData);
      setMetrics(metricsData);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => { void fetchAll(); }, 10_000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">載入監控資料中…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-red-600 font-medium">{error}</p>
      </div>
    );
  }

  const totalApiErrors = Object.values(metrics?.errors.api.counts ?? {}).reduce((a, b) => a + b, 0);
  const totalClientErrors = metrics?.errors.client.total ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* ── 頁首 ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🖥 系統監控</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitoring Dashboard — NomadNest Taiwan</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400">
              更新：{lastRefresh.toLocaleTimeString('zh-TW')}
            </span>
          )}
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              autoRefresh
                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }`}
          >
            {autoRefresh ? '⏸ 暫停自動更新' : '▶ 啟用自動更新'}
          </button>
          <button
            onClick={() => { void fetchAll(); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            🔄 立即更新
          </button>
        </div>
      </div>

      {/* ── 整體狀態橫幅 ────────────────────────────────────────────────── */}
      {health && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border mb-6 ${statusColor(health.status)}`}>
          <span className="text-2xl">{statusIcon(health.status)}</span>
          <div>
            <p className="font-semibold">
              {health.status === 'ok'
                ? '所有系統正常 All Systems Operational'
                : health.status === 'degraded'
                ? '部分服務降級 Partial Degradation'
                : '服務中斷 Service Down'}
            </p>
            <p className="text-xs mt-0.5 opacity-70">
              v{health.version} · Uptime: {formatUptime(health.uptimeSeconds)} · {new Date(health.timestamp).toLocaleString('zh-TW')}
            </p>
          </div>
        </div>
      )}

      {/* ── 元件狀態 ────────────────────────────────────────────────────── */}
      {health && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {Object.entries(health.components).map(([name, check]) => (
            <div key={name} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 shadow-sm">
              <span className="text-xl mt-0.5">
                {name === 'database' ? '🗄' : name === 'memory' ? '💾' : '📊'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 capitalize">{name}</p>
                <StatusBadge status={check.status} />
                {check.latencyMs !== undefined && (
                  <p className="text-xs text-gray-500 mt-1">Latency: {check.latencyMs}ms</p>
                )}
                {check.message && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{check.message}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 統計卡片 ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Uptime', value: formatUptime(metrics?.uptimeSeconds ?? 0), icon: '⏱' },
          { label: 'Vitals 記錄', value: metrics?.vitals.total ?? 0, icon: '📈' },
          { label: 'API 錯誤 (1h)', value: totalApiErrors, icon: '🚨', alert: totalApiErrors > 10 },
          { label: 'JS 錯誤 (1h)', value: totalClientErrors, icon: '💥', alert: totalClientErrors > 5 },
        ].map(stat => (
          <div
            key={stat.label}
            className={`bg-white rounded-xl border p-4 shadow-sm ${stat.alert ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
          >
            <div className="text-2xl mb-1">{stat.icon}</div>
            <p className={`text-xl font-bold ${stat.alert ? 'text-red-700' : 'text-gray-900'}`}>
              {stat.value}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* ── Core Web Vitals ───────────────────────────────────────────── */}
        <Card title="📊 Core Web Vitals (過去 1 小時)">
          {Object.keys(metrics?.vitals.stats ?? {}).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">尚無資料（需要頁面訪問才會累積）</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(metrics?.vitals.stats ?? {}).map(([name, stat]) => (
                <div key={name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{name}</span>
                    <span className="text-xs text-gray-400">{stat.count} samples</span>
                  </div>
                  <div className="space-y-1">
                    {[{ label: 'p50', value: stat.p50 }, { label: 'p75', value: stat.p75 }, { label: 'p95', value: stat.p95 }].map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-6">{label}</span>
                        <VitalBar value={value} name={name} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs text-green-600">✅ {stat.good} good</span>
                    <span className="text-xs text-yellow-600">⚠️ {stat.needsImprovement} needs-improvement</span>
                    <span className="text-xs text-red-600">❌ {stat.poor} poor</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── 記憶體 ──────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card title="💾 記憶體使用量">
            {metrics?.memory ? (
              <div className="space-y-4">
                <MemoryBar
                  used={metrics.memory.heapUsedMb}
                  total={metrics.memory.heapTotalMb}
                  label="Heap Used"
                />
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-gray-800">{metrics.memory.rssMb} MB</p>
                    <p className="text-xs text-gray-500">RSS (Total Memory)</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-gray-800">{metrics.memory.heapUsedPct ?? Math.round(metrics.memory.heapUsedMb / metrics.memory.heapTotalMb * 100)}%</p>
                    <p className="text-xs text-gray-500">Heap 使用率</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">無資料</p>
            )}
          </Card>

          {/* API 錯誤分布 */}
          <Card title="🚨 API 錯誤分布 (1h)">
            {Object.keys(metrics?.errors.api.counts ?? {}).length === 0 ? (
              <p className="text-sm text-green-600 text-center py-2">✅ 無錯誤</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(metrics?.errors.api.counts ?? {})
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                        Number(status) >= 500 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        HTTP {status}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{count} 次</span>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── API 回應時間 ─────────────────────────────────────────────────── */}
      <Card title="⚡ API 回應時間 (過去 1 小時)" className="mb-4">
        {Object.keys(metrics?.timings.stats ?? {}).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">尚無資料</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-4">Route</th>
                  <th className="pb-2 pr-4 text-right">Count</th>
                  <th className="pb-2 pr-4 text-right">p50</th>
                  <th className="pb-2 pr-4 text-right">p95</th>
                  <th className="pb-2 text-right">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(metrics?.timings.stats ?? {})
                  .sort(([, a], [, b]) => b.p95 - a.p95)
                  .slice(0, 15)
                  .map(([route, stat]) => (
                    <tr key={route} className="hover:bg-gray-50">
                      <td className="py-2 pr-4 font-mono text-xs text-gray-700">{route}</td>
                      <td className="py-2 pr-4 text-right text-gray-500">{stat.count}</td>
                      <td className={`py-2 pr-4 text-right font-mono text-xs ${stat.p50 > 500 ? 'text-yellow-600' : 'text-green-600'}`}>{stat.p50}ms</td>
                      <td className={`py-2 pr-4 text-right font-mono text-xs ${stat.p95 > 1000 ? 'text-red-600' : stat.p95 > 500 ? 'text-yellow-600' : 'text-green-600'}`}>{stat.p95}ms</td>
                      <td className={`py-2 text-right font-mono text-xs ${stat.max > 2000 ? 'text-red-700 font-bold' : 'text-gray-600'}`}>{stat.max}ms</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── 最近 Web Vitals ─────────────────────────────────────────────── */}
        <Card title="📈 最近 Web Vitals 事件">
          {(metrics?.vitals.recent ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">尚無資料</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {metrics?.vitals.recent.map((v, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 w-16 shrink-0">{formatTs(v.ts)}</span>
                  <span className="font-mono font-medium text-gray-700 w-10">{v.name}</span>
                  <span className="flex-1 mx-2 truncate text-gray-500">{v.url}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ratingColor(v.rating)}`}>
                    {v.name === 'CLS' ? v.value.toFixed(3) : Math.round(v.value)}{VITAL_UNITS[v.name]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── 最近 JS 錯誤 ────────────────────────────────────────────────── */}
        <Card title="💥 最近客戶端錯誤">
          {(metrics?.errors.client.recent ?? []).length === 0 ? (
            <p className="text-sm text-green-600 text-center py-4">✅ 無客戶端錯誤</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {metrics?.errors.client.recent.map((e, i) => (
                <div key={i} className="text-xs border border-red-100 bg-red-50 rounded-lg p-2">
                  <div className="flex justify-between text-gray-400 mb-1">
                    <span>{formatTs(e.ts)}</span>
                    <span className="truncate ml-2 text-gray-500">{e.url}</span>
                  </div>
                  <p className="text-red-700 font-medium truncate">{e.message}</p>
                  {e.context && <p className="text-gray-500 mt-0.5 truncate">{e.context}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── 最近 API 錯誤 ────────────────────────────────────────────────── */}
      {(metrics?.errors.api.recent ?? []).length > 0 && (
        <Card title="🚨 最近 API 錯誤" className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="pb-2 pr-3">時間</th>
                  <th className="pb-2 pr-3">Route</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {metrics?.errors.api.recent.slice(0, 20).map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">{formatTs(e.ts)}</td>
                    <td className="py-1.5 pr-3 font-mono text-gray-700 whitespace-nowrap">{e.method} {e.route}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`px-1.5 py-0.5 rounded font-mono ${
                        e.status >= 500 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{e.status}</span>
                    </td>
                    <td className="py-1.5 text-gray-600 truncate max-w-xs">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── 頁尾 ────────────────────────────────────────────────────────── */}
      <p className="text-center text-xs text-gray-400 mt-6">
        資料視窗：過去 1 小時 · 自動更新：每 10 秒 · NomadNest Taiwan Monitoring v1.0
      </p>
    </div>
  );
}
