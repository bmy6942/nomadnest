'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from '@/i18n/provider';
import type { QuickListing } from '@/app/api/search/route';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';

interface User { name: string; role: string; verificationStatus?: string; avatar?: string | null; }

// ── Static class constants (prevents hydration mismatch from stale webpack cache) ──
const LOGO_CLS    = 'flex items-center gap-2 shrink-0' as const;
const AVATAR_CLS  = 'relative w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0' as const;

const HISTORY_KEY = 'nomadnest_search_history';
const MAX_HISTORY = 5;

function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(q: string) {
  try {
    const prev = getHistory().filter(h => h !== q);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([q, ...prev].slice(0, MAX_HISTORY)));
  } catch { /* noop */ }
}
function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* noop */ }
}

// ── Global Search Bar ──────────────────────────────────────────────────────────

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ]                   = useState('');
  const [open, setOpen]             = useState(false);
  const [results, setResults]       = useState<QuickListing[]>([]);
  const [loading, setLoading]       = useState(false);
  const [history, setHistory]       = useState<string[]>([]);
  const [cursor, setCursor]         = useState(-1);  // keyboard nav index
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // load history on mount (client only)
  useEffect(() => { setHistory(getHistory()); }, []);

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // fetch quick results (debounced)
  const fetchResults = useCallback((query: string) => {
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`)
      .then(r => r.ok ? r.json() : { listings: [] })
      .then(d => { setResults(d.listings || []); setLoading(false); })
      .catch(() => { setResults([]); setLoading(false); });
  }, []);

  const handleChange = (val: string) => {
    setQ(val);
    setCursor(-1);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(val), 300);
  };

  const handleSubmit = (query: string = q) => {
    if (!query.trim()) return;
    saveHistory(query.trim());
    setHistory(getHistory());
    setOpen(false);
    setQ('');
    router.push(`/listings?q=${encodeURIComponent(query.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const items = q.trim() ? results : history;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cursor >= 0 && q.trim() && results[cursor]) {
        // Navigate to listing page
        saveHistory(q.trim());
        setHistory(getHistory());
        setOpen(false);
        setQ('');
        router.push(`/listings/${results[cursor].id}`);
      } else if (cursor >= 0 && !q.trim() && history[cursor]) {
        handleSubmit(history[cursor]);
      } else {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const displayItems = q.trim() ? results : history;
  const showDropdown = open && (displayItems.length > 0 || (q.trim() && !loading));

  return (
    <div ref={containerRef} className="relative hidden md:block">
      {/* Input */}
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="搜尋房源 / Search listings"
          aria-expanded={!!showDropdown}
          aria-autocomplete="list"
          aria-controls="global-search-listbox"
          value={q}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { setOpen(true); setHistory(getHistory()); }}
          onKeyDown={handleKeyDown}
          placeholder="搜尋房源…"
          className="w-44 focus:w-56 pl-8 pr-7 py-1.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-200"
          autoComplete="off"
        />
        {q && (
          <button
            onClick={() => { setQ(''); setResults([]); setOpen(false); inputRef.current?.focus(); }}
            aria-label="清除搜尋 / Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            tabIndex={-1}>
            <span aria-hidden="true">✕</span>
          </button>
        )}
        {loading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-spin">⟳</span>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div id="global-search-listbox" role="listbox" aria-label="Search suggestions" className="absolute top-full left-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-[9999] overflow-hidden">

          {/* History (shown when q is empty) */}
          {!q.trim() && history.length > 0 && (
            <>
              <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">最近搜尋</span>
                <button
                  onClick={() => { clearHistory(); setHistory([]); }}
                  aria-label="清除搜尋紀錄 / Clear search history"
                  className="text-xs text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
                  <span aria-hidden="true">清除</span>
                </button>
              </div>
              {history.map((h, i) => (
                <button
                  key={h}
                  onClick={() => handleSubmit(h)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition-colors ${cursor === i ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                  <span className="text-gray-400 text-xs">🕐</span>
                  <span className="truncate">{h}</span>
                </button>
              ))}
              <div className="border-t border-gray-100 my-1" />
            </>
          )}

          {/* Results (shown when q is not empty) */}
          {q.trim() && results.length === 0 && !loading && (
            <div className="px-4 py-6 text-center">
              <div className="text-2xl mb-1">🔍</div>
              <p className="text-sm text-gray-500">找不到「{q}」的相關房源</p>
              <button
                onClick={() => handleSubmit()}
                className="mt-2 text-xs text-blue-600 hover:underline">
                搜尋全部房源
              </button>
            </div>
          )}

          {q.trim() && results.map((l, i) => (
            <button
              key={l.id}
              onClick={() => {
                saveHistory(q.trim());
                setHistory(getHistory());
                setOpen(false);
                setQ('');
                router.push(`/listings/${l.id}`);
              }}
              className={`w-full text-left flex items-center gap-3 px-3 py-2 transition-colors ${cursor === i ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              {/* Thumbnail */}
              <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                {l.image
                  ? <Image src={l.image} alt={l.title} fill sizes="40px" className="object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-300">🏠</div>
                }
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-sm text-gray-900 font-medium truncate">{l.title}</p>
                  {l.ownerVerified && <span className="text-blue-500 text-xs shrink-0">✓</span>}
                </div>
                <p className="text-xs text-gray-400 truncate">{l.city}{l.district} · {l.type}</p>
              </div>
              {/* Price */}
              <div className="text-sm font-bold text-nomad-navy shrink-0">
                NT${l.price.toLocaleString()}
              </div>
            </button>
          ))}

          {/* Footer: full search link */}
          {q.trim() && results.length > 0 && (
            <button
              onClick={() => handleSubmit()}
              className="w-full text-center text-xs text-blue-600 hover:bg-blue-50 py-2.5 border-t border-gray-100 transition-colors">
              查看所有「{q}」的房源 →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Navbar ────────────────────────────────────────────────────────────────

export default function Navbar() {
  const t = useTranslations('nav');
  const [user, setUser]         = useState<User | null>(null);
  const [open, setOpen]         = useState(false);
  const [unread, setUnread]     = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const initializedRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  // ① 初始化：僅在第一次載入或登入/登出後執行
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const newUser = d?.user ?? null;
        setUser(newUser);
        initializedRef.current = true;
      })
      .catch(() => { initializedRef.current = true; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ② 從 auth 頁面返回後重新確認身份
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    const wasOnAuth = prevPathRef.current?.startsWith('/auth');
    prevPathRef.current = pathname;
    if (wasOnAuth && !pathname.startsWith('/auth')) {
      fetch('/api/auth/me')
        .then(r => r.ok ? r.json() : null)
        .then(d => setUser(d?.user ?? null))
        .catch(() => {});
    }
  }, [pathname]);

  // ③ 未讀訊息 & 通知（每30秒輪詢）
  useEffect(() => {
    if (!user) { setUnread(0); setNotifCount(0); return; }
    const fetchStatus = () => {
      fetch('/api/status')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) { setUnread(d.unreadMessages ?? 0); setNotifCount(d.unreadNotifications ?? 0); } })
        .catch(() => {});
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setUnread(0);
    setNotifCount(0);
    router.push('/');
    router.refresh();
  };

  const isEmailPending = user?.verificationStatus === 'emailPending';

  return (
    <>
    {/* Email 驗證提示橫幅 */}
    {isEmailPending && !pathname.startsWith('/auth') && (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center">
        <span className="text-sm text-amber-800">
          📬 {t('verifyEmailBanner')}
          <Link href="/auth/verify-email" className="font-semibold underline ml-1 hover:text-amber-900">{t('resendVerification')}</Link>
        </span>
      </div>
    )}
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">

        {/* Logo */}
        <Link href="/" className={LOGO_CLS}>
          <span className="text-2xl">🏡</span>
          <div>
            <span className="font-bold text-nomad-navy text-lg">NomadNest</span>
            <span className="text-xs text-gray-400 block -mt-1">Taiwan Beta</span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-5 ml-1">
          <Link href="/listings" aria-current={pathname.startsWith('/listings') ? 'page' : undefined} className="text-gray-600 hover:text-blue-600 font-medium text-sm whitespace-nowrap">{t('browse')}</Link>
          {/* 未登入 或 tenant 身份 → 顯示招商連結 */}
          {(!user || user.role === 'tenant') && (
            <Link href="/for-landlords" aria-current={pathname.startsWith('/for-landlords') ? 'page' : undefined} className="text-gray-600 hover:text-blue-600 font-medium text-sm whitespace-nowrap">🏠 房東出租</Link>
          )}
          {(user?.role === 'landlord' || user?.role === 'admin') && (
            <Link href="/submit" aria-current={pathname.startsWith('/submit') ? 'page' : undefined} className="text-gray-600 hover:text-blue-600 font-medium text-sm whitespace-nowrap">{t('listYourPlace')}</Link>
          )}
          {user?.role === 'admin' && (
            <Link href="/admin" aria-current={pathname.startsWith('/admin') ? 'page' : undefined} className="text-orange-600 hover:text-orange-700 font-medium text-sm whitespace-nowrap">⚙ {t('adminPanel')}</Link>
          )}
        </div>

        {/* ── Global Search Bar ── */}
        <div className="flex-1" />
        <GlobalSearch />

        {/* 語系切換 */}
        <LanguageSwitcher className="hidden md:flex" />

        {/* 亮/暗色模式切換 */}
        <ThemeToggle className="hidden md:flex" />

        {/* Right side icons */}
        <div className="flex items-center gap-1">
          {user && (<>
            {/* 通知鈴鐺 */}
            <Link
              href="/notifications"
              aria-label={notifCount > 0 ? `通知中心（${notifCount} 則未讀）/ Notifications (${notifCount} unread)` : '通知中心 / Notifications'}
              aria-current={pathname.startsWith('/notifications') ? 'page' : undefined}
              className="relative p-2 text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
              <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifCount > 0 && (
                <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </Link>
            {/* 訊息 */}
            <Link
              href="/messages"
              aria-label={unread > 0 ? `訊息中心（${unread} 則未讀）/ Messages (${unread} unread)` : '訊息中心 / Messages'}
              aria-current={pathname.startsWith('/messages') ? 'page' : undefined}
              className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {unread > 0 && (
                <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          </>)}

          {user ? (
            <div className="relative ml-1">
              <button
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={`${user.name} — 帳號選單 / account menu`}
                className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <span className={AVATAR_CLS}>
                  {user.avatar
                    ? <Image src={user.avatar} alt="" aria-hidden={true} fill sizes="32px" className="object-cover" />
                    : <span aria-hidden="true" className="w-full h-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">{user.name[0]}</span>
                  }
                </span>
                <span className="hidden sm:inline max-w-[100px] truncate" aria-hidden="true">{user.name}</span>
                <svg className="w-4 h-4 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {open && (
                <div role="menu" aria-label={`${user.name}`} className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                  <Link role="menuitem" href="/dashboard"      onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50">📊 {t('myDashboard')}</Link>
                  <Link role="menuitem" href="/notifications"  onClick={() => setOpen(false)} className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50">
                    <span>🔔 {t('notifCenter')}</span>
                    {notifCount > 0 && <span aria-hidden="true" className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">{notifCount}</span>}
                  </Link>
                  <Link role="menuitem" href="/messages"       onClick={() => setOpen(false)} className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50">
                    <span>💬 {t('msgCenter')}</span>
                    {unread > 0 && <span aria-hidden="true" className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{unread}</span>}
                  </Link>
                  <Link role="menuitem" href="/profile"        onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50">👤 {t('myProfile')}</Link>
                  <Link role="menuitem" href="/favorites"      onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50">❤️ {t('myFavorites')}</Link>
                  {(user.role === 'landlord' || user.role === 'admin') && (<>
                    <Link role="menuitem" href="/submit"       onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50">➕ {t('submitListing')}</Link>
                    <Link role="menuitem" href="/applications" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50">📋 {t('appsMgmt')}</Link>
                    <Link role="menuitem" href="/analytics"    onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50">📊 {t('listingAnalytics')}</Link>
                  </>)}
                  {user.role === 'admin' && (
                    <Link role="menuitem" href="/admin"        onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 focus-visible:outline-none focus-visible:bg-orange-50">⚙ {t('adminPanel')}</Link>
                  )}
                  <hr className="my-1 border-gray-100" />
                  <button role="menuitem" onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:bg-red-50">{t('logout')}</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-1">
              <Link href="/auth/login"    className="btn-secondary text-sm py-2">{t('login')}</Link>
              <Link href="/auth/register" className="btn-primary  text-sm py-2">{t('register')}</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
    </>
  );
}
