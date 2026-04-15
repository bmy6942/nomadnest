import { describe, it, expect } from 'vitest';
import {
  wifiLabel,
  typeLabel,
  cityColor,
  formatNumber,
  formatPrice,
  formatAvailableDate,
} from '@/lib/utils';

// ─── wifiLabel ────────────────────────────────────────────────────────────────
describe('wifiLabel', () => {
  it('速度 ≥ 200 Mbps → 超高速 + 綠色 + 🔥', () => {
    const result = wifiLabel(200);
    expect(result.label).toBe('超高速');
    expect(result.color).toContain('green');
    expect(result.emoji).toBe('🔥');
  });

  it('速度 = 500 Mbps → 超高速', () => {
    expect(wifiLabel(500).label).toBe('超高速');
  });

  it('速度 ≥ 100 且 < 200 Mbps → 高速 + 藍色 + ⚡', () => {
    const result = wifiLabel(100);
    expect(result.label).toBe('高速');
    expect(result.color).toContain('blue');
    expect(result.emoji).toBe('⚡');
  });

  it('速度 = 150 Mbps → 高速', () => {
    expect(wifiLabel(150).label).toBe('高速');
  });

  it('速度 ≥ 30 且 < 100 Mbps → 穩定 + 黃色 + ✅', () => {
    const result = wifiLabel(30);
    expect(result.label).toBe('穩定');
    expect(result.color).toContain('yellow');
    expect(result.emoji).toBe('✅');
  });

  it('速度 = 99 Mbps → 穩定', () => {
    expect(wifiLabel(99).label).toBe('穩定');
  });

  it('速度 < 30 Mbps → 基本 + 灰色 + ⚠️', () => {
    const result = wifiLabel(10);
    expect(result.label).toBe('基本');
    expect(result.color).toContain('gray');
    expect(result.emoji).toBe('⚠️');
  });

  it('速度 = 0 → 基本', () => {
    expect(wifiLabel(0).label).toBe('基本');
  });

  it('速度 = 29 → 基本', () => {
    expect(wifiLabel(29).label).toBe('基本');
  });

  it('速度 = 199 → 高速', () => {
    expect(wifiLabel(199).label).toBe('高速');
  });

  it('各速度帶回傳正確的 labelKey（用於 i18n）', () => {
    expect(wifiLabel(200).labelKey).toBe('wifiSuperFast');
    expect(wifiLabel(100).labelKey).toBe('wifiFast');
    expect(wifiLabel(30).labelKey).toBe('wifiStable');
    expect(wifiLabel(10).labelKey).toBe('wifiBasic');
  });
});

// ─── typeLabel ────────────────────────────────────────────────────────────────
describe('typeLabel', () => {
  it('套房 → 🏠 套房', () => {
    expect(typeLabel('套房')).toBe('🏠 套房');
  });

  it('雅房 → 🛏 雅房', () => {
    expect(typeLabel('雅房')).toBe('🛏 雅房');
  });

  it('整層公寓 → 🏢 整層公寓', () => {
    expect(typeLabel('整層公寓')).toBe('🏢 整層公寓');
  });

  it('共居空間 → 🤝 共居空間', () => {
    expect(typeLabel('共居空間')).toBe('🤝 共居空間');
  });

  it('未知類型 → 原樣回傳', () => {
    expect(typeLabel('其他')).toBe('其他');
    expect(typeLabel('')).toBe('');
    expect(typeLabel('unknown')).toBe('unknown');
  });
});

// ─── cityColor ────────────────────────────────────────────────────────────────
describe('cityColor', () => {
  const cases: [string, string][] = [
    ['台北市', 'blue'],
    ['新北市', 'indigo'],
    ['台中市', 'green'],
    ['高雄市', 'orange'],
    ['花蓮縣', 'teal'],
  ];

  cases.forEach(([city, color]) => {
    it(`${city} → 包含 ${color}`, () => {
      expect(cityColor(city)).toContain(color);
    });
  });

  it('未知城市 → 灰色預設', () => {
    expect(cityColor('嘉義市')).toContain('gray');
    expect(cityColor('')).toContain('gray');
  });
});

// ─── formatNumber ─────────────────────────────────────────────────────────────
describe('formatNumber', () => {
  it('小於 1000 的數字不加逗號', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(100)).toBe('100');
  });

  it('1000 → "1,000"', () => {
    expect(formatNumber(1000)).toBe('1,000');
  });

  it('10000 → "10,000"', () => {
    expect(formatNumber(10000)).toBe('10,000');
  });

  it('1000000 → "1,000,000"', () => {
    expect(formatNumber(1000000)).toBe('1,000,000');
  });

  it('小數會被四捨五入', () => {
    expect(formatNumber(999.5)).toBe('1,000');
    expect(formatNumber(999.4)).toBe('999');
    expect(formatNumber(10000.6)).toBe('10,001');
  });

  it('負數', () => {
    expect(formatNumber(-1000)).toBe('-1,000');
  });
});

// ─── formatPrice ─────────────────────────────────────────────────────────────
describe('formatPrice', () => {
  it('格式化為 "NT$ X,XXX"', () => {
    expect(formatPrice(10000)).toBe('NT$ 10,000');
    expect(formatPrice(0)).toBe('NT$ 0');
    expect(formatPrice(25000)).toBe('NT$ 25,000');
    expect(formatPrice(1500000)).toBe('NT$ 1,500,000');
  });

  it('整合 formatNumber 的四捨五入', () => {
    expect(formatPrice(9999.7)).toBe('NT$ 10,000');
  });
});

// ─── formatAvailableDate ─────────────────────────────────────────────────────
describe('formatAvailableDate', () => {
  it('YYYY-MM-DD → 中文年月日', () => {
    expect(formatAvailableDate('2025-08-01')).toBe('2025年8月1日');
    expect(formatAvailableDate('2024-12-31')).toBe('2024年12月31日');
    expect(formatAvailableDate('2025-01-01')).toBe('2025年1月1日');
  });

  it('月份與日期不補零', () => {
    // '2025-08-01' → month=8, day=1 (no leading zeros)
    const result = formatAvailableDate('2025-08-01');
    expect(result).toContain('8月');
    expect(result).toContain('1日');
    expect(result).not.toContain('08月');
    expect(result).not.toContain('01日');
  });

  it('雙位數月份與日期', () => {
    const result = formatAvailableDate('2025-12-25');
    expect(result).toBe('2025年12月25日');
  });

  it('en locale → 英文長格式日期（不含時區偏移）', () => {
    const result = formatAvailableDate('2025-08-01', 'en');
    // Intl.DateTimeFormat('en-US') 輸出 "August 1, 2025"
    expect(result).toContain('August');
    expect(result).toContain('2025');
    expect(result).toContain('1');
  });

  it('en locale 12月25日', () => {
    const result = formatAvailableDate('2025-12-25', 'en');
    expect(result).toContain('December');
    expect(result).toContain('25');
    expect(result).toContain('2025');
  });

  it('預設 locale 行為與顯式傳入 zh-TW 一致', () => {
    expect(formatAvailableDate('2025-06-15')).toBe(formatAvailableDate('2025-06-15', 'zh-TW'));
  });
});
