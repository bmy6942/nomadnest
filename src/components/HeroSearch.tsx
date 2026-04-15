'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 明確宣告型別，讓 optional 欄位被 TypeScript 正確識別（避免 TS2352 類型轉換錯誤）
interface PopularSearch {
  label: string;
  q: string;
  city: string;
  foreignOk?: string;
  hasDesk?: string;
  type?: string;
}

const POPULAR_SEARCHES: PopularSearch[] = [
  { label: '台北 500Mbps 套房', q: '台北', city: '台北市' },
  { label: '花蓮 1 個月起租', q: '', city: '花蓮縣' },
  { label: '台中 外籍友善', q: '', city: '台中市', foreignOk: 'true' },
  { label: '高雄 有工作桌', q: '', city: '高雄市', hasDesk: 'true' },
  { label: '台南 雅房', q: '', city: '台南市', type: '雅房' },
  { label: '共居空間', q: '', city: '', type: '共居空間' },
];

const CITY_SUGGESTIONS = ['台北市', '新北市', '台中市', '高雄市', '台南市', '花蓮縣', '桃園市', '宜蘭縣', '嘉義市', '基隆市'];
const AREA_SUGGESTIONS = ['大安區', '信義區', '中山區', '松山區', '文山區', '南屯區', '西屯區', '鹽埕區', '前金區', '花蓮市'];
const KEYWORD_SUGGESTIONS = ['近捷運', '附工作桌', '外籍友善', '超高速Wi-Fi', '1個月起租', '共居空間', '含水電', '陽台', '獨衛'];

export default function HeroSearch() {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 點外部關閉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allSuggestions = [
    ...CITY_SUGGESTIONS.filter(s => q && s.includes(q)),
    ...AREA_SUGGESTIONS.filter(s => q && s.includes(q)),
    ...KEYWORD_SUGGESTIONS.filter(s => q && s.includes(q)),
  ].slice(0, 6);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (city) params.set('city', city);
    router.push(`/listings?${params}`);
  };

  const applyPopular = (s: PopularSearch) => {
    const params = new URLSearchParams();
    if (s.q)         params.set('q', s.q);
    if (s.city)      params.set('city', s.city);
    if (s.foreignOk) params.set('foreignOk', s.foreignOk);
    if (s.hasDesk)   params.set('hasDesk', s.hasDesk);
    if (s.type)      params.set('type', s.type);
    router.push(`/listings?${params}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}
        className="bg-white rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-2xl">
        {/* 搜尋關鍵字 */}
        <div ref={containerRef} className="flex-1 relative">
          <input
            ref={inputRef}
            name="q"
            value={q}
            onChange={e => { setQ(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="搜尋城市、地區、房源名稱…"
            className="w-full px-4 py-3 text-gray-800 text-sm focus:outline-none rounded-xl"
            autoComplete="off"
          />
          {/* 下拉建議 */}
          {showSuggestions && (allSuggestions.length > 0 || !q) && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
              {!q ? (
                <div className="p-3">
                  <div className="text-xs font-semibold text-gray-400 uppercase px-1 mb-2">熱門搜尋</div>
                  {POPULAR_SEARCHES.map(s => (
                    <button key={s.label} type="button"
                      onClick={() => { applyPopular(s); setShowSuggestions(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 rounded-lg flex items-center gap-2">
                      <span className="text-base">🔥</span> {s.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-1">
                  {allSuggestions.map(s => (
                    <button key={s} type="button"
                      onClick={() => { setQ(s); setShowSuggestions(false); inputRef.current?.focus(); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2">
                      <span className="text-gray-400">🔍</span> {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 城市選擇 */}
        <select
          name="city"
          value={city}
          onChange={e => setCity(e.target.value)}
          className="px-4 py-3 text-gray-700 text-sm rounded-xl focus:outline-none bg-gray-50 border border-gray-100">
          <option value="">所有城市</option>
          {['台北市', '新北市', '台中市', '高雄市', '台南市', '花蓮縣'].map(c =>
            <option key={c} value={c}>{c}</option>)}
        </select>

        <button type="submit" className="btn-primary px-8 py-3 rounded-xl whitespace-nowrap text-sm">
          🔍 搜尋房源
        </button>
      </form>

      {/* 熱門標籤 */}
      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        {POPULAR_SEARCHES.slice(0, 4).map(s => (
          <button key={s.label} type="button"
            onClick={() => applyPopular(s)}
            className="text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-1.5 rounded-full transition-colors backdrop-blur-sm">
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
