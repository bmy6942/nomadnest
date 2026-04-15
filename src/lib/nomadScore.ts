/**
 * Nomad Score — 游牧評分系統
 *
 * 計算方式（滿分 10）：
 *
 * ① Wi-Fi 速度（0–4 分）
 *    300 Mbps+   → 4
 *    100–299     → 3
 *    50–99       → 2
 *    25–49       → 1
 *    0–24        → 0
 *
 * ② 辦公桌（0–2 分）
 *    has desk    → 2
 *    no desk     → 0
 *
 * ③ Wi-Fi 官方驗證（0–1 分）
 *    verified    → 1
 *
 * ④ 外籍友善（0–1 分）
 *    foreignOk   → 1
 *
 * ⑤ 用戶評分（0–2 分）
 *    ≥ 4.5      → 2
 *    ≥ 3.5      → 1
 *    < 3.5 / 無  → 0
 *
 * 合計最高 10 分，顯示為整數。
 */

export interface NomadScoreInput {
  wifiSpeed:    number;
  wifiVerified?: boolean;
  hasDesk:      boolean;
  foreignOk?:   boolean;
  avgRating?:   string | number | null;
}

export interface NomadScoreResult {
  score:    number;   // 0–10
  label:    string;   // e.g. "9.0"
  tier:     'excellent' | 'good' | 'fair' | 'poor';
  tierLabel: string;  // 繁體中文 label
  color:    string;   // Tailwind text color
  bgColor:  string;   // Tailwind bg color
  breakdown: {
    wifi:     number;   // 0–4
    desk:     number;   // 0–2
    verified: number;   // 0–1
    foreign:  number;   // 0–1
    rating:   number;   // 0–2
  };
}

export function computeNomadScore(input: NomadScoreInput): NomadScoreResult {
  const { wifiSpeed, wifiVerified = false, hasDesk, foreignOk = false, avgRating } = input;

  // ① Wi-Fi speed (0–4)
  let wifi = 0;
  if (wifiSpeed >= 300)      wifi = 4;
  else if (wifiSpeed >= 100) wifi = 3;
  else if (wifiSpeed >= 50)  wifi = 2;
  else if (wifiSpeed >= 25)  wifi = 1;

  // ② Desk (0–2)
  const desk = hasDesk ? 2 : 0;

  // ③ Verified (0–1)
  const verified = wifiVerified ? 1 : 0;

  // ④ Foreign (0–1)
  const foreign = foreignOk ? 1 : 0;

  // ⑤ Rating (0–2)
  const numRating = avgRating != null ? Number(avgRating) : 0;
  let rating = 0;
  if (numRating >= 4.5)      rating = 2;
  else if (numRating >= 3.5) rating = 1;

  const score = Math.min(10, wifi + desk + verified + foreign + rating);

  // Tier
  let tier: NomadScoreResult['tier'];
  let tierLabel: string;
  let color: string;
  let bgColor: string;

  if (score >= 8) {
    tier = 'excellent'; tierLabel = '游牧首選'; color = 'text-emerald-700'; bgColor = 'bg-emerald-50';
  } else if (score >= 6) {
    tier = 'good';      tierLabel = '工作友善'; color = 'text-blue-700';    bgColor = 'bg-blue-50';
  } else if (score >= 4) {
    tier = 'fair';      tierLabel = '基本可用'; color = 'text-amber-700';   bgColor = 'bg-amber-50';
  } else {
    tier = 'poor';      tierLabel = '需再確認'; color = 'text-gray-500';    bgColor = 'bg-gray-50';
  }

  return {
    score,
    label: score.toFixed(0),
    tier,
    tierLabel,
    color,
    bgColor,
    breakdown: { wifi, desk, verified, foreign, rating },
  };
}
