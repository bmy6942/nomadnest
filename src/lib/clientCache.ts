/**
 * clientCache — 客戶端模組級快取（零依賴 SWR 替代方案）
 *
 * ─ 為何用模組變數而非 useState？
 *   React route 切換只是 unmount/remount 元件，但模組在瀏覽器 tab 生命週期內只
 *   初始化一次。因此模組級 Map 可以跨 route 切換保留快取，達到「返回頁面秒開」效果。
 *
 * ─ TTL 策略
 *   預設 30 秒。Dashboard 這類低頻更新的頁面，30 秒內重訪直接用快取，背景靜默刷新。
 *   高頻更新資料（如聊天訊息）可設更短 TTL 或直接跳過快取。
 *
 * ─ 快取失效
 *   呼叫 invalidate(key) 或 invalidatePrefix('dashboard') 後，下次 fetch 重新請求。
 */

interface CacheEntry<T> {
  data:    T;
  ts:      number;   // unix ms，用於 TTL 判斷
  stale:   boolean;  // 標記為 stale 但仍可使用（後台刷新期間）
}

// ── 全域單例快取 Map（模組初始化一次，跨 route 存活）──────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _store = new Map<string, CacheEntry<any>>();

/** 預設 TTL（毫秒）。過期資料立即重新請求。 */
const DEFAULT_TTL_MS = 30_000; // 30 秒

// ─────────────────────────────────────────────────────────────────────────────

/** 讀取快取（過期則回 null，呼叫端需重新 fetch）*/
export function getCached<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const entry = _store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) {
    _store.delete(key);
    return null;
  }
  return entry.data;
}

/** 寫入快取 */
export function setCached<T>(key: string, data: T): void {
  _store.set(key, { data, ts: Date.now(), stale: false });
}

/** 讀取快取（即使過期也回資料，但標記 stale，讓 UI 先顯示舊資料再背景刷新）*/
export function getCachedStale<T>(key: string, ttlMs = DEFAULT_TTL_MS): { data: T; stale: boolean } | null {
  const entry = _store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  const isStale = Date.now() - entry.ts > ttlMs;
  if (isStale) {
    // 標記但不刪除 — 讓 UI 繼續顯示舊資料
    entry.stale = true;
  }
  return { data: entry.data, stale: isStale };
}

/** 使指定 key 的快取失效（下次 fetch 強制重新請求）*/
export function invalidate(key: string): void {
  _store.delete(key);
}

/** 使所有以 prefix 開頭的 key 失效（如 'dashboard:' 開頭的所有快取）*/
export function invalidatePrefix(prefix: string): void {
  for (const key of _store.keys()) {
    if (key.startsWith(prefix)) _store.delete(key);
  }
}

/** 清空所有快取（登出時呼叫）*/
export function clearAll(): void {
  _store.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// useCachedFetch — 輕量 SWR 風格 Hook（stale-while-revalidate）
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';

interface UseCachedFetchResult<T> {
  data:       T | null;
  loading:    boolean;   // true = 第一次載入（無快取），顯示骨架屏
  reloading:  boolean;   // true = 背景刷新（有舊快取），不阻擋 UI
  error:      string;
  refetch:    () => void;
}

/**
 * useCachedFetch — 帶快取的 fetch hook
 *
 * 行為：
 *  1. 若快取存在（未過期）→ 立即回傳資料，loading=false（秒開）
 *  2. 若快取 stale → 先回傳舊資料（loading=false），後台刷新，刷新完再更新
 *  3. 若無快取 → loading=true，顯示骨架屏，fetch 回來後 loading=false
 */
export function useCachedFetch<T>(
  url: string,
  options?: {
    ttlMs?:       number;
    enabled?:     boolean;   // false = 暫不 fetch（用於條件性載入）
    onSuccess?:   (data: T) => void;
    transform?:   (raw: unknown) => T;
  }
): UseCachedFetchResult<T> {
  const { ttlMs = DEFAULT_TTL_MS, enabled = true, onSuccess, transform } = options ?? {};

  const [data,      setData]      = useState<T | null>(() => {
    const cached = getCachedStale<T>(url, ttlMs);
    return cached?.data ?? null;
  });
  const [loading,    setLoading]    = useState<boolean>(() => {
    return getCached<T>(url, ttlMs) === null;
  });
  const [reloading,  setReloading]  = useState(false);
  const [error,      setError]      = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = (isBackground: boolean) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    if (!isBackground) setLoading(true);
    else                setReloading(true);
    setError('');

    fetch(url, { signal: abortRef.current.signal })
      .then(r => {
        if (r.status === 401) {
          window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((raw: unknown) => {
        if (raw === null) return;
        const result = transform ? transform(raw) : (raw as T);
        setCached(url, result);
        setData(result);
        onSuccess?.(result);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('載入失敗，請重新整理頁面');
      })
      .finally(() => {
        setLoading(false);
        setReloading(false);
      });
  };

  useEffect(() => {
    if (!enabled) return;
    const cached = getCachedStale<T>(url, ttlMs);
    if (!cached) {
      // 完全無快取 → 顯示骨架屏並 fetch
      doFetch(false);
    } else if (cached.stale) {
      // 有舊快取 → 先秒顯示舊資料，後台靜默刷新
      setData(cached.data);
      setLoading(false);
      doFetch(true);
    } else {
      // 快取新鮮 → 直接使用，不發請求
      setData(cached.data);
      setLoading(false);
    }
    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

  return {
    data,
    loading,
    reloading,
    error,
    refetch: () => { invalidate(url); doFetch(false); },
  };
}
