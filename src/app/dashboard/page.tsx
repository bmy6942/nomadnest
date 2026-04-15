'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { formatPrice, wifiLabel } from '@/lib/utils';
import { DashboardSkeleton, SkeletonStats, SkeletonTabContent } from '@/components/SkeletonCard';
import { getCachedStale, setCached, invalidate } from '@/lib/clientCache';

// ── 模組級快取 key 常數 ──────────────────────────────────────────────────────
const CACHE_DASHBOARD    = '/api/dashboard';
const CACHE_FAVORITES    = '/api/favorites';
const CACHE_VIEWINGS     = '/api/viewings';
const CACHE_RECENT       = '/api/listings/recent';
const CACHE_SAVED        = '/api/saved-searches';
const CACHE_CONTRACTS    = '/api/contracts';

// ── 移出 render 的靜態查表常數（消除每次 re-render 重建）──────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-600',
};
const STATUS_LABELS: Record<string, string> = {
  pending:   '⏳ 待審核', approved: '✅ 已接受',
  rejected:  '❌ 已婉拒', withdrawn: '↩ 已撤回',
};
const LISTING_STATUS_COLORS: Record<string, string> = {
  active:   'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',    inactive: 'bg-gray-100 text-gray-600',
};
const LISTING_STATUS_LABELS: Record<string, string> = {
  active: '✅ 上架中', pending: '⏳ 待審核', rejected: '❌ 未通過', inactive: '⏸ 已下架',
};

type MyReview = {
  id: string; rating: number; wifiRating: number; content: string;
  ownerReply: string | null; createdAt: string;
  listing: { id: string; title: string; city: string; district: string; images: string[] };
};

type MyListing = {
  id: string; title: string; city: string; district: string; type: string;
  price: number; wifiSpeed: number; images: string[]; status: string;
  avgRating: string | null;
  applications: { id: string }[];
};

type MyApplication = {
  id: string; status: string; moveInDate: string; duration: number;
  createdAt: string; landlordReply?: string | null;
  listing: {
    id: string; title: string; city: string; district: string;
    price: number; images: string[];
    owner: { name: string; phone?: string | null; lineId?: string | null };
  };
};

type IncomingApplication = {
  id: string; status: string; message: string; moveInDate: string;
  duration: number; createdAt: string; landlordReply?: string | null;
  listing: { id: string; title: string };
  tenant: { id: string; name: string; email: string; verified: boolean; phone?: string | null; lineId?: string | null };
};

type DashboardData = {
  user: { name: string; email: string; role: string; verified: boolean; verificationStatus: string };
  myListings: MyListing[];
  myApplications: MyApplication[];
  incomingApplications: IncomingApplication[];
  myReviews: MyReview[];
};

type FavoriteListing = {
  id: string; listingId: string;
  listing: { id: string; title: string; city: string; district: string; type: string; price: number; wifiSpeed: number; images: string[]; status: string };
};

type RecentListing = {
  id: string; title: string; city: string; district: string; type: string;
  price: number; wifiSpeed: number; images: string[]; avgRating: string | null;
  reviewCount: number; lastViewedAt: string;
};

type ViewingRequest = {
  id: string; status: string; notes?: string | null;
  proposedTime1: string; proposedTime2?: string | null; proposedTime3?: string | null;
  confirmedTime?: string | null;
  createdAt: string;
  listing: { id: string; title: string; city: string; district: string; images: string[] };
  tenant: { id: string; name: string; phone?: string | null; lineId?: string | null };
};

type SavedSearch = {
  id: string; name: string; city?: string; type?: string;
  maxPrice?: number; minWifi?: number; q?: string; createdAt: string;
  lastSentAt?: string | null;
};

export default function DashboardPage() {
  // ── 初始化時先嘗試從快取讀取，有快取則跳過骨架屏「秒開」──────────────────
  const [data, setData] = useState<DashboardData | null>(() => {
    const cached = getCachedStale<DashboardData>(CACHE_DASHBOARD);
    return cached?.data ?? null;
  });
  const [tab, setTab] = useState<'listings' | 'applications' | 'incoming' | 'favorites' | 'viewings' | 'recent' | 'stats' | 'saved' | 'reviews' | 'contracts'>('applications');
  // loading=true 只在無任何快取時顯示骨架屏；有快取時直接秒開
  const [loading, setLoading] = useState(() => getCachedStale<DashboardData>(CACHE_DASHBOARD) === null);
  const [favorites, setFavorites] = useState<FavoriteListing[]>(() => {
    const c = getCachedStale<{ favorites: FavoriteListing[] }>(CACHE_FAVORITES);
    return c?.data?.favorites ?? [];
  });
  const [viewings, setViewings] = useState<ViewingRequest[]>(() => {
    const c = getCachedStale<ViewingRequest[]>(CACHE_VIEWINGS);
    return c?.data ?? [];
  });
  const [recentListings, setRecentListings] = useState<RecentListing[]>(() => {
    const c = getCachedStale<RecentListing[]>(CACHE_RECENT);
    return c?.data ?? [];
  });
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => {
    const c = getCachedStale<{ searches: SavedSearch[] }>(CACHE_SAVED);
    return c?.data?.searches ?? [];
  });
  const [testingNotify, setTestingNotify] = useState<string | null>(null); // 正在測試通知的搜尋 id

  // 合約
  type ContractSummary = {
    id: string; status: string; rentAmount: number; startDate: string; endDate: string;
    landlordId: string; tenantId: string;
    landlordSignedAt: string | null; tenantSignedAt: string | null;
    createdAt: string;
    application: {
      listing: { id: string; title: string; city: string; district: string; images: string[] };
      tenant:  { id: string; name: string; email: string };
    };
  };
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  // 全域錯誤狀態
  const [fetchError, setFetchError] = useState('');       // 主資料載入失敗
  const [actionError, setActionError] = useState('');     // 申請/房源操作失敗
  const [viewingError, setViewingError] = useState('');   // 看房操作失敗
  // Email 驗證提示橫幅
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false);
  const [sendingVerify, setSendingVerify] = useState(false);
  const [sentVerify, setSentVerify] = useState(false);
  // 房東回覆申請用的 state
  const [replyingAppId, setReplyingAppId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  type LandlordStats = {
    overview: {
      totalViews7d: number; totalViews30d: number; totalFavorites: number;
      totalApps: number; totalApproved: number; activeListings: number;
      pendingApplications: number; estimatedMonthlyRevenue: number;
      overallConvRate: string;
    };
    trend: { days: string[]; views: number[] };
    topListings: string[];
    listings: {
      id: string; title: string; status: string; price: number;
      city: string; district: string; images: string[];
      views7d: number; views30d: number; viewsAll: number; viewsTrend: number[];
      appsTotal: number; appsPending: number; appsApproved: number;
      appsRejected: number; appsWithdrawn: number;
      convRate: string; favoritesCount: number;
      avgRating: string | null; avgWifi: string | null; reviewCount: number;
      avgResponseHours: number | null; perfScore: number;
    }[];
  };
  const [landlordStats, setLandlordStats] = useState<LandlordStats | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmTime, setConfirmTime] = useState('');

  useEffect(() => {
    // ✅ 先確認 onboardingCompleted — 新用戶尚未完成引導時導向 /onboarding
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.user) { window.location.href = '/auth/login'; return; }
        if (d.user.onboardingCompleted === false) {
          window.location.href = '/onboarding';
        }
      })
      .catch(() => {});
    // （不 block 主資料請求，平行進行）

    // ── 主資料：有快取 → 先秒顯示，再背景刷新；無快取 → 顯示骨架屏 ──────────
    const hasCachedDashboard = getCachedStale<DashboardData>(CACHE_DASHBOARD) !== null;

    const fetchMain = fetch('/api/dashboard')
      .then(r => {
        if (r.status === 401) { window.location.href = '/auth/login'; return null; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: DashboardData | null) => {
        if (!d) return;
        setCached(CACHE_DASHBOARD, d);
        setData(d);
        if (!data) {  // 第一次才設定 tab（有快取時維持用戶目前所在 tab）
          setTab(d.user.role === 'landlord' || d.user.role === 'admin' ? 'listings' : 'applications');
        }
        setLoading(false);
      })
      .catch(() => {
        setFetchError('載入失敗，請重新整理頁面');
        setLoading(false);
      });

    // ── 次要資料：Promise.all 並行請求（不阻擋主資料骨架屏消失）────────────
    // 各自有快取時立即用快取，快取 stale 才重新 fetch
    const fetchSecondary = () => {
      const promises: Promise<void>[] = [];

      if (getCachedStale<unknown>(CACHE_FAVORITES) === null || getCachedStale<unknown>(CACHE_FAVORITES)?.stale) {
        promises.push(
          fetch('/api/favorites').then(r => r.ok ? r.json() : null).then(d => {
            if (d?.favorites) { setCached(CACHE_FAVORITES, d); setFavorites(d.favorites); }
          }).catch(() => {})
        );
      }
      if (getCachedStale<unknown>(CACHE_VIEWINGS) === null || getCachedStale<unknown>(CACHE_VIEWINGS)?.stale) {
        promises.push(
          fetch('/api/viewings').then(r => r.ok ? r.json() : []).then(d => {
            if (Array.isArray(d)) { setCached(CACHE_VIEWINGS, d); setViewings(d); }
          }).catch(() => {})
        );
      }
      if (getCachedStale<unknown>(CACHE_RECENT) === null || getCachedStale<unknown>(CACHE_RECENT)?.stale) {
        promises.push(
          fetch('/api/listings/recent').then(r => r.ok ? r.json() : []).then(d => {
            if (Array.isArray(d)) { setCached(CACHE_RECENT, d); setRecentListings(d); }
          }).catch(() => {})
        );
      }
      if (getCachedStale<unknown>(CACHE_SAVED) === null || getCachedStale<unknown>(CACHE_SAVED)?.stale) {
        promises.push(
          fetch('/api/saved-searches').then(r => r.ok ? r.json() : { searches: [] }).then(d => {
            if (d?.searches) { setCached(CACHE_SAVED, d); setSavedSearches(d.searches); }
          }).catch(() => {})
        );
      }
      if (getCachedStale<unknown>(CACHE_CONTRACTS) === null || getCachedStale<unknown>(CACHE_CONTRACTS)?.stale) {
        promises.push(
          fetch('/api/contracts').then(r => r.ok ? r.json() : { contracts: [] }).then(d => {
            if (d?.contracts) { setCached(CACHE_CONTRACTS, d); setContracts(d.contracts); }
          }).catch(() => {})
        );
      }
      return Promise.all(promises);
    };

    if (hasCachedDashboard) {
      // 有快取 → 骨架屏已跳過，主資料靜默刷新；次要資料並行刷新
      setLoading(false);
      fetchSecondary();
      // 主資料背景刷新（不阻擋 UI）
    } else {
      // 無快取 → 主資料顯示骨架屏，同時並行預取次要資料
      fetchSecondary();
    }

    void fetchMain;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stats Tab：懶載入 + 骨架屏（切到 tab 時才 fetch，有快取秒開）────────────
  const [statsLoading, setStatsLoading] = useState(false);
  const CACHE_STATS = '/api/landlord/stats';
  useEffect(() => {
    if (tab !== 'stats') return;
    const cached = getCachedStale<LandlordStats>(CACHE_STATS);
    if (cached) { setLandlordStats(cached.data); return; }
    setStatsLoading(true);
    fetch('/api/landlord/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setCached(CACHE_STATS, d); setLandlordStats(d); }
      })
      .finally(() => setStatsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const resendVerifyEmail = async () => {
    if (!data) return;
    setSendingVerify(true);
    await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.user.email }),
    });
    setSendingVerify(false);
    setSentVerify(true);
    setTimeout(() => setSentVerify(false), 8000);
  };

  const removeFavorite = async (listingId: string) => {
    await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId }),
    });
    setFavorites(prev => prev.filter(f => f.listing.id !== listingId));
  };

  const updateViewing = async (id: string, status: string, confirmedTime?: string) => {
    setViewingError('');
    // ✅ 確認看房時，confirmedTime 不得為空且須為未來時間；改用 inline error state 取代 alert()
    if (status === 'confirmed') {
      if (!confirmedTime) { setViewingError('請選擇確認的看房時間'); return; }
      if (new Date(confirmedTime) <= new Date()) { setViewingError('確認時間必須是未來的時間點'); return; }
    }
    const res = await fetch(`/api/viewings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, confirmedTime }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setViewingError(d.error || '操作失敗，請稍後再試');
      return;
    }
    const updated = await fetch('/api/viewings').then(r => r.ok ? r.json() : []);
    if (Array.isArray(updated)) setViewings(updated);
    setConfirmingId(null);
    setConfirmTime('');
  };

  const updateApp = async (id: string, status: string, reply?: string) => {
    setActionError('');
    const patchRes = await fetch('/api/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, ...(reply !== undefined ? { landlordReply: reply } : {}) }),
    });
    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => ({})) as { error?: string };
      setActionError(err.error || '操作失敗，請稍後再試');
      return;
    }
    // ✅ 寫入操作後 invalidate 快取，確保下次進入時取得最新資料
    invalidate(CACHE_DASHBOARD);
    const res = await fetch('/api/dashboard');
    if (res.ok) {
      const d = await res.json().catch(() => null) as DashboardData | null;
      if (d) { setCached(CACHE_DASHBOARD, d); setData(d); }
    }
    setReplyingAppId(null);
    setReplyText('');
  };

  const saveReply = async (id: string) => {
    setActionError('');
    const patchRes = await fetch('/api/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, landlordReply: replyText }),
    });
    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => ({})) as { error?: string };
      setActionError(err.error || '回覆儲存失敗，請稍後再試');
      return;
    }
    invalidate(CACHE_DASHBOARD);
    const res = await fetch('/api/dashboard');
    if (res.ok) {
      const d = await res.json().catch(() => null) as DashboardData | null;
      if (d) { setCached(CACHE_DASHBOARD, d); setData(d); }
    }
    setReplyingAppId(null);
    setReplyText('');
  };

  const [rentedConfirmId, setRentedConfirmId] = useState<string | null>(null);
  const markAsRented = async (listingId: string) => {
    setActionError('');
    const patchRes = await fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'inactive' }),
    });
    setRentedConfirmId(null);
    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => ({})) as { error?: string };
      setActionError(err.error || '標記失敗，請稍後再試');
      return;
    }
    invalidate(CACHE_DASHBOARD);
    const res = await fetch('/api/dashboard');
    if (res.ok) {
      const d = await res.json().catch(() => null) as DashboardData | null;
      if (d) { setCached(CACHE_DASHBOARD, d); setData(d); }
    }
  };

  const deleteSavedSearch = async (id: string) => {
    await fetch('/api/saved-searches', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setSavedSearches(prev => prev.filter(s => s.id !== id));
  };

  const testSavedSearchNotify = async (id: string) => {
    setTestingNotify(id);
    try {
      const res = await fetch(`/api/cron/saved-search-notify?secret=${encodeURIComponent(process.env.NEXT_PUBLIC_CRON_SECRET || 'dev')}`);
      const d = await res.json();
      if (d.notified > 0) {
        alert(`✅ 測試通知已寄出！共有 ${d.notified} 筆搜尋符合條件並寄出 Email。`);
      } else {
        alert(`ℹ️ Cron 執行完成，但沒有找到符合條件的新房源（notified: ${d.notified}）。`);
      }
    } catch {
      alert('❌ 測試失敗，請確認開發伺服器正在運行。');
    } finally {
      setTestingNotify(null);
    }
  };

  // ── useMemo 必須在所有 early return 之前呼叫，以符合 Rules of Hooks ──────────
  // ✅ 當 data 為 null（載入中或錯誤）時，用空陣列作預設值，hook 數量保持一致
  const stats = useMemo(() => ({
    activeListings:      (data?.myListings ?? []).filter(l => l.status === 'active').length,
    pendingApplications: (data?.incomingApplications ?? []).filter(a => a.status === 'pending').length,
  }), [data]);

  // ✅ 骨架屏取代全頁 spinner：用戶點擊後「秒切」到 Dashboard 結構，資料進來再填充
  if (loading) return <DashboardSkeleton />;
  // ✅ 主資料載入失敗 — 顯示友善錯誤提示
  if (fetchError) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-red-500 font-medium mb-3">{fetchError}</p>
        <button onClick={() => window.location.reload()} className="btn-secondary text-sm px-4 py-2">重新整理</button>
      </div>
    </div>
  );
  if (!data) return null;

  // ✅ 已移至模組頂層常數（STATUS_COLORS / STATUS_LABELS / LISTING_STATUS_COLORS / LISTING_STATUS_LABELS）
  // 消除每次 re-render 重建四個 Record 物件的開銷

  // ✅ 移除舊有 `as Record<string, unknown>[]` 強制轉換，使用正確類型定義
  const myListings          = data.myListings;
  const myApplications      = data.myApplications;
  const incomingApplications = data.incomingApplications;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-nomad-navy">我的控制台</h1>
          <p className="text-gray-500 text-sm mt-1">歡迎回來，{data.user.name} 👋</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`badge ${data.user.verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {data.user.verified ? '✓ 已驗證' : '⚠ 未驗證'}
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
            {data.user.role === 'landlord' ? '🏠 房東' : data.user.role === 'admin' ? '⚙ 管理員' : '🧳 房客'}
          </span>
          {(data.user.role === 'landlord' || data.user.role === 'admin') && (
            <Link href="/submit" className="btn-primary">+ 刊登房源</Link>
          )}
        </div>
      </div>

      {/* ── 操作錯誤橫幅（申請/房源/回覆） ── */}
      {actionError && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">{actionError}</p>
          <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">✕</button>
        </div>
      )}

      {/* ── Email 未驗證橫幅 ── */}
      {data.user.verificationStatus === 'emailPending' && !emailBannerDismissed && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="text-2xl shrink-0">📬</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">請驗證你的 Email 信箱</p>
            <p className="text-xs text-amber-700 mt-0.5">
              已寄送驗證連結至 <strong>{data.user.email}</strong>。驗證後可提升帳號信任度，並解鎖完整功能。
            </p>
            {sentVerify && (
              <p className="text-xs text-green-700 mt-1 font-medium">✅ 驗證信已重新寄出！請查看信箱（含垃圾郵件匣）</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!sentVerify && (
              <button
                onClick={resendVerifyEmail}
                disabled={sendingVerify}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
                {sendingVerify ? '寄送中...' : '📧 重寄驗證信'}
              </button>
            )}
            <button
              onClick={() => setEmailBannerDismissed(true)}
              className="text-amber-500 hover:text-amber-700 text-lg leading-none"
              title="關閉提示">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: '我的房源', value: myListings.length, icon: '🏠' },
          { label: '上架中', value: stats.activeListings, icon: '✅' },
          { label: '我的申請', value: myApplications.length, icon: '📩' },
          { label: '待審申請', value: stats.pendingApplications, icon: '⏳' },
        ].map(s => (
          <div key={s.label} className="card p-5 text-center">
            <div className="text-3xl mb-2">{s.icon}</div>
            <div className="text-2xl font-bold text-nomad-navy">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {[
          (data.user.role !== 'tenant') && { key: 'listings', label: `我的房源 (${myListings.length})` },
          (data.user.role !== 'tenant') && { key: 'stats', label: `📊 數據分析` },
          { key: 'applications', label: `我的申請 (${myApplications.length})` },
          (data.user.role !== 'tenant') && { key: 'incoming', label: `收到的申請 (${incomingApplications.length})` },
          { key: 'viewings', label: `📅 看房預約 (${viewings.length})` },
          data.user.role === 'tenant' && { key: 'favorites', label: `❤ 已收藏 (${favorites.length})` },
          data.user.role === 'tenant' && { key: 'recent', label: `👁 最近瀏覽 (${recentListings.length})` },
          data.user.role === 'tenant' && { key: 'saved', label: `🔔 儲存搜尋 (${savedSearches.length})` },
          data.user.role === 'tenant' && { key: 'reviews', label: `⭐ 我的評價 (${(data.myReviews ?? []).length})` },
          contracts.length > 0 && { key: 'contracts', label: `📋 合約 (${contracts.length})` },
        ].filter(Boolean).map((t) => {
          const tab_ = t as { key: string; label: string };
          return (
            <button key={tab_.key} onClick={() => setTab(tab_.key as typeof tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === tab_.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab_.label}
            </button>
          );
        })}
      </div>

      {/* My Listings */}
      {tab === 'listings' && (
        <div className="space-y-4">
          {myListings.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">🏠</div>
              <h3 className="font-semibold text-gray-700 mb-2">尚未刊登任何房源</h3>
              <Link href="/submit" className="btn-primary">立即刊登第一則房源</Link>
            </div>
          ) : myListings.map((l) => {
            const wifi = wifiLabel(l.wifiSpeed);
            return (
              <div key={l.id} className="card p-5 flex gap-4">
                <div className="w-24 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                  {l.images[0] && <img src={l.images[0]} alt="" loading="lazy" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/listings/${l.id}`} className="font-semibold text-gray-900 hover:text-blue-600 text-sm leading-snug line-clamp-1">{l.title}</Link>
                    <span className={`badge shrink-0 ${LISTING_STATUS_COLORS[l.status]}`}>{LISTING_STATUS_LABELS[l.status]}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{l.city} {l.district} · {l.type}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-blue-600 font-bold text-sm">{formatPrice(l.price)}/月</span>
                    <span className={`text-xs ${wifi.color} px-2 py-0.5 rounded-full border`}>{wifi.emoji} {l.wifiSpeed}Mbps</span>
                    <span className="text-xs text-gray-500">{l.applications.length} 則申請</span>
                    <div className="flex items-center gap-2 ml-auto">
                      {/* ✅ 改用 inline 確認取代 confirm()，避免阻塞 UI */}
                    {l.status === 'active' && rentedConfirmId !== l.id && (
                        <button
                          onClick={() => setRentedConfirmId(l.id)}
                          className="text-xs text-orange-500 hover:text-orange-700 border border-orange-200 hover:bg-orange-50 px-2 py-0.5 rounded-lg transition-colors">
                          🏷 標記已租出
                        </button>
                      )}
                    {l.status === 'active' && rentedConfirmId === l.id && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-orange-700">確定下架？</span>
                          <button onClick={() => markAsRented(l.id)} className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 py-0.5 rounded-lg transition-colors">確定</button>
                          <button onClick={() => setRentedConfirmId(null)} className="text-xs text-gray-500 hover:text-gray-700 border px-2 py-0.5 rounded-lg transition-colors">取消</button>
                        </div>
                      )}
                      <Link href={`/listings/${l.id}/edit`} className="text-xs text-blue-500 hover:underline">✏ 編輯</Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* My Applications */}
      {tab === 'applications' && (
        <div className="space-y-4">
          {myApplications.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="text-5xl mb-4">🧳</div>
              <h3 className="font-semibold text-gray-700 mb-2">尚未申請任何房源</h3>
              <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto leading-relaxed">
                瀏覽台灣各地游牧友善租屋，找到喜歡的房源後即可一鍵送出申請。
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/listings" className="btn-primary text-sm">🔍 立即瀏覽房源</Link>
                <Link href="/listings?foreignOk=true" className="btn-secondary text-sm">🌍 外籍友善房源</Link>
              </div>
              {/* 快速引導：三步驟 */}
              <div className="mt-8 grid grid-cols-3 gap-4 text-center max-w-xs mx-auto">
                {[
                  { step: '1', icon: '🔍', text: '搜尋房源' },
                  { step: '2', icon: '📋', text: '送出申請' },
                  { step: '3', icon: '🤝', text: '聯絡房東' },
                ].map(s => (
                  <div key={s.step} className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">{s.step}</div>
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-xs text-gray-500">{s.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : myApplications.map((a) => {
            const { listing: lst, ...appRest } = a;
            const { owner, ...lstRest } = lst;
            const isApproved = appRest.status === 'approved';
            return (
              <div key={a.id} className={`card p-5 ${isApproved ? 'ring-2 ring-green-200' : ''}`}>
                <div className="flex gap-4">
                  <div className="w-20 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                    {lst.images[0] && <img src={lst.images[0]} alt="" loading="lazy" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/listings/${lstRest.id}`} className="font-semibold text-sm hover:text-blue-600 line-clamp-1">{lstRest.title}</Link>
                      <span className={`badge shrink-0 ${STATUS_COLORS[appRest.status]}`}>{STATUS_LABELS[appRest.status]}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{lstRest.city} · {formatPrice(lstRest.price)}/月</p>
                    <p className="text-xs text-gray-600 mt-1">入住：{a.moveInDate} · {a.duration} 個月</p>
                  </div>
                </div>

                {/* ✅ 申請通過 → 顯示房東聯絡資訊 */}
                {isApproved && owner && (owner.phone || owner.lineId) && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-3">
                    <p className="text-xs font-semibold text-green-700 mb-2">🎉 恭喜！申請已通過，請聯絡房東確認細節</p>
                    <div className="space-y-1">
                      {owner.phone && (
                        <a href={`tel:${owner.phone}`} className="flex items-center gap-2 text-sm text-green-800 hover:text-green-600">
                          <span>📞</span>
                          <span>{owner.phone}</span>
                        </a>
                      )}
                      {owner.lineId && (
                        <div className="flex items-center gap-2 text-sm text-green-800">
                          <span>💬</span>
                          <span>LINE ID：<strong>{owner.lineId}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 房東回覆訊息 */}
                {a.landlordReply && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
                    <p className="text-xs text-blue-600 font-medium mb-0.5">💬 房東留言</p>
                    <p className="text-xs text-blue-800 leading-relaxed">{a.landlordReply}</p>
                  </div>
                )}

                {a.status === 'pending' && (
                  <button onClick={() => updateApp(a.id, 'withdrawn')} className="text-xs text-red-500 hover:underline mt-2">撤回申請</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Incoming Applications */}
      {tab === 'incoming' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link href="/applications" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              📋 切換 Kanban 看板檢視 →
            </Link>
          </div>
          {incomingApplications.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">📭</div>
              <h3 className="font-semibold text-gray-700 mb-2">目前沒有收到申請</h3>
              <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
                刊登後將房源連結分享給潛在租客，或確認房源狀態為「上架中」，即可開始接受申請。
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/submit" className="btn-primary text-sm">＋ 刊登新房源</Link>
                {myListings.length > 0 && (
                  <Link href={`/listings/${myListings[0].id}`} className="btn-secondary text-sm">🔗 查看我的房源頁</Link>
                )}
              </div>
            </div>
          ) : incomingApplications.map((a) => {
            const { tenant: t, listing: lst } = a;
            return (
              <div key={a.id} className="card p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">{t.name[0]}</div>
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {t.name}
                          <Link href={`/tenants/${t.id}`} className="text-xs text-blue-500 hover:underline">查看檔案</Link>
                        </div>
                        <div className="text-xs text-gray-500">{t.email} {t.verified ? '· ✓ 已驗證' : ''}</div>
                      </div>
                    </div>
                  </div>
                  <span className={`badge shrink-0 ${STATUS_COLORS[a.status]}`}>{STATUS_LABELS[a.status]}</span>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <p className="text-xs text-gray-500 mb-1">申請的房源：<Link href={`/listings/${lst.id}`} className="text-blue-600 hover:underline">{lst.title}</Link></p>
                  <p className="text-xs text-gray-500">預計入住：{a.moveInDate} · {a.duration} 個月</p>
                  <p className="text-sm text-gray-700 mt-2 leading-relaxed">{a.message}</p>
                </div>

                {/* 房東已回覆 → 顯示回覆內容 */}
                {a.landlordReply && replyingAppId !== a.id && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">💬 你的回覆</p>
                    <p className="text-sm text-blue-800 leading-relaxed">{a.landlordReply}</p>
                    <button onClick={() => { setReplyingAppId(a.id); setReplyText(a.landlordReply ?? ''); }}
                      className="text-xs text-blue-500 hover:underline mt-1">編輯</button>
                  </div>
                )}

                {/* 回覆輸入框 */}
                {replyingAppId === a.id && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 space-y-2">
                    <p className="text-xs font-medium text-blue-700">💬 寫給租客的回覆（選填）</p>
                    <textarea rows={3} value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="例：歡迎入住！我的LINE是...，請加我好友後確認細節。"
                      className="input text-sm resize-none w-full" />
                    <div className="flex gap-2">
                      <button onClick={() => saveReply(a.id)}
                        className="btn-primary text-xs py-1.5 flex-1">儲存回覆</button>
                      <button onClick={() => { setReplyingAppId(null); setReplyText(''); }}
                        className="btn-secondary text-xs py-1.5 flex-1">取消</button>
                    </div>
                  </div>
                )}

                {a.status === 'pending' && replyingAppId !== a.id && (
                  <div className="space-y-2">
                    <button onClick={() => { setReplyingAppId(a.id); setReplyText(''); }}
                      className="text-xs text-blue-500 hover:underline w-full text-left">＋ 新增回覆訊息（接受前）</button>
                    <div className="flex gap-3">
                      <button onClick={() => updateApp(a.id, 'approved', replyingAppId === a.id ? replyText : undefined)}
                        className="btn-primary text-sm flex-1">✓ 接受申請</button>
                      <button onClick={() => updateApp(a.id, 'rejected')}
                        className="btn-danger text-sm flex-1">✗ 婉拒</button>
                    </div>
                  </div>
                )}
                {a.status !== 'pending' && !a.landlordReply && replyingAppId !== a.id && (
                  <button onClick={() => { setReplyingAppId(a.id); setReplyText(''); }}
                    className="text-xs text-blue-500 hover:underline">＋ 補充回覆訊息</button>
                )}
                {/* 已核准 → 提示建立合約 */}
                {a.status === 'approved' && (() => {
                  const hasContract = contracts.some(c =>
                    c.application?.tenant?.id === t.id
                  );
                  return hasContract ? (
                    <Link
                      href={`/contracts/${contracts.find(c => c.application?.tenant?.id === (a.tenant as Record<string, unknown>)?.id)?.id}`}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100">
                      📋 查看合約
                    </Link>
                  ) : (
                    <Link
                      href={`/contracts/new?applicationId=${a.id as string}`}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                      📋 建立電子合約
                    </Link>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Viewing Requests Tab */}
      {tab === 'viewings' && (
        <div className="space-y-4">
          {viewings.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">📅</div>
              <h3 className="font-semibold text-gray-700 mb-2">尚無看房預約</h3>
              {data.user.role === 'tenant'
                ? <p className="text-sm text-gray-500">在房源頁面點選「預約看房」即可提出申請</p>
                : <p className="text-sm text-gray-500">租客預約看房後將顯示於此</p>}
            </div>
          ) : viewings.map((v) => {
            const imgs: string[] = Array.isArray(v.listing.images)
              ? v.listing.images
              : (() => { try { return JSON.parse(String(v.listing.images || '[]')); } catch { return []; } })();
            const viewingStatusColors: Record<string, string> = {
              pending: 'bg-yellow-100 text-yellow-700',
              confirmed: 'bg-green-100 text-green-700',
              completed: 'bg-blue-100 text-blue-700',
              cancelled: 'bg-gray-100 text-gray-500',
            };
            const viewingStatusLabels: Record<string, string> = {
              pending: '⏳ 待確認', confirmed: '✅ 已確認',
              completed: '🏁 已完成', cancelled: '✗ 已取消',
            };
            const isLandlord = data.user.role === 'landlord' || data.user.role === 'admin';
            const times = [v.proposedTime1, v.proposedTime2, v.proposedTime3].filter(Boolean);
            return (
              <div key={v.id} className="card p-5">
                <div className="flex gap-4 mb-4">
                  <div className="w-20 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                    {imgs[0] && <img src={imgs[0]} alt="" loading="lazy" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/listings/${v.listing.id}`} className="font-semibold text-sm hover:text-blue-600 line-clamp-1">{v.listing.title}</Link>
                      <span className={`badge shrink-0 ${viewingStatusColors[v.status]}`}>{viewingStatusLabels[v.status]}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{v.listing.city} {v.listing.district}</p>
                    {isLandlord && (
                      <p className="text-xs text-gray-600 mt-1">租客：{v.tenant.name} {v.tenant.phone ? `· 📞 ${v.tenant.phone}` : ''}{v.tenant.lineId ? ` · LINE: ${v.tenant.lineId}` : ''}</p>
                    )}
                  </div>
                </div>

                {/* Proposed times */}
                <div className="bg-blue-50 rounded-xl p-3 mb-3">
                  <p className="text-xs font-medium text-blue-800 mb-2">候選時間：</p>
                  <div className="space-y-1">
                    {times.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 w-16 shrink-0">選項 {i + 1}：</span>
                        <span className="text-xs text-gray-700">{new Date(t!).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        {isLandlord && v.status === 'pending' && confirmingId !== v.id && (
                          <button
                            onClick={() => { setConfirmingId(v.id); setConfirmTime(t!); }}
                            className="text-xs text-green-600 hover:text-green-800 ml-auto border border-green-300 px-2 py-0.5 rounded-lg">
                            選此時間
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {v.confirmedTime && (
                    <p className="text-xs text-green-700 font-medium mt-2">✅ 確認時間：{new Date(v.confirmedTime).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                  )}
                </div>

                {/* Notes */}
                {v.notes && (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mb-3">備註：{v.notes}</p>
                )}

                {/* ✅ 看房操作錯誤（inline，取代 alert） */}
                {viewingError && confirmingId === v.id && (
                  <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2">
                    <p className="text-xs text-red-700">{viewingError}</p>
                    <button onClick={() => setViewingError('')} className="text-red-400 hover:text-red-600 text-sm leading-none shrink-0">✕</button>
                  </div>
                )}

                {/* Confirm dialog for landlord */}
                {isLandlord && v.status === 'pending' && confirmingId === v.id && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
                    <p className="text-xs font-medium text-green-800 mb-2">確認看房時間：</p>
                    <input
                      suppressHydrationWarning
                      type="datetime-local"
                      value={confirmTime}
                      onChange={e => setConfirmTime(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="input text-sm py-1.5 mb-2"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => updateViewing(v.id, 'confirmed', confirmTime)}
                        className="btn-primary text-xs py-1.5 flex-1">確認</button>
                      <button onClick={() => { setConfirmingId(null); setConfirmTime(''); }}
                        className="btn-secondary text-xs py-1.5 flex-1">取消</button>
                    </div>
                  </div>
                )}

                {/* 已完成看房 → 租客可撰寫評價 */}
                {!isLandlord && v.status === 'completed' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-yellow-800">🏁 看房已完成！分享你對這個空間的感受吧</span>
                    <Link href={`/listings/${v.listing.id}`}
                      className="shrink-0 text-xs bg-yellow-400 hover:bg-yellow-500 text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
                      ⭐ 撰寫評價
                    </Link>
                  </div>
                )}

                {/* Action buttons */}
                {v.status !== 'cancelled' && v.status !== 'completed' && (
                  <div className="flex gap-2">
                    {isLandlord && v.status === 'pending' && confirmingId !== v.id && (
                      <button onClick={() => setConfirmingId(v.id)}
                        className="btn-primary text-xs py-1.5 flex-1">✓ 確認看房</button>
                    )}
                    <button onClick={() => updateViewing(v.id, 'cancelled')}
                      className="text-xs text-red-500 border border-red-200 hover:bg-red-50 rounded-xl px-3 py-1.5 transition-colors">
                      取消預約
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Favorites Tab（房客專用）*/}
      {tab === 'favorites' && (
        <div className="space-y-4">
          {favorites.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">🤍</div>
              <h3 className="font-semibold text-gray-700 mb-2">尚未收藏任何房源</h3>
              <p className="text-sm text-gray-500 mb-4">在瀏覽房源時點擊 ♡ 即可加入收藏</p>
              <Link href="/listings" className="btn-primary">瀏覽房源</Link>
            </div>
          ) : favorites.map((fav) => {
            const l = fav.listing;
            const imgs: string[] = (() => { try { return JSON.parse(String(l.images || '[]')); } catch { return []; } })();
            return (
              <div key={fav.id} className="card p-5 flex gap-4">
                <div className="w-24 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                  {imgs[0] && <img src={imgs[0]} alt="" loading="lazy" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/listings/${l.id}`} className="font-semibold text-gray-900 hover:text-blue-600 text-sm leading-snug line-clamp-1">
                      {l.title}
                    </Link>
                    <button onClick={() => removeFavorite(l.id)} className="text-red-400 hover:text-red-600 text-lg shrink-0 leading-none" title="取消收藏">♥</button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{l.city} {l.district} · {l.type}</p>
                  <p className="text-blue-600 font-bold text-sm mt-2">{formatPrice(l.price)}/月</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Stats Tab（房東/管理員）── */}
      {tab === 'stats' && (
        <div>
          {/* ✅ SkeletonStats 取代「emoji + 文字」的 loading 狀態，結構有意義且不阻擋 */}
          {statsLoading ? (
            <SkeletonStats />
          ) : !landlordStats ? (
            <div className="card p-12 text-center">
              <p className="text-gray-400 text-sm">尚無統計資料</p>
            </div>
          ) : (
            <>
              {/* ── KPI 卡片（8 格）── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: '7 天瀏覽', value: landlordStats.overview.totalViews7d.toLocaleString(), icon: '👁', sub: '次', color: 'text-blue-700' },
                  { label: '30 天瀏覽', value: landlordStats.overview.totalViews30d.toLocaleString(), icon: '📅', sub: '次', color: 'text-indigo-700' },
                  { label: '總收藏數', value: landlordStats.overview.totalFavorites.toLocaleString(), icon: '❤️', sub: '次', color: 'text-rose-600' },
                  { label: '整體轉換率', value: `${landlordStats.overview.overallConvRate}%`, icon: '🎯', sub: '', color: 'text-orange-600' },
                  { label: '上架中房源', value: String(landlordStats.overview.activeListings), icon: '🏠', sub: '間', color: 'text-green-700' },
                  { label: '已核准入住', value: String(landlordStats.overview.totalApproved), icon: '✅', sub: '則', color: 'text-teal-700' },
                  { label: '待審申請', value: String(landlordStats.overview.pendingApplications), icon: '⏳', sub: '則', color: 'text-amber-600' },
                  { label: '預估月收入', value: `NT$${landlordStats.overview.estimatedMonthlyRevenue.toLocaleString()}`, icon: '💰', sub: '', color: 'text-nomad-navy' },
                ].map(k => (
                  <div key={k.label} className="card p-3 text-center">
                    <div className="text-xl mb-0.5">{k.icon}</div>
                    <div className={`text-lg font-bold ${k.color}`}>{k.value}<span className="text-xs text-gray-400 font-normal ml-0.5">{k.sub}</span></div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-tight">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* ── 全站 14 天瀏覽趨勢折線圖 ── */}
              {(() => {
                const views = landlordStats.trend.views;
                const days  = landlordStats.trend.days;
                const maxV  = Math.max(...views, 1);
                const W = 560; const H = 72; const PAD = 4;
                const pts = views.map((v, i) => {
                  const x = PAD + (i / (views.length - 1)) * (W - PAD * 2);
                  const y = H - PAD - ((v / maxV) * (H - PAD * 2));
                  return `${x},${y}`;
                }).join(' ');
                const totalV = views.reduce((a, b) => a + b, 0);
                return (
                  <div className="card p-4 mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-800 text-sm">📈 全站 14 天瀏覽趨勢</h3>
                      <span className="text-xs text-gray-400">合計 {totalV.toLocaleString()} 次</span>
                    </div>
                    <div className="overflow-hidden rounded-lg bg-blue-50/60 px-2 pt-2 pb-1">
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 72 }}>
                        {/* 填充漸層 */}
                        <defs>
                          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {/* 面積填充 */}
                        <polygon
                          points={`${PAD},${H} ${pts} ${W - PAD},${H}`}
                          fill="url(#sparkGrad)"
                        />
                        {/* 折線 */}
                        <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                        {/* 資料點 */}
                        {views.map((v, i) => {
                          const x = PAD + (i / (views.length - 1)) * (W - PAD * 2);
                          const y = H - PAD - ((v / maxV) * (H - PAD * 2));
                          return <circle key={i} cx={x} cy={y} r="3" fill="#3b82f6" />;
                        })}
                      </svg>
                      {/* 日期標籤（頭尾）*/}
                      <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                        <span>{days[0]?.slice(5)}</span>
                        <span>{days[days.length - 1]?.slice(5)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── 各房源明細 ── */}
              <h3 className="font-bold text-gray-800 mb-3">各房源表現</h3>
              <div className="space-y-4">
                {landlordStats.listings.map((l, idx) => {
                  const rankIdx = landlordStats.topListings.indexOf(l.id);
                  const rankBadge = rankIdx === 0 ? '🥇' : rankIdx === 1 ? '🥈' : rankIdx === 2 ? '🥉' : null;
                  const imgs: string[] = Array.isArray(l.images) ? l.images : (() => { try { return JSON.parse(String(l.images || '[]')); } catch { return []; } })();
                  // 迷你 sparkline
                  const trend = l.viewsTrend;
                  const maxT  = Math.max(...trend, 1);
                  const SW = 120; const SH = 32; const SP = 2;
                  const spts = trend.map((v, i) => {
                    const x = SP + (i / (trend.length - 1)) * (SW - SP * 2);
                    const y = SH - SP - ((v / maxT) * (SH - SP * 2));
                    return `${x},${y}`;
                  }).join(' ');
                  return (
                    <div key={l.id} className="card p-4">
                      {/* 標題列 */}
                      <div className="flex items-start gap-3 mb-3">
                        {imgs[0] && (
                          <div className="w-14 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                            <img src={imgs[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {rankBadge && <span className="text-base leading-none">{rankBadge}</span>}
                            <Link href={`/listings/${l.id}`} className="font-semibold text-sm hover:text-blue-600 line-clamp-1">{l.title}</Link>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {l.status === 'active' ? '✅ 上架中' : '⏸ 下架'}
                            </span>
                            <span className="text-xs text-gray-400">{l.city} {l.district}</span>
                            <span className="text-xs font-medium text-blue-600">NT${l.price.toLocaleString()}/月</span>
                          </div>
                        </div>
                        {/* 迷你 sparkline */}
                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                          <svg viewBox={`0 0 ${SW} ${SH}`} width={SW} height={SH} className="opacity-70">
                            <defs>
                              <linearGradient id={`sg${idx}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            <polygon points={`${SP},${SH} ${spts} ${SW - SP},${SH}`} fill={`url(#sg${idx})`} />
                            <polyline points={spts} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" />
                          </svg>
                          <span className="text-xs text-gray-400">14天趨勢</span>
                        </div>
                      </div>

                      {/* 核心指標 */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center mb-3">
                        <div className="bg-blue-50 rounded-lg p-2">
                          <div className="text-sm font-bold text-blue-700">{l.views7d}</div>
                          <div className="text-xs text-gray-500">7天瀏覽</div>
                        </div>
                        <div className="bg-rose-50 rounded-lg p-2">
                          <div className="text-sm font-bold text-rose-600">❤ {l.favoritesCount}</div>
                          <div className="text-xs text-gray-500">收藏</div>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-2">
                          <div className="text-sm font-bold text-orange-600">{l.convRate}%</div>
                          <div className="text-xs text-gray-500">轉換率</div>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-2">
                          <div className="text-sm font-bold text-yellow-600">{l.avgRating ? `⭐${l.avgRating}` : '—'}</div>
                          <div className="text-xs text-gray-500">{l.reviewCount > 0 ? `${l.reviewCount}則` : '無評價'}</div>
                        </div>
                        <div className="bg-cyan-50 rounded-lg p-2">
                          <div className="text-sm font-bold text-cyan-700">{l.avgWifi ? `📶${l.avgWifi}` : '—'}</div>
                          <div className="text-xs text-gray-500">Wi-Fi分</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-2">
                          <div className="text-sm font-bold text-purple-700">{Math.round(l.perfScore)}</div>
                          <div className="text-xs text-gray-500">績效分</div>
                        </div>
                      </div>

                      {/* 申請漏斗 */}
                      {l.appsTotal > 0 && (
                        <div className="mt-1">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>申請漏斗（共 {l.appsTotal} 則）</span>
                          </div>
                          <div className="flex rounded-full overflow-hidden h-2.5 w-full bg-gray-100">
                            {l.appsApproved > 0 && (
                              <div className="bg-green-500 h-full" style={{ width: `${(l.appsApproved / l.appsTotal) * 100}%` }} title={`核准 ${l.appsApproved}`} />
                            )}
                            {l.appsPending > 0 && (
                              <div className="bg-amber-400 h-full" style={{ width: `${(l.appsPending / l.appsTotal) * 100}%` }} title={`待審 ${l.appsPending}`} />
                            )}
                            {l.appsRejected > 0 && (
                              <div className="bg-red-400 h-full" style={{ width: `${(l.appsRejected / l.appsTotal) * 100}%` }} title={`拒絕 ${l.appsRejected}`} />
                            )}
                            {l.appsWithdrawn > 0 && (
                              <div className="bg-gray-300 h-full" style={{ width: `${(l.appsWithdrawn / l.appsTotal) * 100}%` }} title={`撤回 ${l.appsWithdrawn}`} />
                            )}
                          </div>
                          <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            {l.appsApproved  > 0 && <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-full bg-green-500" />核准 {l.appsApproved}</span>}
                            {l.appsPending   > 0 && <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" />待審 {l.appsPending}</span>}
                            {l.appsRejected  > 0 && <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-full bg-red-400"   />拒絕 {l.appsRejected}</span>}
                            {l.appsWithdrawn > 0 && <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-full bg-gray-300"  />撤回 {l.appsWithdrawn}</span>}
                          </div>
                        </div>
                      )}

                      {l.avgResponseHours !== null && (
                        <p className="text-xs text-gray-400 mt-2">
                          ⚡ 平均回覆時間：{l.avgResponseHours < 24
                            ? `${l.avgResponseHours} 小時`
                            : `${Math.round(l.avgResponseHours / 24)} 天`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Saved Searches Tab（房客專用）── */}
      {tab === 'saved' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">新房源上架且符合條件時，系統將自動寄送通知信給你。</p>
            <div className="flex gap-2">
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={() => testSavedSearchNotify('all')}
                  disabled={testingNotify !== null}
                  className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50">
                  {testingNotify ? '⏳ 執行中…' : '🧪 測試通知'}
                </button>
              )}
              <Link href="/listings" className="btn-secondary text-sm py-1.5 px-3">＋ 新增搜尋</Link>
            </div>
          </div>
          {savedSearches.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">🔔</div>
              <h3 className="font-semibold text-gray-700 mb-2">尚無儲存的搜尋條件</h3>
              <p className="text-sm text-gray-500 mb-4">在搜尋頁面篩選後，點選「🔔 儲存此搜尋條件」即可建立通知</p>
              <Link href="/listings" className="btn-primary">前往搜尋房源</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {savedSearches.map(s => {
                const tags: string[] = [];
                if (s.city) tags.push(`📍 ${s.city}`);
                if (s.type) tags.push(`🏠 ${s.type}`);
                if (s.maxPrice) tags.push(`💰 上限 NT$${s.maxPrice.toLocaleString()}`);
                if (s.minWifi) tags.push(`📶 ≥ ${s.minWifi}Mbps`);
                if (s.q) tags.push(`🔍 "${s.q}"`);

                // 組成搜尋 URL 以便直接前往
                const params = new URLSearchParams();
                if (s.city) params.set('city', s.city);
                if (s.type) params.set('type', s.type);
                if (s.maxPrice) params.set('maxPrice', String(s.maxPrice));
                if (s.minWifi) params.set('minWifi', String(s.minWifi));
                if (s.q) params.set('q', s.q);

                return (
                  <div key={s.id} className="card p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="font-semibold text-gray-800 text-sm">{s.name}</span>
                          <span className="text-xs text-gray-400">建立於 {new Date(s.createdAt).toLocaleDateString('zh-TW')}</span>
                          {s.lastSentAt ? (
                            <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full">
                              📧 上次通知：{new Date(s.lastSentAt).toLocaleDateString('zh-TW')}
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-50 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
                              尚未寄出通知
                            </span>
                          )}
                        </div>
                        {tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {tags.map(tag => (
                              <span key={tag} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">全部房源（無篩選條件）</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Link
                          href={`/listings${params.toString() ? `?${params}` : ''}`}
                          className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors text-center">
                          🔍 前往搜尋
                        </Link>
                        <button
                          onClick={() => deleteSavedSearch(s.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                          🗑 刪除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-gray-400 text-center pt-2">最多儲存 5 個搜尋條件</p>
            </div>
          )}
        </div>
      )}

      {/* Recently Viewed Tab（房客專用）*/}
      {tab === 'recent' && (
        <div className="space-y-4">
          {recentListings.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">👁</div>
              <h3 className="font-semibold text-gray-700 mb-2">尚無瀏覽紀錄</h3>
              <p className="text-sm text-gray-500 mb-4">瀏覽房源後，最近造訪的 10 筆將顯示於此</p>
              <Link href="/listings" className="btn-primary">開始瀏覽房源</Link>
            </div>
          ) : recentListings.map((l) => {
            const wifi = wifiLabel(l.wifiSpeed);
            const timeAgo = (() => {
              const diff = Date.now() - new Date(l.lastViewedAt).getTime();
              const mins  = Math.floor(diff / 60000);
              if (mins < 60) return `${mins} 分鐘前`;
              const hrs = Math.floor(mins / 60);
              if (hrs < 24) return `${hrs} 小時前`;
              return `${Math.floor(hrs / 24)} 天前`;
            })();
            return (
              <div key={l.id} className="card p-5 flex gap-4">
                <div className="w-24 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                  {l.images[0] && <img src={l.images[0]} alt="" loading="lazy" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/listings/${l.id}`} className="font-semibold text-gray-900 hover:text-blue-600 text-sm leading-snug line-clamp-1">
                      {l.title}
                    </Link>
                    <span className="text-xs text-gray-400 shrink-0">{timeAgo}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{l.city} {l.district} · {l.type}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-blue-600 font-bold text-sm">{formatPrice(l.price)}/月</p>
                    <span className={`text-xs ${wifi.color} px-2 py-0.5 rounded-full border`}>{wifi.emoji} {l.wifiSpeed}Mbps</span>
                    {l.avgRating && (
                      <span className="text-xs text-yellow-600">⭐ {l.avgRating} ({l.reviewCount})</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── My Reviews Tab（房客專用）── */}
      {tab === 'reviews' && (
        <div className="space-y-4">
          {(data.myReviews ?? []).length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">⭐</div>
              <h3 className="font-semibold text-gray-700 mb-2">尚未撰寫任何評價</h3>
              <p className="text-sm text-gray-500 mb-4">入住後可在房源頁面撰寫評價，幫助其他游牧工作者選房</p>
              <Link href="/listings" className="btn-primary">瀏覽房源</Link>
            </div>
          ) : (data.myReviews ?? []).map((r) => {
            const img = r.listing.images?.[0];
            return (
              <div key={r.id} className="card p-5">
                <div className="flex gap-4">
                  {/* 房源縮圖 */}
                  <div className="w-20 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                    {img && <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/listings/${r.listing.id}`}
                      className="font-semibold text-sm text-gray-900 hover:text-blue-600 line-clamp-1">
                      {r.listing.title}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.listing.city} {r.listing.district} · 評價於 {new Date(r.createdAt).toLocaleDateString('zh-TW')}
                    </p>
                    {/* 評分 */}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        <span className="text-xs text-gray-500 ml-1">整體 {r.rating}/5</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-blue-400">{'📶'.repeat(Math.min(r.wifiRating, 5))}</span>
                        <span className="text-xs text-gray-500">Wi-Fi {r.wifiRating}/5</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* 評價內容 */}
                <p className="text-sm text-gray-700 mt-3 leading-relaxed">{r.content}</p>
                {/* 房東回覆 */}
                {r.ownerReply && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">🏠 房東回覆：</p>
                    <p className="text-xs text-blue-800 leading-relaxed">{r.ownerReply}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 合約 Tab ── */}
      {tab === 'contracts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">所有與你相關的租賃合約</p>
            {(data.user.role === 'landlord' || data.user.role === 'admin') && (
              <Link href="/contracts/new" className="btn-secondary text-sm py-1.5 px-4">＋ 建立合約</Link>
            )}
          </div>
          {contracts.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="font-semibold text-gray-700 mb-2">尚無合約</h3>
              <p className="text-sm text-gray-500">
                {data.user.role === 'tenant'
                  ? '房東核准申請後可向你發送電子合約'
                  : '核准申請後可在申請列表中建立電子合約'}
              </p>
            </div>
          ) : contracts.map(c => {
            const imgs: string[] = Array.isArray(c.application.listing.images)
              ? c.application.listing.images
              : (() => { try { return JSON.parse(String(c.application.listing.images || '[]')); } catch { return []; } })();
            const s = {
              draft:            { label: '草稿',        color: 'bg-gray-100 text-gray-600',  icon: '📝' },
              pending_tenant:   { label: '等待租客簽名', color: 'bg-amber-100 text-amber-700', icon: '⏳' },
              pending_landlord: { label: '等待房東簽名', color: 'bg-blue-100 text-blue-700',   icon: '🖊' },
              completed:        { label: '已完成',       color: 'bg-green-100 text-green-700', icon: '✅' },
              cancelled:        { label: '已取消',       color: 'bg-red-100 text-red-500',     icon: '❌' },
            }[c.status] ?? { label: c.status, color: 'bg-gray-100 text-gray-600', icon: '📋' };

            const isLandlord = data.user.role === 'landlord' || data.user.role === 'admin';
            const mySigned   = isLandlord ? !!c.landlordSignedAt : !!c.tenantSignedAt;
            return (
              <Link key={c.id} href={`/contracts/${c.id}`} className="card p-5 flex gap-4 hover:shadow-md transition-shadow cursor-pointer block">
                <div className="w-20 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                  {imgs[0] && <img src={imgs[0]} alt="" loading="lazy" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm text-gray-900 line-clamp-1">{c.application.listing.title}</p>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                      {s.icon} {s.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {c.application.listing.city} · {isLandlord ? `租客：${c.application.tenant.name}` : `月租：NT$${c.rentAmount.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {c.startDate} ～ {c.endDate}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs ${mySigned ? 'text-green-600' : 'text-amber-600'}`}>
                      {mySigned ? '✅ 我已簽名' : '✍️ 待我簽名'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(c.createdAt).toLocaleDateString('zh-TW')} 建立
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
