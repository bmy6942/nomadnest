'use client';

/**
 * Web Vitals 追蹤元件
 *
 * 追蹤 Google Core Web Vitals：
 *   LCP  — Largest Contentful Paint  (目標 < 2.5s)
 *   INP  — Interaction to Next Paint  (目標 < 200ms，取代 FID)
 *   CLS  — Cumulative Layout Shift    (目標 < 0.1)
 *   FCP  — First Contentful Paint     (目標 < 1.8s)
 *   TTFB — Time to First Byte         (目標 < 0.8s)
 *
 * 使用方式：在 layout.tsx 中引入
 *   import WebVitals from '@/components/WebVitals';
 *   // 在 <body> 中加入：
 *   <WebVitals />
 *
 * 擴充指引：
 *   - 接入 Vercel Analytics：改用 @vercel/analytics 的 Analytics 元件
 *   - 接入 Google Analytics：在 reportWebVital 中呼叫 gtag()
 *   - 接入 Datadog：使用 datadog-browser-rum 的 addTiming API
 */

import { useReportWebVitals } from 'next/web-vitals';

/** Web Vitals 指標型別（來自 next/web-vitals，App Router 相容）*/
type WebVitalMetric = {
  id: string;
  name: string;
  value: number;
  label: 'web-vital' | 'custom';
  startTime: number;
};

/**
 * 去重集合：同一個底層 PerformanceEntry（name + startTime）只上報一次。
 * 解決 Next.js dev 模式下 useReportWebVitals 被呼叫兩次的問題。
 */
const _reported = new Set<string>();

/** 根據指標名稱與數值判斷品質等級 */
function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    LCP:  [2500, 4000],   // good < 2.5s, poor > 4s
    INP:  [200,  500],    // good < 200ms, poor > 500ms
    CLS:  [0.1,  0.25],   // good < 0.1, poor > 0.25
    FCP:  [1800, 3000],   // good < 1.8s, poor > 3s
    TTFB: [800,  1800],   // good < 0.8s, poor > 1.8s
  };
  const [good, poor] = thresholds[name] ?? [Infinity, Infinity];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

function onVital(metric: WebVitalMetric): void {
  // 去重：同一個效能事件（相同 name + startTime）只處理一次
  const dedupeKey = `${metric.name}:${metric.startTime}`;
  if (_reported.has(dedupeKey)) return;
  _reported.add(dedupeKey);

  const rating = getRating(metric.name, metric.value);
  const icon   = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';

  // 開發環境：直接打印（方便即時調適）
  if (process.env.NODE_ENV !== 'production') {
    const isCLS = metric.name === 'CLS';
    const unit  = isCLS ? '' : 'ms';
    console.log(
      `[Web Vitals] ${icon} ${metric.name}: ${metric.value.toFixed(isCLS ? 4 : 0)}${unit}` +
      ` (${rating}) [${metric.id}]`
    );
    return;
  }

  // 生產環境：使用 sendBeacon 非阻塞上報（/api/vitals 端點記錄）
  const body = JSON.stringify({
    name:  metric.name,
    value: metric.value,
    rating,
    id:    metric.id,
    url:   window.location.pathname,
    ts:    Date.now(),
  });

  // sendBeacon 保證頁面卸載時也能傳送
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    // fallback：fire-and-forget fetch
    fetch('/api/vitals', {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {/* 靜默忽略：vitals 上報失敗不影響使用者 */});
  }
}

export default function WebVitals() {
  useReportWebVitals(onVital);
  // 此元件不渲染任何 UI，純粹用於副作用
  return null;
}
