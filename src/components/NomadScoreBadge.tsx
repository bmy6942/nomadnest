'use client';
/**
 * NomadScoreBadge — 游牧評分徽章元件
 *
 * 兩種尺寸：
 *   size="sm"  → 小型 badge，用於 ListingCard 列表
 *   size="lg"  → 大型卡片，用於房源詳情頁
 */
import { computeNomadScore, type NomadScoreInput } from '@/lib/nomadScore';

interface Props extends NomadScoreInput {
  size?: 'sm' | 'lg';
  showBreakdown?: boolean;
}

const BAR_COLORS: Record<string, string> = {
  wifi:     'bg-blue-500',
  desk:     'bg-emerald-500',
  verified: 'bg-indigo-500',
  foreign:  'bg-violet-500',
  rating:   'bg-amber-500',
};

const BAR_MAX: Record<string, number> = {
  wifi: 4, desk: 2, verified: 1, foreign: 1, rating: 2,
};

const BAR_LABELS: Record<string, string> = {
  wifi:     'Wi-Fi 速度',
  desk:     '工作桌',
  verified: 'Wi-Fi 驗證',
  foreign:  '外籍友善',
  rating:   '用戶評分',
};

export default function NomadScoreBadge({
  size = 'sm',
  showBreakdown = false,
  ...scoreInput
}: Props) {
  const result = computeNomadScore(scoreInput);

  if (size === 'sm') {
    return (
      <span
        className={`inline-flex items-center gap-1 badge font-bold text-xs ${result.bgColor} ${result.color} border border-current/20`}
        title={`Nomad Score ${result.score}/10 — ${result.tierLabel}`}
        aria-label={`游牧評分 ${result.score} 分，${result.tierLabel}`}>
        <svg className="w-3 h-3" aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1L9.9 5.8L15 6.1L11.5 9.4L12.5 14.5L8 12L3.5 14.5L4.5 9.4L1 6.1L6.1 5.8L8 1Z"/>
        </svg>
        {result.score}
        <span className="opacity-60 font-normal">/10</span>
      </span>
    );
  }

  // size === 'lg'
  return (
    <div className={`rounded-2xl border p-5 ${result.bgColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-baseline gap-1">
            <span className={`text-4xl font-bold ${result.color}`}>{result.score}</span>
            <span className="text-gray-400 text-sm">/10</span>
          </div>
          <div className={`text-xs font-bold uppercase tracking-wider mt-0.5 ${result.color}`}>
            Nomad Score
          </div>
        </div>
        <div className={`text-sm font-bold px-3 py-1 rounded-full border ${result.bgColor} ${result.color} border-current/20`}>
          {result.tierLabel}
        </div>
      </div>

      {/* Score ring / arc visualisation (simple CSS bar) */}
      <div className="mb-4">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              result.tier === 'excellent' ? 'bg-emerald-500' :
              result.tier === 'good'      ? 'bg-blue-500'    :
              result.tier === 'fair'      ? 'bg-amber-500'   : 'bg-gray-400'
            }`}
            style={{ width: `${(result.score / 10) * 100}%` }}
          />
        </div>
      </div>

      {/* Breakdown (optional) */}
      {showBreakdown && (
        <div className="space-y-2">
          {(Object.keys(result.breakdown) as (keyof typeof result.breakdown)[]).map(key => {
            const val = result.breakdown[key];
            const max = BAR_MAX[key];
            const pct = max > 0 ? (val / max) * 100 : 0;
            return (
              <div key={key}>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span>{BAR_LABELS[key]}</span>
                  <span className="font-medium text-gray-700">{val}/{max}</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${BAR_COLORS[key]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
