/**
 * Wi-Fi 速度標籤
 *
 * 回傳物件含：
 *  - labelKey : 對應 messages common 命名空間的翻譯 key（供 i18n 使用）
 *  - label    : 中文預設標籤（向後相容；不使用 i18n 時的保底值）
 *  - color    : Tailwind CSS 顏色組合
 *  - emoji    : 速度圖示
 */
export function wifiLabel(speed: number): {
  labelKey: string;
  label:    string;
  color:    string;
  emoji:    string;
} {
  if (speed >= 200) return { labelKey: 'wifiSuperFast', label: '超高速', color: 'text-green-600 bg-green-50 border-green-200', emoji: '🔥' };
  if (speed >= 100) return { labelKey: 'wifiFast',      label: '高速',   color: 'text-blue-600 bg-blue-50 border-blue-200',   emoji: '⚡' };
  if (speed >= 30)  return { labelKey: 'wifiStable',    label: '穩定',   color: 'text-yellow-600 bg-yellow-50 border-yellow-200', emoji: '✅' };
  return               { labelKey: 'wifiBasic',     label: '基本',   color: 'text-gray-600 bg-gray-50 border-gray-200',    emoji: '⚠️' };
}

/**
 * 房型標籤（含 emoji 裝飾）
 * 資料庫儲存為中文 key，前端顯示加 emoji。
 * 若無對應，原樣回傳（前端已透過 i18n 顯示中文或英文名稱）。
 */
export function typeLabel(type: string): string {
  const map: Record<string, string> = {
    '套房': '🏠 套房', '雅房': '🛏 雅房',
    '整層公寓': '🏢 整層公寓', '共居空間': '🤝 共居空間',
  };
  return map[type] || type;
}

export function cityColor(city: string): string {
  const map: Record<string, string> = {
    '台北市': 'bg-blue-100 text-blue-800',
    '新北市': 'bg-indigo-100 text-indigo-800',
    '台中市': 'bg-green-100 text-green-800',
    '高雄市': 'bg-orange-100 text-orange-800',
    '花蓮縣': 'bg-teal-100 text-teal-800',
  };
  return map[city] || 'bg-gray-100 text-gray-800';
}

/**
 * 格式化數字加千位符，例如 10000 → "10,000"
 * 使用 regex 替代 toLocaleString() 以避免 SSR hydration 不符：
 * Node.js 與瀏覽器的 ICU locale 可能不同，導致千位符格式差異。
 */
export function formatNumber(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 格式化價格為 "NT$ 10,000" 格式（SSR hydration 安全）*/
export function formatPrice(price: number): string {
  return `NT$ ${formatNumber(price)}`;
}

/**
 * 將 'YYYY-MM-DD' 格式的可入住日期轉換為語系對應的易讀字串
 *
 * zh-TW（預設）：'2025-08-01' → '2025年8月1日'
 * en           ：'2025-08-01' → 'August 1, 2025'
 *
 * 純字串操作（zh-TW）或穩定的 Intl.DateTimeFormat 格式（en）；
 * 使用固定 timeZone:'UTC' 避免 Server/Client 時區差異造成 hydration mismatch。
 */
export function formatAvailableDate(dateStr: string, locale = 'zh-TW'): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (locale === 'en') {
    // Intl.DateTimeFormat：Node.js 與瀏覽器輸出一致（UTC 時區，不受本地時區影響）
    try {
      const date = new Date(Date.UTC(y, m - 1, d));
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
      }).format(date);
    } catch {
      // Intl 不可用時降級回英文預設格式
      const monthNames = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];
      return `${monthNames[m - 1]} ${d}, ${y}`;
    }
  }
  // zh-TW 及其他語系：純字串，SSR hydration 100% 安全
  return `${y}年${m}月${d}日`;
}
