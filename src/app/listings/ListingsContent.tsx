'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import ListingCard from '@/components/ListingCard';
import { SkeletonGrid } from '@/components/SkeletonCard';
import dynamic from 'next/dynamic';
import { useTranslations } from '@/i18n/provider';

// 動態載入地圖（避免 SSR 問題）
const ListingMap = dynamic(() => import('@/components/ListingMap'), { ssr: false });

type ViewMode = 'grid' | 'map';

export default function ListingsContent() {
  const t           = useTranslations('listings');
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [listings, setListings] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Desktop: sidebar open/close; Mobile: bottom sheet open/close
  const [showFilters, setShowFilters] = useState(false);

  // 手機 Bottom Sheet 開啟時鎖定 body 捲動，避免背景頁面同時可捲
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isLg = window.matchMedia('(min-width: 1024px)').matches;
    if (isLg) return; // 桌面不鎖定
    document.body.style.overflow = showFilters ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showFilters]);
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // 手機地圖模式：'map' 顯示地圖全螢幕，'list' 顯示列表面板
  const [mobileMapPanel, setMobileMapPanel] = useState<'map' | 'list'>('map');
  const [page, setPage] = useState(Math.max(1, parseInt(searchParams.get('page') || '1')));
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // ✅ 分離 q（關鍵字）為獨立 state，方便做 debounce
  const [qInput, setQInput] = useState(searchParams.get('q') || '');
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const [filters, setFilters] = useState({
    city:        searchParams.get('city')        || '',
    type:        searchParams.get('type')        || '',
    minWifi:     searchParams.get('minWifi')     || '',
    minPrice:    searchParams.get('minPrice')    || '',
    maxPrice:    searchParams.get('maxPrice')    || '',
    minRent:     searchParams.get('minRent')     || '',
    foreignOk:   searchParams.get('foreignOk')  || '',
    hasDesk:     searchParams.get('hasDesk')     || '',
    availableBy: searchParams.get('availableBy') || '', // 'YYYY-MM-DD'
    nearMRT:     searchParams.get('nearMRT')     || '', // 步行分鐘上限
    nearCowork:  searchParams.get('nearCowork')  || '', // 步行分鐘上限
    q:           searchParams.get('q')           || '',
  });

  // ✅ 「本週/本月/3個月內」快捷按鈕日期：
  //    用 useState + useEffect，確保只在 client mount 後計算，
  //    server render 時 shortcuts 為空陣列 → 不渲染快捷按鈕 → 無 hydration mismatch
  const [dateShortcuts, setDateShortcuts] = useState<{ label: string; val: string }[]>([]);
  useEffect(() => {
    const addDays = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    setDateShortcuts([
      { label: t('thisWeek'),    val: addDays(7) },
      { label: t('thisMonth'),   val: addDays(30) },
      { label: t('threeMonths'), val: addDays(90) },
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 關鍵字輸入加 400ms debounce，避免每打一個字都發 API
  const handleQChange = (val: string) => {
    setQInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters(f => ({ ...f, q: val }));
    }, 400);
  };

  // ✅ 登入狀態 & 收藏：並行請求，不再串行
  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
      fetch('/api/favorites').then(r => r.ok ? r.json() : null),
    ]).then(([authData, favData]) => {
      if (authData?.user) {
        setIsLoggedIn(true);
        if (favData?.favorites) {
          setFavoriteIds(new Set(favData.favorites.map((f: { listing: { id: string } }) => f.listing.id)));
        }
      }
    }).catch(() => {});
  }, []);

  // 篩選條件改變時重置到第一頁
  const prevFilters = JSON.stringify(filters);
  useEffect(() => { setPage(1); }, [prevFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ 同步篩選條件到 URL（可分享連結、瀏覽器返回有效）
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    if (sortBy && sortBy !== 'newest') params.set('sortBy', sortBy);
    if (page > 1) params.set('page', String(page));
    router.replace(`/listings${params.toString() ? `?${params}` : ''}`, { scroll: false });
  }, [filters, sortBy, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // 搜尋（含分頁 + 伺服器端排序）
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.set('page', String(page));
    if (sortBy && sortBy !== 'rating') params.set('sortBy', sortBy); // rating 由前端處理
    setLoading(true);
    fetch(`/api/listings?${params}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (d && typeof d === 'object' && 'listings' in d) {
          setListings(Array.isArray(d.listings) ? d.listings : []);
          setTotal(d.total || 0);
          setTotalPages(d.totalPages || 1);
        } else {
          setListings(Array.isArray(d) ? d : []);
        }
        setLoading(false);
      })
      .catch(() => {
        // API 錯誤時保留現有列表，讓 UI 不崩潰
        setLoading(false);
      });
  }, [filters, page, sortBy]);

  const cities = ['台北市', '新北市', '台中市', '高雄市', '花蓮縣', '台南市', '桃園市'];
  const types = ['套房', '雅房', '整層公寓', '共居空間'];
  const clearAll = () => {
    setQInput('');
    setFilters({ city: '', type: '', minWifi: '', minPrice: '', maxPrice: '', minRent: '', foreignOk: '', hasDesk: '', availableBy: '', nearMRT: '', nearCowork: '', q: '' });
  };
  const activeCount = Object.values(filters).filter(Boolean).length;

  const [savingSearch, setSavingSearch] = useState(false);
  const [searchSaved, setSearchSaved] = useState(false);
  const saveSearch = async () => {
    if (!isLoggedIn) { window.location.href = '/auth/login'; return; }
    setSavingSearch(true);
    const name = [filters.city, filters.type, filters.q].filter(Boolean).join(' · ') || '我的搜尋';
    const res = await fetch('/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, ...filters,
        maxPrice: filters.maxPrice || null,
        minWifi: filters.minWifi || null,
        availableBy: filters.availableBy || null,
      }),
    });
    setSavingSearch(false);
    if (res.ok) { setSearchSaved(true); setTimeout(() => setSearchSaved(false), 3000); }
  };

  // ✅ 伺服器端已完成 price/wifi/newest 排序；僅 rating 需要前端排序
  type ListingRaw = {
    id: string; price: number; wifiSpeed: number; createdAt: string;
    lat: number | null; lng: number | null; title: string; city: string;
    images: string[] | string; type?: string;
    reviews?: { rating: number }[];
    avgRating?: string | null; reviewCount?: number;
  };
  const sorted = sortBy === 'rating'
    ? [...listings as ListingRaw[]].sort((a, b) => {
        const ra = parseFloat(a.avgRating || '0');
        const rb = parseFloat(b.avgRating || '0');
        return rb - ra;
      })
    : listings as ListingRaw[];

  // 地圖模式下有位置的房源
  const mapListings = sorted.filter(l => l.lat && l.lng);
  const handleMapSelect = useCallback((id: string) => setHighlightId(id), []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nomad-navy">{t('heroTitle')}</h1>
          {/* aria-live="polite" — 篩選結果更新時螢幕閱讀器播報計數（WCAG 4.1.3）*/}
          <p
            aria-live="polite"
            aria-atomic="true"
            className="text-gray-500 text-sm mt-0.5"
          >
            {loading
              ? t('searching')
              : t('resultsCount', { count: String(total || sorted.length) })}
            {activeCount > 0 && (
              <span className="ml-2 text-blue-600">· {t('activeFilters', { count: String(activeCount) })}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div role="group" aria-label={t('sortBy')} className="flex items-center bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${viewMode === 'grid' ? 'bg-white text-nomad-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              ☰ {t('viewAsList')}
            </button>
            <button
              onClick={() => setViewMode('map')}
              aria-pressed={viewMode === 'map'}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${viewMode === 'map' ? 'bg-white text-nomad-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              🗺 {t('viewOnMap')}
            </button>
          </div>
          {/* Sort */}
          <label htmlFor="listings-sort" className="sr-only">{t('sortBy')}</label>
          <select id="listings-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="newest">{t('sortNewest')}</option>
            <option value="price_asc">{t('sortPriceAsc')}</option>
            <option value="price_desc">{t('sortPriceDesc')}</option>
            <option value="wifi">{t('sortWifi')}</option>
            <option value="rating">{t('sortRating')}</option>
          </select>
          {/* Filter toggle (mobile) — opens bottom sheet */}
          <button
            onClick={() => setShowFilters(v => !v)}
            aria-expanded={showFilters}
            aria-controls="filter-sidebar"
            className={`lg:hidden flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-gray-200 text-gray-600'}`}>
            🔧 {t('filters')}{activeCount > 0 && <span aria-hidden="true" className="bg-blue-600 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">{activeCount}</span>}
            <span className="sr-only">{activeCount > 0 ? `(${activeCount} active)` : ''}</span>
          </button>
          {/* Desktop filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            aria-expanded={showFilters}
            aria-controls="filter-sidebar"
            className={`hidden lg:flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-gray-200 text-gray-600'}`}>
            🔧 {t('filters')}{activeCount > 0 && <span aria-hidden="true" className="bg-blue-600 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">{activeCount}</span>}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Mobile: Bottom Sheet Backdrop ── */}
        {showFilters && (
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setShowFilters(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Filter Sidebar (desktop) / Bottom Sheet (mobile) ── */}
        <aside
          id="filter-sidebar"
          aria-label={t('filters')}
          className={[
            /* ── Mobile: slide-up bottom sheet ── */
            'fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto',
            'bg-white rounded-t-3xl shadow-2xl',
            'transition-transform duration-300 ease-out',
            showFilters ? 'translate-y-0' : 'translate-y-full',
            /* ── Desktop: regular sticky sidebar ── */
            'lg:static lg:translate-y-0 lg:inset-auto lg:z-auto',
            'lg:bg-transparent lg:rounded-none lg:shadow-none',
            'lg:max-h-none lg:overflow-visible',
            'lg:w-64 lg:shrink-0',
            showFilters ? 'lg:block' : 'lg:hidden',
          ].join(' ')}
        >
          {/* Mobile drag handle + header */}
          <div className="lg:hidden sticky top-0 bg-white z-10 pt-3 pb-2 px-5 border-b border-gray-100 rounded-t-3xl">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" aria-hidden="true" />
            </div>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-base">
                {t('filters')}
                {activeCount > 0 && (
                  <span className="ml-2 bg-blue-600 text-white text-xs w-5 h-5 rounded-full inline-flex items-center justify-center font-bold">
                    {activeCount}
                  </span>
                )}
              </h2>
              <button
                onClick={() => setShowFilters(false)}
                aria-label="關閉篩選"
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-500 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none">
                ✕
              </button>
            </div>
          </div>

          <div className="card p-5 lg:sticky lg:top-20">
            <div className="hidden lg:flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">{t('filters')}</h2>
              {activeCount > 0 && (
                <button onClick={clearAll} className="text-xs text-blue-500 hover:underline">{t('clearAll')}</button>
              )}
            </div>

            <div className="space-y-5">
              {/* Keyword */}
              <div>
                <label htmlFor="filter-keyword" className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">{t('keyword')}</label>
                <input id="filter-keyword" value={qInput} onChange={e => handleQChange(e.target.value)}
                  placeholder={t('keywordPlaceholder')} className="input text-sm" />
              </div>

              {/* City */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">{t('city')}</label>
                <div role="group" aria-label={t('city')} className="flex flex-wrap gap-1.5">
                  <button onClick={() => setFilters(f => ({ ...f, city: '' }))}
                    aria-pressed={!filters.city}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${!filters.city ? 'bg-nomad-navy text-white border-nomad-navy' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                    {t('all')}
                  </button>
                  {cities.map(c => (
                    <button key={c} onClick={() => setFilters(f => ({ ...f, city: f.city === c ? '' : c }))}
                      aria-pressed={filters.city === c}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${filters.city === c ? 'bg-nomad-navy text-white border-nomad-navy' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">{t('type')}</label>
                <div role="group" aria-label={t('type')} className="flex flex-wrap gap-1.5">
                  <button onClick={() => setFilters(f => ({ ...f, type: '' }))}
                    aria-pressed={!filters.type}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${!filters.type ? 'bg-nomad-navy text-white border-nomad-navy' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                    {t('all')}
                  </button>
                  {types.map(tp => (
                    <button key={tp} onClick={() => setFilters(f => ({ ...f, type: f.type === tp ? '' : tp }))}
                      aria-pressed={filters.type === tp}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${filters.type === tp ? 'bg-nomad-navy text-white border-nomad-navy' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                      {tp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label id="filter-price-label" className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">{t('priceRangeNT')}</label>
                <div role="group" aria-labelledby="filter-price-label" className="flex items-center gap-2">
                  <input type="number" value={filters.minPrice}
                    aria-label={t('minPrice')}
                    onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))}
                    placeholder={t('minPrice')} className="input text-sm py-1.5 w-full" min="0" step="1000" />
                  <span aria-hidden="true" className="text-gray-400 shrink-0">—</span>
                  <input type="number" value={filters.maxPrice}
                    aria-label={t('maxPrice')}
                    onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))}
                    placeholder={t('maxPrice')} className="input text-sm py-1.5 w-full" min="0" step="1000" />
                </div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[
                    { labelKey: 'priceUnder10k', min: '',      max: '10000' },
                    { labelKey: 'price10to20k',  min: '10000', max: '20000' },
                    { labelKey: 'price20to30k',  min: '20000', max: '30000' },
                    { labelKey: 'priceOver30k',  min: '30000', max: '' },
                  ].map(p => (
                    <button key={p.labelKey}
                      onClick={() => setFilters(f => ({ ...f, minPrice: p.min, maxPrice: p.max }))}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${filters.minPrice === p.min && filters.maxPrice === p.max ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                      {t(p.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wi-Fi */}
              <div>
                <label htmlFor="filter-wifi-speed" className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">
                  {t('wifiSpeed')} {filters.minWifi ? <span className="text-blue-600 normal-case font-normal">≥ {filters.minWifi} Mbps</span> : ''}
                </label>
                <input id="filter-wifi-speed" type="range" min="0" max="500" step="10"
                  value={filters.minWifi || '0'}
                  aria-label={t('wifiSpeed')}
                  aria-valuetext={filters.minWifi ? `≥ ${filters.minWifi} Mbps` : t('noLimit')}
                  onChange={e => setFilters(f => ({ ...f, minWifi: e.target.value === '0' ? '' : e.target.value }))}
                  className="w-full accent-blue-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>{t('noLimit')}</span><span>100</span><span>300</span><span>500+</span>
                </div>
              </div>

              {/* Min rent */}
              <div>
                <label htmlFor="filter-min-rent" className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">{t('minStayLabel')}</label>
                <select id="filter-min-rent" value={filters.minRent} onChange={e => setFilters(f => ({ ...f, minRent: e.target.value }))} className="input text-sm py-1.5">
                  <option value="">{t('noLimit')}</option>
                  <option value="1">{t('minRentMonths', { n: '1' })}</option>
                  <option value="2">{t('minRentMonths', { n: '2' })}</option>
                  <option value="3">{t('minRentMonths', { n: '3' })}</option>
                </select>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase block">{t('specialNeeds')}</label>
                {[
                  { key: 'foreignOk', label: `🌍 ${t('foreignOk')}`, value: 'true' },
                  { key: 'hasDesk',   label: `🗂 ${t('hasDesk')}`,   value: 'true' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox"
                      checked={filters[opt.key as keyof typeof filters] === opt.value}
                      onChange={e => setFilters(f => ({ ...f, [opt.key]: e.target.checked ? opt.value : '' }))}
                      className="w-4 h-4 text-blue-600 rounded accent-blue-600" />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>

              {/* 捷運 & 共工距離 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="filter-near-mrt" className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">
                    🚇 {t('nearMRT')}
                    {filters.nearMRT && <span className="text-blue-600 normal-case font-normal ml-1">≤{filters.nearMRT}m</span>}
                  </label>
                  <select
                    id="filter-near-mrt"
                    aria-label={`🚇 ${t('nearMRT')}`}
                    value={filters.nearMRT}
                    onChange={e => setFilters(f => ({ ...f, nearMRT: e.target.value }))}
                    className="input text-sm py-1.5 w-full">
                    <option value="">{t('noLimit')}</option>
                    <option value="5">{t('withinMinutes', { n: '5' })}</option>
                    <option value="10">{t('withinMinutes', { n: '10' })}</option>
                    <option value="15">{t('withinMinutes', { n: '15' })}</option>
                    <option value="20">{t('withinMinutes', { n: '20' })}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="filter-near-cowork" className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">
                    💻 {t('nearCowork')}
                    {filters.nearCowork && <span className="text-blue-600 normal-case font-normal ml-1">≤{filters.nearCowork}m</span>}
                  </label>
                  <select
                    id="filter-near-cowork"
                    value={filters.nearCowork}
                    onChange={e => setFilters(f => ({ ...f, nearCowork: e.target.value }))}
                    className="input text-sm py-1.5 w-full">
                    <option value="">{t('noLimit')}</option>
                    <option value="5">{t('withinMinutes', { n: '5' })}</option>
                    <option value="10">{t('withinMinutes', { n: '10' })}</option>
                    <option value="15">{t('withinMinutes', { n: '15' })}</option>
                    <option value="20">{t('withinMinutes', { n: '20' })}</option>
                  </select>
                </div>
              </div>

              {/* Available By Date */}
              <div>
                <label
                  htmlFor="filter-available-by"
                  className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block"
                >
                  {t('availableBy')}
                  {filters.availableBy && (
                    <button
                      onClick={() => setFilters(f => ({ ...f, availableBy: '' }))}
                      className="ml-2 text-blue-500 normal-case font-normal hover:underline focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:outline-none rounded">
                      {t('clearDate')}
                    </button>
                  )}
                </label>
                <input
                  id="filter-available-by"
                  suppressHydrationWarning
                  type="date"
                  value={filters.availableBy}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setFilters(f => ({ ...f, availableBy: e.target.value }))}
                  aria-label={t('availableBy')}
                  className="input text-sm py-1.5 w-full"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {filters.availableBy
                    ? t('showAvailableBefore', { date: filters.availableBy })
                    : t('includeAvailableNow')}
                </p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {dateShortcuts.map(({ label, val }) => (
                    <button key={label}
                      onClick={() => setFilters(f => ({ ...f, availableBy: val }))}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        filters.availableBy === val
                          ? 'bg-teal-100 border-teal-400 text-teal-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {activeCount > 0 && (
                <button onClick={clearAll} className="w-full btn-secondary text-sm py-2">🗑 {t('clearAll')}</button>
              )}
              {/* 儲存搜尋條件 */}
              <button
                onClick={saveSearch}
                disabled={savingSearch || activeCount === 0}
                className="w-full flex items-center justify-center gap-1.5 text-sm py-2 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {searchSaved
                  ? `✅ ${t('searchSaved')}`
                  : savingSearch
                    ? t('saving')
                    : `🔔 ${t('saveSearch')}`}
              </button>

              {/* Mobile only: Apply / close button */}
              <button
                onClick={() => setShowFilters(false)}
                className="lg:hidden btn-primary w-full py-3 mt-2">
                ✓ 查看 {total} 個房源
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0">

          {/* ── MAP VIEW ── */}
          {viewMode === 'map' && (
            <div className="flex flex-col sm:flex-row gap-4 h-[calc(100vh-220px)] sm:h-[70vh]">

              {/* ── 手機切換 Tab（只在 sm 以下顯示） ── */}
              <div className="flex sm:hidden gap-1 bg-gray-100 p-1 rounded-xl mb-1 shrink-0">
                <button
                  onClick={() => setMobileMapPanel('map')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mobileMapPanel === 'map' ? 'bg-white text-nomad-navy shadow-sm' : 'text-gray-500'}`}
                >
                  🗺️ 地圖
                </button>
                <button
                  onClick={() => setMobileMapPanel('list')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mobileMapPanel === 'list' ? 'bg-white text-nomad-navy shadow-sm' : 'text-gray-500'}`}
                >
                  📋 列表 ({mapListings.length})
                </button>
              </div>

              {/* Map — 手機：只在 'map' panel 顯示；桌機：永遠顯示 */}
              <div className={`flex-1 rounded-2xl overflow-hidden shadow-sm border border-gray-200 ${mobileMapPanel === 'list' ? 'hidden sm:block' : 'block'}`} style={{ isolation: 'isolate', position: 'relative' }}>
                {loading ? (
                  <div className="flex items-center justify-center h-full bg-gray-100 text-gray-400">
                    <div className="text-center"><div className="text-3xl mb-2">🗺️</div>{t('mapLoading')}</div>
                  </div>
                ) : mapListings.length === 0 ? (
                  <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500 text-sm flex-col gap-2">
                    <div className="text-3xl">📍</div>
                    <div>{t('noMapListings')}</div>
                    <div className="text-xs text-gray-400">{t('mapListingsHint')}</div>
                  </div>
                ) : (
                  <ListingMap listings={mapListings} onSelect={handleMapSelect} highlightId={highlightId} />
                )}
              </div>

              {/* Side list — 手機：只在 'list' panel 顯示；桌機：永遠顯示 */}
              <div className={`w-full sm:w-72 shrink-0 overflow-y-auto space-y-3 pr-1 ${mobileMapPanel === 'map' ? 'hidden sm:block' : 'block'}`}>
                <p className="text-xs text-gray-400 px-1">
                  {t('mapCount', { count: String(mapListings.length) })}
                  {highlightId && (
                    <button onClick={() => setHighlightId(null)} className="ml-2 text-blue-500 hover:underline">
                      {t('deselect')}
                    </button>
                  )}
                </p>
                {mapListings.map(l => {
                  const isSelected = highlightId === l.id;
                  const imgs: string[] = Array.isArray(l.images)
                    ? l.images
                    : (() => { try { return JSON.parse(l.images as string); } catch { return []; } })();
                  return (
                    <div
                      key={l.id}
                      onClick={() => handleMapSelect(l.id)}
                      className={`card p-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-blue-500 shadow-lg bg-blue-50'
                          : 'hover:shadow-md hover:ring-1 hover:ring-gray-200'
                      }`}
                    >
                      {imgs[0] ? (
                        <div className="relative w-full h-24 rounded-xl overflow-hidden mb-2">
                          <Image src={imgs[0]} alt={l.title} fill sizes="288px" className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-full h-24 bg-gray-100 rounded-xl mb-2 flex items-center justify-center text-gray-300 text-2xl">🏠</div>
                      )}
                      <div className="font-semibold text-sm text-gray-800 line-clamp-2 leading-snug">{l.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{l.city}</div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-sm font-bold text-nomad-navy">
                          NT${l.price.toLocaleString()}
                          <span className="text-xs text-gray-400 font-normal">{t('perMonthShort')}</span>
                        </div>
                        <a
                          href={`/listings/${l.id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          {t('view')}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── GRID VIEW ── */}
          {viewMode === 'grid' && (
            loading ? (
              /* ✅ 統一使用 SkeletonGrid（符合 WCAG role="status" + aria-label） */
              <SkeletonGrid count={6} />
            ) : sorted.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">{t('noResults')}</h3>
                <p className="text-gray-400 text-sm mb-4">{t('noResultsHint')}</p>
                <button onClick={clearAll} className="btn-primary px-6">{t('clearFiltersViewAll')}</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {(sorted as unknown as Parameters<typeof ListingCard>[0]['listing'][]).map((l, idx) => (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      showFavorite={isLoggedIn}
                      initialFavorited={favoriteIds.has(l.id)}
                      priority={idx === 0}
                    />
                  ))}
                </div>
                {/* 分頁控制 */}
                {totalPages > 1 && (
                  <nav aria-label="Pagination" className="flex items-center justify-center gap-2 mt-8">
                    <button
                      onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={page <= 1}
                      aria-label={t('prevPage')}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none">
                      {t('prevPage')}
                    </button>
                    <ol className="flex gap-1 list-none m-0 p-0">
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 7) {
                          pageNum = i + 1;
                        } else if (page <= 4) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 3) {
                          pageNum = totalPages - 6 + i;
                        } else {
                          pageNum = page - 3 + i;
                        }
                        const isCurrent = pageNum === page;
                        return (
                          <li key={pageNum}>
                            <button
                              onClick={() => { setPage(pageNum); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              aria-current={isCurrent ? 'page' : undefined}
                              aria-label={`Page ${pageNum}`}
                              className={`w-9 h-9 rounded-xl text-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${isCurrent ? 'bg-nomad-navy text-white font-bold' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                              {pageNum}
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                    <button
                      onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={page >= totalPages}
                      aria-label={t('nextPage')}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none">
                      {t('nextPage')}
                    </button>
                  </nav>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
