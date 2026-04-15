/**
 * 地理編碼工具 — 使用 Nominatim (OpenStreetMap)
 * 免費、不需要 API Key，支援台灣中文地址
 */

export type GeoResult = {
  lat: number;
  lng: number;
  displayName: string;
} | null;

/**
 * 將地址轉換為經緯度
 * @param city  城市，例如「台北市」
 * @param district 區域，例如「大安區」
 * @param address 詳細地址，例如「仁愛路四段12號」
 */
export async function geocodeAddress(
  city: string,
  district: string,
  address: string
): Promise<GeoResult> {
  // 組合搜尋字串，加上「台灣」提高精準度
  const query = `${address} ${district} ${city} 台灣`.trim();

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=tw`,
      {
        headers: {
          // Nominatim 要求設定 User-Agent
          'User-Agent': 'NomadNest-Taiwan/1.0 (nomadnest.tw)',
          'Accept-Language': 'zh-TW,zh;q=0.9',
        },
      }
    );

    if (!res.ok) return null;
    const data = await res.json();

    if (!data || data.length === 0) {
      // 若完整地址找不到，退而求其次只搜城市+區
      const fallbackQuery = `${district} ${city} 台灣`;
      const fallbackRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallbackQuery)}&format=json&limit=1&countrycodes=tw`,
        { headers: { 'User-Agent': 'NomadNest-Taiwan/1.0', 'Accept-Language': 'zh-TW' } }
      );
      const fallback = await fallbackRes.json();
      if (!fallback || fallback.length === 0) return null;
      return {
        lat: parseFloat(fallback[0].lat),
        lng: parseFloat(fallback[0].lon),
        displayName: fallback[0].display_name,
      };
    }

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch {
    return null;
  }
}
