'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { AnalyticsSkeleton } from '@/components/SkeletonCard';
import { getCachedStale, setCached } from '@/lib/clientCache';

type DailyView = { date: string; count: number };
type ListingAnalytics = {
  id: string; title: string; city: string; district: string; type: string;
  price: number; status: string; images: string; createdAt: string;
  totals: { views: number; applications: number; favorites: number; reviews: number; conversations: number; viewings: number };
  period: { views7d: number; views30d: number; apps7d: number; apps30d: number };
  rates: { conversionRate: string; favoriteRate: string };
  approvedApps: number; pendingApps: number; avgRating: number;
  dailyViews: DailyView[];
};
type Summary = { totalViews: number; totalApps: number; totalFavs: number; activeListings: number; totalListings: number };

// ── Mini SVG sparkline ─────────────────────────────────────────────────────────
function Sparkline({ data, color = '#3b82f6', fillColor = '#dbeafe' }: { data: number[]; color?: string; fillColor?: string }) {
  const max = Math.max(...data, 1);
  const w = 200; const h = 40; const n = data.length;
  if (n < 2) return null;
  const pts = data.map((v, i) => `${(i / (n - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(' ');
  const fillPts = `0,${h} ` + pts + ` ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <polygon points={fillPts} fill={fillColor} opacity="0.5" />
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Score badge ────────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-green-600 bg-green-50 border-green-200'
    : score >= 40 ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
    : 'text-red-500 bg-red-50 border-red-200';
  const label = score >= 70 ? '優良' : score >= 40 ? '普通' : '待改善';
  return (
    <div className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      {score} <span className="font-normal">{label}</span>
    </div>
  );
}

const CACHE_ANALYTICS = '/api/analytics';

export default function AnalyticsPage() {
  type AnalyticsPayload = { summary: Summary; listings: ListingAnalytics[] };
  const [data, setData] = useState<AnalyticsPayload | null>(() => {
    const c = getCachedStale<AnalyticsPayload>(CACHE_ANALYTICS);
    return c?.data ?? null;
  });
  const [loading, setLoading] = useState(() => getCachedStale(CACHE_ANALYTICS) === null);
  const [selected, setSelected] = useState<string | null>(() => {
    const c = getCachedStale<AnalyticsPayload>(CACHE_ANALYTICS);
    return c?.data?.listings?.[0]?.id ?? null;
  });
  const [sortBy, setSortBy] = useState<'views' | 'apps' | 'favs' | 'rate'>('views');

  useEffect(() => {
    const cached = getCachedStale<AnalyticsPayload>(CACHE_ANALYTICS);
    if (cached && !cached.stale) { setLoading(false); return; }

    fetch('/api/analytics').then(r => {
      if (r.status === 403) { window.location.href = '/dashboard'; return null; }
      if (!r.ok) return null;
      return r.json();
    }).then((d: AnalyticsPayload | null) => {
      if (d) {
        setCached(CACHE_ANALYTICS, d);
        setData(d);
        if (d.listings[0] && !selected) setSelected(d.listings[0].id);
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ AnalyticsSkeleton 取代全頁 spinner：立即顯示頁面骨架
  if (loading) return <AnalyticsSkeleton />;
  if (!data) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🏠</div>
        <h2 className="font-semibold text-gray-700 mb-2">尚無房源可分析</h2>
        <Link href="/submit" className="btn-primary">立即刊登房源</Link>
      </div>
    </div>
  );

  const { summary, listings } = data;

  const sorted = [...listings].sort((a, b) => {
    if (sortBy === 'views') return b.totals.views - a.totals.views;
    if (sortBy === 'apps') return b.totals.applications - a.totals.applications;
    if (sortBy === 'favs') return b.totals.favorites - a.totals.favorites;
    return parseFloat(b.rates.conversionRate) - parseFloat(a.rates.conversionRate);
  });

  const current = listings.find(l => l.id === selected);
  const imgs = current
    ? (() => { try { return JSON.parse(String(current.images || '[]')) as string[]; } catch { return [] as string[]; } })()
    : [] as string[];

  // 綜合評分（滿分100）
  const calcScore = (l: ListingAnalytics) => {
    const viewScore = Math.min(l.totals.views / 100, 1) * 30;
    const appScore = Math.min(l.totals.applications / 10, 1) * 25;
    const convScore = Math.min(parseFloat(l.rates.conversionRate) / 10, 1) * 20;
    const ratingScore = (l.avgRating / 5) * 15;
    const favScore = Math.min(l.totals.favorites / 20, 1) * 10;
    return Math.round(viewScore + appScore + convScore + ratingScore + favScore);
  };

  const statusColors: Record<string, string> = { active: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700', rejected: 'bg-red-100 text-red-700', inactive: 'bg-gray-100 text-gray-500' };
  const statusLabels: Record<string, string> = { active: '✅ 上架中', pending: '⏳ 審核中', rejected: '❌ 未通過', inactive: '⏸ 下架' };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nomad-navy">📊 房源分析儀表板</h1>
          <p className="text-sm text-gray-500 mt-1">了解你的房源表現，優化刊登策略</p>
        </div>
        <div className="flex gap-3">
          <Link href="/submit" className="btn-primary text-sm">+ 新增房源</Link>
          <Link href="/dashboard" className="btn-secondary text-sm">← 控制台</Link>
        </div>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { icon: '👁', label: '總瀏覽次數', value: summary.totalViews.toLocaleString() },
          { icon: '📩', label: '收到申請', value: summary.totalApps },
          { icon: '❤️', label: '被收藏次數', value: summary.totalFavs },
          { icon: '✅', label: '上架中', value: summary.activeListings },
          { icon: '🏠', label: '全部房源', value: summary.totalListings },
        ].map(c => (
          <div key={c.label} className="card p-4 text-center">
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-xl font-bold text-nomad-navy">{c.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── 多房源對比（僅在有 2 間以上時顯示）── */}
      {listings.length >= 2 && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">🏆 房源表現比較</h2>
            <span className="text-xs text-gray-400">30 天數據</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left pb-2 pr-4 font-medium">房源</th>
                  <th className="text-right pb-2 px-3 font-medium">瀏覽</th>
                  <th className="text-right pb-2 px-3 font-medium">申請</th>
                  <th className="text-right pb-2 px-3 font-medium">收藏</th>
                  <th className="text-right pb-2 px-3 font-medium">轉換率</th>
                  <th className="pb-2 pl-3 font-medium w-32">趨勢</th>
                </tr>
              </thead>
              <tbody>
                {[...listings].sort((a, b) => b.totals.views - a.totals.views).map((l, i) => {
                  const maxViews = Math.max(...listings.map(x => x.totals.views), 1);
                  const rank = ['🥇','🥈','🥉'][i] ?? `${i + 1}.`;
                  const trendData = l.dailyViews.map(d => d.count);
                  const trendMax = Math.max(...trendData, 1);
                  const trendPts = trendData.map((v, idx) =>
                    `${(idx / (trendData.length - 1)) * 120},${32 - (v / trendMax) * 28}`
                  ).join(' ');
                  return (
                    <tr key={l.id} onClick={() => setSelected(l.id)}
                      className={`cursor-pointer border-b border-gray-50 hover:bg-blue-50 transition-colors ${selected === l.id ? 'bg-blue-50' : ''}`}>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{rank}</span>
                          <div>
                            <p className="font-medium text-gray-900 line-clamp-1 max-w-[140px]">{l.title}</p>
                            <p className="text-xs text-gray-400">{l.city} · {l.type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-blue-600">{l.totals.views}</span>
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${(l.totals.views / maxViews) * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-indigo-600">{l.totals.applications}</td>
                      <td className="py-2.5 px-3 text-right text-rose-500">{l.totals.favorites}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`font-bold text-sm ${parseFloat(l.rates.conversionRate) >= 5 ? 'text-green-600' : parseFloat(l.rates.conversionRate) >= 2 ? 'text-yellow-600' : 'text-gray-400'}`}>
                          {l.rates.conversionRate}%
                        </span>
                      </td>
                      <td className="py-2.5 pl-3">
                        <svg viewBox="0 0 120 32" className="w-32 h-8" preserveAspectRatio="none">
                          <polyline points={trendPts} fill="none" stroke={selected === l.id ? '#3b82f6' : '#94a3b8'} strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: listing list */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">我的房源</h2>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
              <option value="views">依瀏覽量</option>
              <option value="apps">依申請數</option>
              <option value="favs">依收藏數</option>
              <option value="rate">依轉換率</option>
            </select>
          </div>
          <div className="space-y-2">
            {sorted.map(l => {
              const score = calcScore(l);
              const lImgs = (() => { try { return JSON.parse(String(l.images || '[]')) as string[]; } catch { return [] as string[]; } })();
              const isSelected = l.id === selected;
              return (
                <button key={l.id} onClick={() => setSelected(l.id)}
                  className={`w-full text-left card p-3 transition-all ${isSelected ? 'ring-2 ring-blue-400 bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex gap-3">
                    <div className="w-14 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                      {lImgs[0] && <img src={lImgs[0]} alt="" loading="lazy" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 line-clamp-1">{l.title}</p>
                      <p className="text-xs text-gray-400">{l.city} · {l.type}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">👁 {l.totals.views}</span>
                        <span className="text-xs text-gray-500">📩 {l.totals.applications}</span>
                        <ScoreBadge score={score} />
                      </div>
                    </div>
                  </div>
                  {/* Sparkline preview */}
                  <div className="mt-2 opacity-70">
                    <Sparkline data={l.dailyViews.map(d => d.count)} color={isSelected ? '#3b82f6' : '#94a3b8'} fillColor={isSelected ? '#dbeafe' : '#f1f5f9'} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="lg:col-span-2">
          {current ? (
            <div className="space-y-4">
              {/* Header card */}
              <div className="card p-5">
                <div className="flex gap-4 mb-4">
                  <div className="w-20 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                    {imgs[0] && <img src={imgs[0]} alt="" loading="lazy" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900">{current.title}</h3>
                      <span className={`badge shrink-0 text-xs ${statusColors[current.status]}`}>{statusLabels[current.status]}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{current.city} {current.district} · {current.type} · {formatPrice(current.price)}/月</p>
                    <div className="flex items-center gap-3 mt-2">
                      <ScoreBadge score={calcScore(current)} />
                      {current.avgRating > 0 && (
                        <span className="text-xs text-yellow-600">{'★'.repeat(Math.round(current.avgRating))} {current.avgRating.toFixed(1)}</span>
                      )}
                      <Link href={`/listings/${current.id}`} target="_blank" className="text-xs text-blue-500 hover:underline ml-auto">👁 查看房源 →</Link>
                    </div>
                  </div>
                </div>

                {/* Core metrics grid */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: '👁', label: '總瀏覽', value: current.totals.views, sub: `近7天 ${current.period.views7d}` },
                    { icon: '📩', label: '總申請', value: current.totals.applications, sub: `待審 ${current.pendingApps}` },
                    { icon: '✅', label: '已配對', value: current.approvedApps, sub: '已核准申請' },
                    { icon: '❤️', label: '被收藏', value: current.totals.favorites, sub: `收藏率 ${current.rates.favoriteRate}%` },
                    { icon: '💬', label: '對話數', value: current.totals.conversations, sub: '站內訊息' },
                    { icon: '📅', label: '看房預約', value: current.totals.viewings, sub: '看房請求' },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <div className="text-lg">{m.icon}</div>
                      <div className="text-xl font-bold text-nomad-navy mt-0.5">{m.value}</div>
                      <div className="text-xs text-gray-500">{m.label}</div>
                      <div className="text-xs text-gray-400">{m.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conversion funnel */}
              <div className="card p-5">
                <h3 className="font-semibold text-gray-800 mb-4">📐 轉換漏斗（近30天）</h3>
                <div className="space-y-3">
                  {[
                    { label: '瀏覽人次', value: current.period.views30d, color: 'bg-blue-400', pct: 100 },
                    { label: '提出申請', value: current.period.apps30d, color: 'bg-indigo-400', pct: current.period.views30d > 0 ? (current.period.apps30d / current.period.views30d) * 100 : 0 },
                    { label: '核准配對', value: current.approvedApps, color: 'bg-green-400', pct: current.period.apps30d > 0 ? (current.approvedApps / current.period.apps30d) * 100 : 0 },
                  ].map((step, i) => (
                    <div key={step.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{['① ', '② ', '③ '][i]}{step.label}</span>
                        <span className="font-bold text-nomad-navy">{step.value} <span className="text-xs font-normal text-gray-400">({step.pct.toFixed(1)}%)</span></span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2.5">
                        <div className={`${step.color} h-2.5 rounded-full transition-all`} style={{ width: `${Math.min(step.pct, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex gap-4 text-sm">
                  <div className="text-center flex-1">
                    <div className="text-lg font-bold text-blue-600">{current.rates.conversionRate}%</div>
                    <div className="text-xs text-gray-400">瀏覽→申請率</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-lg font-bold text-green-600">{current.rates.favoriteRate}%</div>
                    <div className="text-xs text-gray-400">瀏覽→收藏率</div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-lg font-bold text-purple-600">
                      {current.totals.applications > 0 ? ((current.approvedApps / current.totals.applications) * 100).toFixed(0) : 0}%
                    </div>
                    <div className="text-xs text-gray-400">申請核准率</div>
                  </div>
                </div>
              </div>

              {/* Daily views chart — 柱狀圖 + 折線疊加 */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">👁 近14天每日瀏覽趨勢</h3>
                  <div className="text-right">
                    <span className="text-xs font-bold text-blue-600">{current.period.views7d}</span>
                    <span className="text-xs text-gray-400"> 次（近7天）</span>
                  </div>
                </div>
                {(() => {
                  const dv = current.dailyViews;
                  const maxVal = Math.max(...dv.map(d => d.count), 1);
                  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * maxVal));
                  return (
                    <div className="relative">
                      {/* Y 軸格線 */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ paddingBottom: 28 }}>
                        {gridLines.slice().reverse().map((v, i) => (
                          <div key={i} className="flex items-center">
                            <span className="text-xs text-gray-300 w-4 text-right mr-1">{v || ''}</span>
                            <div className="flex-1 border-t border-gray-100" />
                          </div>
                        ))}
                      </div>
                      {/* 柱狀圖 */}
                      <div className="flex gap-1 items-end ml-5" style={{ height: 100 }}>
                        {dv.map((d, i) => {
                          const barH = Math.max((d.count / maxVal) * 100, d.count > 0 ? 4 : 0);
                          const isToday = i === dv.length - 1;
                          return (
                            <div key={d.date} className="flex-1 flex flex-col justify-end group relative">
                              {/* 懸停 tooltip */}
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 transition-opacity">
                                {d.date}: {d.count}次
                              </div>
                              <div
                                className={`rounded-t transition-all ${isToday ? 'bg-blue-500' : d.count > maxVal * 0.7 ? 'bg-blue-400' : d.count > maxVal * 0.3 ? 'bg-blue-300' : 'bg-blue-200'}`}
                                style={{ height: `${barH}%` }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      {/* X 軸日期 */}
                      <div className="flex ml-5 mt-1">
                        {dv.map((d, i) => (
                          <div key={d.date} className="flex-1 text-center">
                            {(i === 0 || i === 6 || i === 13) && (
                              <span className="text-xs text-gray-400">{d.date}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Improvement tips */}
              <div className="card p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                <h3 className="font-semibold text-gray-800 mb-3">💡 優化建議</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  {current.totals.views < 10 && (
                    <div className="flex gap-2"><span className="text-orange-500 shrink-0">●</span><span>瀏覽量偏低，建議補充更多高品質照片並完善房源描述</span></div>
                  )}
                  {parseFloat(current.rates.conversionRate) < 3 && current.totals.views >= 10 && (
                    <div className="flex gap-2"><span className="text-orange-500 shrink-0">●</span><span>申請轉換率偏低（{current.rates.conversionRate}%），可考慮調整定價或補充工作環境資訊</span></div>
                  )}
                  {current.avgRating === 0 && current.totals.applications > 0 && (
                    <div className="flex gap-2"><span className="text-blue-500 shrink-0">●</span><span>目前尚無評價，鼓勵已入住的租客撰寫評語，可提升信任度</span></div>
                  )}
                  {current.totals.favorites > 5 && current.totals.applications === 0 && (
                    <div className="flex gap-2"><span className="text-purple-500 shrink-0">●</span><span>有人收藏但未申請，可能是租期或價格有顧慮，建議在說明中加強澄清</span></div>
                  )}
                  {current.totals.views >= 50 && parseFloat(current.rates.conversionRate) >= 5 && current.avgRating >= 4 && (
                    <div className="flex gap-2"><span className="text-green-500 shrink-0">✓</span><span>房源表現優良！繼續保持高品質服務與快速回應申請</span></div>
                  )}
                  {current.totals.views === 0 && (
                    <div className="flex gap-2"><span className="text-red-500 shrink-0">●</span><span>尚無瀏覽紀錄，請確認房源狀態為「上架中」</span></div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-gray-500">選取左側房源以查看詳細分析</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
