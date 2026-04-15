'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { formatPrice, wifiLabel } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string; name: string; email: string; role: string; phone?: string;
  verified: boolean; banned: boolean; createdAt: string; idDocUrl?: string;
  _count: { listings: number; applications: number; reviewsGiven: number; tenantConversations: number };
};

type StatsData = {
  totals: { users: number; listings: number; applications: number; messages: number; conversations: number; reviews: number; viewings: number; favorites: number };
  listings: { active: number; pending: number };
  applications: { approved: number; pending: number };
  viewings: { confirmed: number };
  users: { new: { thisMonth: number; lastMonth: number; thisWeek: number }; banned: number; verified: number; byRole: Record<string, number> };
  avgRating: number;
  trends: { weeklyUsers: { week: string; count: number }[]; weeklyListings: { week: string; count: number }[] };
  recent: {
    applications: { id: string; status: string; createdAt: string; tenant: { name: string }; listing: { title: string; city: string } }[];
    users: { id: string; name: string; email: string; role: string; createdAt: string }[];
  };
};

type AdminListing = {
  id: string;
  title: string;
  description: string;
  city: string;
  district: string;
  address: string;
  type: string;
  price: number;
  deposit: number;
  minRent: number;
  maxRent: number | null;
  wifiSpeed: number;
  wifiVerified: boolean;
  hasDesk: boolean;
  deskSize: string | null;
  naturalLight: boolean;
  nearCowork: boolean;
  nearMRT: boolean;
  includedFees: string[];
  amenities: string[];
  images: string[];
  status: string;
  foreignOk: boolean;
  availableFrom: string;
  lat: number | null;
  lng: number | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string };
};

type ReportTargetListing = { id: string; title: string; city: string; district: string; status: string; images: string[]; owner: { id: string; name: string; email: string } };
type ReportTargetUser    = { id: string; name: string; email: string; role: string; banned: boolean; verified: boolean };
type ReportTargetMessage = { id: string; content: string; hasContact: boolean; createdAt: string; sender: { id: string; name: string; email: string } };

type AdminReport = {
  id: string; targetType: string; targetId: string; reason: string;
  detail?: string; status: string; createdAt: string; resolutionNote?: string;
  reporter: { id: string; name: string; email: string };
  targetContent: ReportTargetListing | ReportTargetUser | ReportTargetMessage | null;
};

// ── Mini sparkline chart (pure CSS / SVG) ─────────────────────────────────────

function Sparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const w = 120; const h = 36; const pts = data.length;
  const points = data.map((v, i) => `${(i / (pts - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<'kpi' | 'listings' | 'users' | 'reports' | 'leases' | 'analytics'>('kpi');

  // Listings state
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [listingFilter, setListingFilter] = useState('pending');
  const [listingSearch, setListingSearch] = useState('');
  const [rejectListingModal, setRejectListingModal] = useState<{ id: string; title: string } | null>(null);
  const [rejectListingReason, setRejectListingReason] = useState('');
  // 批量審核
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkRejectModal, setBulkRejectModal] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [roleChangeId, setRoleChangeId] = useState<string | null>(null);
  // 身份驗證審核 modal
  const [verifyModal, setVerifyModal] = useState<{ userId: string; userName: string; idDocUrl: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Reports state
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportFilter, setReportFilter] = useState('pending');
  const [reportDetailModal, setReportDetailModal] = useState<AdminReport | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [reportActionLoading, setReportActionLoading] = useState(false);

  // Leases state
  type LeaseItem = {
    applicationId: string; moveInDate: string; duration: number;
    expiryDate: string; daysLeft: number; leaseStatus: 'expired' | 'expiring_soon' | 'active';
    tenant: { id: string; name: string; email: string; phone?: string };
    listing: { id: string; title: string; city: string; district: string; owner: { id: string; name: string; email: string } };
  };
  const [leases, setLeases] = useState<LeaseItem[]>([]);
  const [leaseSummary, setLeaseSummary] = useState<{ total: number; expired: number; expiringSoon: number; active: number } | null>(null);
  const [leaseFilter, setLeaseFilter] = useState<'all' | 'expired' | 'expiring_soon' | 'active'>('expiring_soon');

  // Stats state
  const [stats, setStats] = useState<StatsData | null>(null);

  // Analytics state（懶載入 — 切到 analytics tab 才抓）
  type AnalyticsData = {
    dailyRegistrations: { date: string; users: number; listings: number }[];
    cityDistribution:   { city: string; count: number }[];
    typeDistribution:   { type: string; count: number }[];
    applicationFunnel:  { total: number; pending: number; reviewed: number; approved: number; rejected: number; withdrawn: number; approvalRate: string };
    searchKeywords:     { cities: { city: string; count: number }[]; types: { type: string; count: number }[] };
    retentionMetrics:   { activeUsers7d: number; usersWithFavorites: number; usersWithApplications: number; totalUsers: number; engagementRate: string; avgFavoritesPerUser: string };
    peakActivity:       { hour: number; count: number }[];
  };
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const loadListings = useCallback(() => {
    fetch('/api/admin/listings').then(r => {
      if (r.status === 403) { window.location.href = '/'; return null; }
      return r.json();
    }).then(d => { if (d) setListings(Array.isArray(d) ? d : []); });
  }, []);

  const loadUsers = useCallback(() => {
    const params = new URLSearchParams();
    if (userRoleFilter !== 'all') params.set('role', userRoleFilter);
    if (userSearch) params.set('q', userSearch);
    fetch(`/api/admin/users?${params}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (Array.isArray(d)) setUsers(d); })
      .catch(() => {});
  }, [userRoleFilter, userSearch]);

  const loadStats = useCallback(() => {
    fetch('/api/admin/stats')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (d?.totals) setStats(d); })
      .catch(() => {});
  }, []);

  const loadReports = useCallback(() => {
    fetch(`/api/admin/reports?status=${reportFilter}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (Array.isArray(d)) setReports(d); })
      .catch(() => {});
  }, [reportFilter]);

  const loadLeases = useCallback(() => {
    fetch('/api/admin/leases')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (d?.leases) { setLeases(d.leases); setLeaseSummary(d.summary); } })
      .catch(() => {});
  }, []);

  const loadAnalytics = useCallback(() => {
    if (analyticsData) return; // 已載入，不重複請求
    setAnalyticsLoading(true);
    fetch('/api/admin/analytics').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setAnalyticsData(d);
    }).finally(() => setAnalyticsLoading(false));
  }, [analyticsData]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadListings(), loadUsers(), loadStats(), loadReports(), loadLeases()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (tab === 'users')     loadUsers();    }, [tab, userRoleFilter, loadUsers]);
  useEffect(() => { if (tab === 'reports')   loadReports();  }, [tab, reportFilter, loadReports]);
  useEffect(() => { if (tab === 'analytics') loadAnalytics(); }, [tab, loadAnalytics]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const updateListingStatus = async (id: string, status: string, rejectReason?: string) => {
    setActionError('');
    const res = await fetch('/api/admin/listings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, rejectReason }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError((data as { error?: string }).error || '操作失敗，請稍後再試');
      return;
    }
    loadListings();
    loadStats();
  };

  const confirmRejectListing = async () => {
    if (!rejectListingModal) return;
    await updateListingStatus(rejectListingModal.id, 'rejected', rejectListingReason);
    setRejectListingModal(null);
    setRejectListingReason('');
  };

  // ── 批量審核 ────────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredListings.map(l => l.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkAction = async (status: string, rejectReason?: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/listings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), status, rejectReason }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        setBulkRejectModal(false);
        setBulkRejectReason('');
        loadListings();
        loadStats();
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const patchReport = async (id: string, status: string, note?: string, action?: string) => {
    await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, note, action }),
    });
    loadReports();
  };

  const handleReportAction = async (status: 'resolved' | 'dismissed', action?: 'ban_user' | 'takedown') => {
    if (!reportDetailModal) return;
    setReportActionLoading(true);
    try {
      await patchReport(reportDetailModal.id, status, reportNote || undefined, action);
      setReportDetailModal(null);
      setReportNote('');
      if (action === 'ban_user') loadUsers();
      if (action === 'takedown') loadListings();
      loadStats();
    } finally {
      setReportActionLoading(false);
    }
  };

  const patchUser = async (id: string, action: string, extra?: Record<string, string>) => {
    setActionError('');
    const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, ...extra }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError((data as { error?: string }).error || '操作失敗，請稍後再試');
      return;
    }
    loadUsers();
    loadStats();
    setRoleChangeId(null);
  };

  const handleVerifyApprove = async () => {
    if (!verifyModal) return;
    await patchUser(verifyModal.userId, 'verify');
    setVerifyModal(null);
    setRejectNote('');
  };

  const handleVerifyReject = async () => {
    if (!verifyModal) return;
    await patchUser(verifyModal.userId, 'unverify', { note: rejectNote });
    setVerifyModal(null);
    setRejectNote('');
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const listingCounts = {
    all: listings.length,
    pending: listings.filter(l => l.status === 'pending').length,
    active: listings.filter(l => l.status === 'active').length,
    rejected: listings.filter(l => l.status === 'rejected').length,
    inactive: listings.filter(l => l.status === 'inactive').length,
  };
  const filteredListings = listings.filter(l => {
    const matchStatus = listingFilter === 'all' || l.status === listingFilter;
    const q = listingSearch.trim().toLowerCase();
    const matchSearch = !q
      || l.title.toLowerCase().includes(q)
      || l.city.toLowerCase().includes(q)
      || l.district.toLowerCase().includes(q)
      || l.owner.name.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const statusColors: Record<string, string> = { active: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700', rejected: 'bg-red-100 text-red-700', inactive: 'bg-gray-100 text-gray-600' };
  const statusLabels: Record<string, string> = { active: '✅ 上架中', pending: '⏳ 待審核', rejected: '❌ 未通過', inactive: '⏸ 下架' };
  const roleColors: Record<string, string> = { tenant: 'bg-blue-100 text-blue-700', landlord: 'bg-purple-100 text-purple-700', admin: 'bg-orange-100 text-orange-700' };
  const roleLabels: Record<string, string> = { tenant: '🧳 房客', landlord: '🏠 房東', admin: '⚙ 管理員' };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-4 animate-spin">⚙</div><p className="text-gray-500">載入管理後台...</p></div>
    </div>
  );

  return (
    <><div className="max-w-7xl mx-auto px-4 py-8">
      {/* ── 操作錯誤提示 ── */}
      {actionError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-4 flex items-center justify-between"
        >
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600 text-lg leading-none ml-3">×</button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nomad-navy">⚙ 管理後台</h1>
          <p className="text-gray-500 text-sm mt-1">NomadNest Taiwan 平台管理中心</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-orange-100 text-orange-700 text-xs px-3 py-1.5 rounded-full font-medium">🔐 管理員專屬</div>
          <Link href="/dashboard" className="btn-secondary text-sm">← 控制台</Link>
        </div>
      </div>

      {/* ── Nav tabs ── */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {[
          { key: 'kpi',      label: '📊 KPI 總覽' },
          { key: 'listings', label: `🏠 房源審核${listingCounts.pending > 0 ? ` (${listingCounts.pending})` : ''}` },
          { key: 'users',    label: `👥 用戶管理${stats?.users.new.thisWeek ? ` +${stats.users.new.thisWeek}` : ''}` },
          { key: 'reports',  label: `🚩 檢舉管理${reports.filter(r => r.status === 'pending').length > 0 ? ` (${reports.filter(r => r.status === 'pending').length})` : ''}` },
          { key: 'leases',    label: `📋 租約到期${leaseSummary?.expiringSoon ? ` (${leaseSummary.expiringSoon})` : ''}` },
          { key: 'analytics', label: '📈 行為分析' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-nomad-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          TAB 1 — KPI Dashboard
      ══════════════════════════════════════════════════════════ */}
      {tab === 'kpi' && stats && (
        <div className="space-y-6">

          {/* Top KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '👥', label: '總用戶數', value: stats.totals.users, sub: `本週新增 +${stats.users.new.thisWeek}`, color: 'from-blue-500 to-blue-600' },
              { icon: '🏠', label: '上架房源', value: stats.listings.active, sub: `待審核 ${stats.listings.pending} 件`, color: 'from-purple-500 to-purple-600' },
              { icon: '📩', label: '媒合申請', value: stats.totals.applications, sub: `已成功配對 ${stats.applications.approved} 件`, color: 'from-green-500 to-green-600' },
              { icon: '💬', label: '站內訊息', value: stats.totals.messages, sub: `${stats.totals.conversations} 組對話`, color: 'from-orange-500 to-orange-600' },
            ].map(card => (
              <div key={card.label} className={`bg-gradient-to-br ${card.color} text-white rounded-2xl p-5 shadow-sm`}>
                <div className="text-3xl mb-2">{card.icon}</div>
                <div className="text-3xl font-bold">{card.value.toLocaleString()}</div>
                <div className="text-sm font-medium mt-0.5 opacity-90">{card.label}</div>
                <div className="text-xs opacity-70 mt-1">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '⭐', label: '平均評分', value: stats.avgRating.toFixed(2), sub: `共 ${stats.totals.reviews} 則評價` },
              { icon: '📅', label: '看房預約', value: stats.totals.viewings, sub: `已確認 ${stats.viewings.confirmed} 件` },
              { icon: '❤️', label: '收藏次數', value: stats.totals.favorites, sub: '租客心願清單' },
              { icon: '✓', label: '已驗證用戶', value: stats.users.verified, sub: `共 ${stats.totals.users} 位用戶` },
            ].map(card => (
              <div key={card.label} className="card p-5 text-center">
                <div className="text-2xl mb-2">{card.icon}</div>
                <div className="text-2xl font-bold text-nomad-navy">{card.value}</div>
                <div className="text-xs text-gray-500 mt-1">{card.label}</div>
                <div className="text-xs text-gray-400">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Trend charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weekly users chart */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-1">用戶成長趨勢（過去 8 週）</h3>
              <p className="text-xs text-gray-400 mb-3">本月新增 {stats.users.new.thisMonth} 人 · 上月 {stats.users.new.lastMonth} 人</p>
              <Sparkline data={stats.trends.weeklyUsers.map(w => w.count)} color="#3b82f6" />
              <div className="flex justify-between mt-1">
                {stats.trends.weeklyUsers.filter((_, i) => i % 2 === 0).map(w => (
                  <span key={w.week} className="text-xs text-gray-400">{w.week}</span>
                ))}
              </div>
              <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                {stats.trends.weeklyUsers.slice(-3).reverse().map((w, i) => (
                  <div key={w.week} className="text-center">
                    <div className="text-sm font-bold text-nomad-navy">{w.count}</div>
                    <div className="text-xs text-gray-400">{i === 0 ? '本週' : i === 1 ? '上週' : '前週'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly listings chart */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-1">新增房源趨勢（過去 8 週）</h3>
              <p className="text-xs text-gray-400 mb-3">上架中 {stats.listings.active} 間 · 待審 {stats.listings.pending} 間</p>
              <Sparkline data={stats.trends.weeklyListings.map(w => w.count)} color="#8b5cf6" />
              <div className="flex justify-between mt-1">
                {stats.trends.weeklyListings.filter((_, i) => i % 2 === 0).map(w => (
                  <span key={w.week} className="text-xs text-gray-400">{w.week}</span>
                ))}
              </div>
              <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                {stats.trends.weeklyListings.slice(-3).reverse().map((w, i) => (
                  <div key={w.week} className="text-center">
                    <div className="text-sm font-bold text-nomad-navy">{w.count}</div>
                    <div className="text-xs text-gray-400">{i === 0 ? '本週' : i === 1 ? '上週' : '前週'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Role distribution + Recent activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Role pie */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-4">用戶角色分布</h3>
              <div className="space-y-3">
                {[
                  { key: 'tenant',   label: '🧳 房客',  color: 'bg-blue-500' },
                  { key: 'landlord', label: '🏠 房東',  color: 'bg-purple-500' },
                  { key: 'admin',    label: '⚙ 管理員', color: 'bg-orange-500' },
                ].map(r => {
                  const count = stats.users.byRole[r.key] || 0;
                  const pct = stats.totals.users > 0 ? (count / stats.totals.users) * 100 : 0;
                  return (
                    <div key={r.key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{r.label}</span>
                        <span className="font-medium text-nomad-navy">{count} 人 ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2">
                        <div className={`${r.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {stats.users.banned > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex justify-between text-sm text-red-600">
                      <span>🚫 已封鎖帳號</span>
                      <span className="font-medium">{stats.users.banned} 人</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent activity */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-4">最近活動</h3>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">最新申請</p>
                {stats.recent.applications.slice(0, 3).map(a => (
                  <div key={a.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50">
                    <div className="w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      {a.tenant.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{a.tenant.name} 申請了 {a.listing.title}</p>
                      <p className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString('zh-TW')}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColors[a.status]}`}>{a.status === 'approved' ? '✅' : a.status === 'pending' ? '⏳' : '❌'}</span>
                  </div>
                ))}
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-3">最新用戶</p>
                {stats.recent.users.slice(0, 3).map(u => (
                  <div key={u.id} className="flex items-center gap-2 py-1.5">
                    <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      {u.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{u.name}</p>
                      <p className="text-xs text-gray-400">{roleLabels[u.role]} · {new Date(u.createdAt).toLocaleDateString('zh-TW')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 2 — 房源審核
      ══════════════════════════════════════════════════════════ */}
      {tab === 'listings' && (
        <div>
          {/* Filter tabs */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { key: 'all',      label: '全部',      color: 'bg-gray-50',  ring: 'ring-gray-400'  },
              { key: 'pending',  label: '⏳ 待審核', color: 'bg-yellow-50',ring: 'ring-yellow-400'},
              { key: 'active',   label: '✅ 上架中', color: 'bg-green-50', ring: 'ring-green-400' },
              { key: 'rejected', label: '❌ 未通過', color: 'bg-red-50',   ring: 'ring-red-400'   },
              { key: 'inactive', label: '⏸ 已下架', color: 'bg-gray-50',  ring: 'ring-gray-400'  },
            ].map(s => (
              <button key={s.key} onClick={() => setListingFilter(s.key)}
                className={`card p-4 text-center transition-all ${listingFilter === s.key ? `ring-2 ${s.ring}` : ''} ${s.color}`}>
                <div className="text-xl font-bold text-nomad-navy">{listingCounts[s.key as keyof typeof listingCounts]}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </button>
            ))}
          </div>

          {/* 搜尋欄 */}
          <div className="flex gap-3 mb-4 flex-wrap items-center">
            <input
              value={listingSearch}
              onChange={e => { setListingSearch(e.target.value); setSelectedIds(new Set()); }}
              placeholder="搜尋房源標題、城市、房東姓名…"
              className="input text-sm py-2 flex-1 min-w-[200px] max-w-sm"
            />
            {listingSearch && (
              <button onClick={() => setListingSearch('')} className="text-xs text-gray-400 hover:text-gray-600">✕ 清除</button>
            )}
            <span className="text-xs text-gray-400 ml-auto">顯示 {filteredListings.length} / {listings.length} 筆</span>
          </div>

          {/* 批量操作列 */}
          {filteredListings.length > 0 && (
            <div className={`flex items-center gap-3 mb-4 p-3 rounded-xl transition-all ${selectedIds.size > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
              <input
                type="checkbox"
                checked={selectedIds.size > 0 && selectedIds.size === filteredListings.length}
                ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredListings.length; }}
                onChange={() => selectedIds.size === filteredListings.length ? clearSelection() : selectAllVisible()}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="text-sm text-gray-600">
                {selectedIds.size > 0 ? <strong className="text-blue-700">{selectedIds.size} 筆已選取</strong> : `全選 ${filteredListings.length} 筆`}
              </span>
              {selectedIds.size > 0 && (
                <div className="flex gap-2 ml-auto flex-wrap">
                  <button
                    onClick={() => bulkAction('active')}
                    disabled={bulkLoading}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                    {bulkLoading ? '處理中…' : `✓ 批量上架 (${selectedIds.size})`}
                  </button>
                  <button
                    onClick={() => { if (window.confirm(`確定下架 ${selectedIds.size} 筆房源？`)) bulkAction('inactive'); }}
                    disabled={bulkLoading}
                    className="text-xs px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors">
                    ⏸ 批量下架 ({selectedIds.size})
                  </button>
                  <button
                    onClick={() => setBulkRejectModal(true)}
                    disabled={bulkLoading}
                    className="btn-danger text-xs px-3 py-1.5 disabled:opacity-50">
                    ✗ 批量退件 ({selectedIds.size})
                  </button>
                  <button onClick={clearSelection} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50">
                    取消選取
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            {filteredListings.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <h3 className="font-semibold text-gray-700">
                  {listingSearch ? `找不到「${listingSearch}」的相關房源` : `目前沒有${listingFilter === 'pending' ? '待審核的' : ''}房源`}
                </h3>
              </div>
            ) : filteredListings.map(l => {
              const wifi = wifiLabel(l.wifiSpeed);
              const isSelected = selectedIds.has(l.id);
              return (
                <div key={l.id} className={`card p-5 transition-all ${isSelected ? 'ring-2 ring-blue-400 bg-blue-50/30' : ''}`}>
                  <div className="flex gap-4">
                    {/* Checkbox */}
                    <div className="flex items-start pt-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(l.id)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <div className="w-28 h-22 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                      {l.images[0] && <img src={l.images[0]} alt="" loading="lazy" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <Link href={`/listings/${l.id}`} target="_blank" className="font-semibold text-gray-900 hover:text-blue-600 text-sm">{l.title}</Link>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {l.city} {l.district} · {l.type} ·
                            房東：<span className="text-gray-700 font-medium">{l.owner.name}</span>
                            <span className="text-gray-400"> ({l.owner.email})</span>
                          </p>
                        </div>
                        <span className={`badge shrink-0 ${statusColors[l.status]}`}>{statusLabels[l.status]}</span>
                      </div>
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="text-blue-600 font-bold text-sm">{formatPrice(l.price)}/月</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${wifi.color}`}>{wifi.emoji} {l.wifiSpeed}Mbps {l.wifiVerified ? '✓' : ''}</span>
                        <span className="text-xs text-gray-500">押金 {l.deposit} 個月 · 最短 {l.minRent} 月</span>
                        {l.foreignOk && <span className="text-xs text-purple-600">🌍 外籍友善</span>}
                        <span className="text-xs text-gray-400">刊登：{new Date(l.createdAt).toLocaleDateString('zh-TW')}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {l.status === 'pending' && <>
                          <button onClick={() => updateListingStatus(l.id, 'active')} className="btn-primary text-sm px-4 py-1.5">✓ 審核通過，上架</button>
                          <button onClick={() => { setRejectListingModal({ id: l.id, title: l.title }); setRejectListingReason(''); }} className="btn-danger text-sm px-4 py-1.5">✗ 退件（附原因）</button>
                        </>}
                        {l.status === 'active' && (<>
                          <button onClick={() => { setRejectListingModal({ id: l.id, title: l.title }); setRejectListingReason(''); }} className="btn-danger text-sm px-4 py-1.5">⏸ 強制下架</button>
                        </>)}
                        {(l.status === 'rejected' || l.status === 'inactive') && (
                          <button onClick={() => updateListingStatus(l.id, 'active')} className="btn-primary text-sm px-4 py-1.5">↑ 重新上架</button>
                        )}
                        <Link href={`/listings/${l.id}`} target="_blank" className="btn-secondary text-sm px-4 py-1.5">👁 預覽</Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 3 — 用戶管理
      ══════════════════════════════════════════════════════════ */}
      {tab === 'users' && (
        <div>
          {/* Search + filter bar */}
          <div className="flex gap-3 mb-5 flex-wrap">
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadUsers()}
              placeholder="搜尋姓名或 Email…" className="input text-sm py-2 w-60" />
            <button onClick={loadUsers} className="btn-primary text-sm px-4 py-2">🔍 搜尋</button>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {[
                { key: 'all', label: '全部' },
                { key: 'tenant', label: '🧳 房客' },
                { key: 'landlord', label: '🏠 房東' },
                { key: 'admin', label: '⚙ 管理員' },
              ].map(r => (
                <button key={r.key} onClick={() => setUserRoleFilter(r.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${userRoleFilter === r.key ? 'bg-white text-nomad-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary bar */}
          {stats && (
            <div className="flex gap-4 mb-4 text-sm text-gray-500">
              <span>共 <strong className="text-nomad-navy">{users.length}</strong> 位用戶</span>
              <span>已驗證 <strong className="text-green-600">{stats.users.verified}</strong></span>
              {stats.users.banned > 0 && <span>已封鎖 <strong className="text-red-500">{stats.users.banned}</strong></span>}
            </div>
          )}

          {/* User table */}
          <div className="space-y-3">
            {users.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-4xl mb-3">👥</div>
                <h3 className="font-semibold text-gray-700">查無符合條件的用戶</h3>
              </div>
            ) : users.map(u => (
              <div key={u.id} className={`card p-4 ${u.banned ? 'opacity-60 bg-red-50' : ''}`}>
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${u.banned ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-700'}`}>
                    {u.banned ? '🚫' : u.name[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm text-gray-900">{u.name}</span>
                      <span className={`badge text-xs ${roleColors[u.role]}`}>{roleLabels[u.role]}</span>
                      {u.verified && <span className="badge bg-green-100 text-green-700 text-xs">✓ 已驗證</span>}
                      {!u.verified && u.idDocUrl && <span className="badge bg-amber-100 text-amber-700 text-xs animate-pulse">📄 待審核</span>}
                      {u.banned && <span className="badge bg-red-100 text-red-700 text-xs">🚫 已封鎖</span>}
                    </div>
                    <p className="text-xs text-gray-500">{u.email} {u.phone ? `· ${u.phone}` : ''}</p>
                    <div className="flex gap-4 mt-1.5 text-xs text-gray-400">
                      <span>🏠 {u._count.listings} 則房源</span>
                      <span>📩 {u._count.applications} 則申請</span>
                      <span>⭐ {u._count.reviewsGiven} 則評價</span>
                      <span>💬 {u._count.tenantConversations} 組對話</span>
                      <span>加入：{new Date(u.createdAt).toLocaleDateString('zh-TW')}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {/* Verify toggle */}
                    {u.verified ? (
                      <button onClick={() => { if (window.confirm(`確定取消 ${u.name} 的身份驗證？`)) patchUser(u.id, 'unverify'); }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                        取消驗證
                      </button>
                    ) : u.idDocUrl ? (
                      // 有上傳文件 → 彈出審核 modal
                      <button onClick={() => { setVerifyModal({ userId: u.id, userName: u.name, idDocUrl: u.idDocUrl! }); setRejectNote(''); }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                        🔍 審核文件
                      </button>
                    ) : (
                      // 未上傳文件 → 直接驗證（手動）
                      <button onClick={() => { if (window.confirm(`直接認證 ${u.name}（未上傳文件）？`)) patchUser(u.id, 'verify'); }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-colors">
                        ✓ 認證身份
                      </button>
                    )}

                    {/* Role change */}
                    {roleChangeId === u.id ? (
                      <div className="flex gap-1">
                        {['tenant', 'landlord', 'admin'].map(r => (
                          <button key={r} onClick={() => patchUser(u.id, 'setRole', { role: r })}
                            className={`text-xs px-2 py-1 rounded-lg border transition-colors ${u.role === r ? 'bg-blue-100 text-blue-700 border-blue-200' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                            {r === 'tenant' ? '房客' : r === 'landlord' ? '房東' : '管理員'}
                          </button>
                        ))}
                        <button onClick={() => setRoleChangeId(null)} className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setRoleChangeId(u.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                        🔄 變更角色
                      </button>
                    )}

                    {/* Ban toggle */}
                    <button onClick={() => { if (window.confirm(u.banned ? `確定解除封鎖 ${u.name}？` : `確定封鎖帳號 ${u.name}？`)) patchUser(u.id, u.banned ? 'unban' : 'ban'); }}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${u.banned ? 'border-blue-200 text-blue-600 hover:bg-blue-50' : 'border-red-200 text-red-500 hover:bg-red-50'}`}>
                      {u.banned ? '🔓 解除封鎖' : '🚫 封鎖帳號'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 4 — 檢舉管理
      ══════════════════════════════════════════════════════════ */}
      {tab === 'reports' && (
        <div>
          {/* Filter */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
            {[
              { key: 'pending',  label: '⏳ 待處理' },
              { key: 'resolved', label: '✅ 已處理' },
              { key: 'dismissed',label: '🗑 已忽略' },
              { key: 'all',      label: '全部' },
            ].map(f => (
              <button key={f.key} onClick={() => setReportFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${reportFilter === f.key ? 'bg-white text-nomad-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-4xl mb-3">🚩</div>
                <h3 className="font-semibold text-gray-700">目前沒有{reportFilter === 'pending' ? '待處理的' : ''}檢舉</h3>
              </div>
            ) : reports.map(r => {
              const typeLabel: Record<string, string> = { listing: '🏠 房源', message: '💬 訊息', user: '👤 用戶' };
              const reportStatusColors: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700', resolved: 'bg-green-100 text-green-700', dismissed: 'bg-gray-100 text-gray-500' };
              // Inline target preview
              let targetPreview: string | null = null;
              if (r.targetContent) {
                if (r.targetType === 'listing') {
                  const lc = r.targetContent as ReportTargetListing;
                  targetPreview = `「${lc.title}」${lc.city}${lc.district} · ${lc.owner.name} (${lc.owner.email})`;
                } else if (r.targetType === 'user') {
                  const uc = r.targetContent as ReportTargetUser;
                  targetPreview = `${uc.name} (${uc.email}) · ${uc.role}${uc.banned ? ' 🚫已封禁' : ''}`;
                } else if (r.targetType === 'message') {
                  const mc = r.targetContent as ReportTargetMessage;
                  targetPreview = `「${mc.content.slice(0, 60)}${mc.content.length > 60 ? '…' : ''}」— ${mc.sender.name}`;
                }
              }
              return (
                <div key={r.id} className="card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{typeLabel[r.targetType]}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${reportStatusColors[r.status]}`}>{r.status === 'pending' ? '⏳ 待處理' : r.status === 'resolved' ? '✅ 已處理' : '🗑 已忽略'}</span>
                        <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('zh-TW')}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 mb-1">原因：{r.reason}</p>
                      {r.detail && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 mb-2">{r.detail}</p>}
                      {targetPreview && (
                        <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 mb-2 truncate">
                          🎯 {targetPreview}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        檢舉者：{r.reporter.name} ({r.reporter.email})
                        {r.resolutionNote && (
                          <span className="ml-2 text-green-600">📝 備註：{r.resolutionNote}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => { setReportDetailModal(r); setReportNote(''); }}
                        className="text-xs border border-blue-200 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                        🔍 查看詳情
                      </button>
                      {r.status === 'pending' && (<>
                        <button onClick={() => patchReport(r.id, 'resolved')}
                          className="text-xs border border-green-200 text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors">
                          ✓ 標記已處理
                        </button>
                        <button onClick={() => patchReport(r.id, 'dismissed')}
                          className="text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                          忽略
                        </button>
                      </>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 5 — 租約到期管理
      ══════════════════════════════════════════════════════════ */}
      {tab === 'leases' && (
        <div>
          {/* Summary cards */}
          {leaseSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: '總租約數', value: leaseSummary.total, color: 'bg-blue-500', icon: '📋' },
                { label: '已到期', value: leaseSummary.expired, color: 'bg-red-500', icon: '🔴' },
                { label: '即將到期（30天內）', value: leaseSummary.expiringSoon, color: 'bg-amber-500', icon: '⚠️' },
                { label: '進行中', value: leaseSummary.active, color: 'bg-green-500', icon: '✅' },
              ].map(c => (
                <div key={c.label} className={`${c.color} text-white rounded-2xl p-4 shadow-sm`}>
                  <div className="text-2xl mb-1">{c.icon}</div>
                  <div className="text-3xl font-bold">{c.value}</div>
                  <div className="text-sm opacity-90 mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filter buttons */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
            {[
              { key: 'expiring_soon', label: '⚠️ 即將到期' },
              { key: 'expired',       label: '🔴 已到期' },
              { key: 'active',        label: '✅ 進行中' },
              { key: 'all',           label: '全部' },
            ].map(f => (
              <button key={f.key} onClick={() => setLeaseFilter(f.key as typeof leaseFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${leaseFilter === f.key ? 'bg-white text-nomad-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Lease list */}
          <div className="space-y-3">
            {leases.filter(l => leaseFilter === 'all' || l.leaseStatus === leaseFilter).length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-4xl mb-3">📋</div>
                <h3 className="font-semibold text-gray-700">目前沒有符合的租約</h3>
                <p className="text-sm text-gray-400 mt-1">只顯示已核准且已入住（moveInDate ≤ 今日）的申請</p>
              </div>
            ) : leases.filter(l => leaseFilter === 'all' || l.leaseStatus === leaseFilter).map(lease => {
              const urgencyBorder =
                lease.leaseStatus === 'expired'       ? 'border-l-4 border-l-red-400' :
                lease.leaseStatus === 'expiring_soon' ? 'border-l-4 border-l-amber-400' :
                                                        'border-l-4 border-l-green-400';
              const badgeStyle =
                lease.leaseStatus === 'expired'       ? 'bg-red-100 text-red-700' :
                lease.leaseStatus === 'expiring_soon' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-green-100 text-green-700';
              const badgeLabel =
                lease.leaseStatus === 'expired'       ? `🔴 已到期 ${Math.abs(lease.daysLeft)} 天` :
                lease.leaseStatus === 'expiring_soon' ? `⚠️ 還剩 ${lease.daysLeft} 天` :
                                                        `✅ 還剩 ${lease.daysLeft} 天`;

              return (
                <div key={lease.applicationId} className={`card p-4 ${urgencyBorder}`}>
                  <div className="flex items-start gap-4 flex-wrap">
                    {/* Left — listing info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Link href={`/listings/${lease.listing.id}`} className="font-semibold text-sm text-nomad-navy hover:underline">
                          🏠 {lease.listing.title}
                        </Link>
                        <span className="text-xs text-gray-400">{lease.listing.city} {lease.listing.district}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeStyle}`}>{badgeLabel}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                        <span>🧳 房客：<strong className="text-gray-700">{lease.tenant.name}</strong></span>
                        <span>📧 {lease.tenant.email}</span>
                        {lease.tenant.phone && <span>📞 {lease.tenant.phone}</span>}
                        <span>🏠 房東：{lease.listing.owner.name}</span>
                        <span>入住日：{new Date(lease.moveInDate).toLocaleDateString('zh-TW')}</span>
                        <span>到期日：<strong className={lease.leaseStatus === 'expired' ? 'text-red-600' : lease.leaseStatus === 'expiring_soon' ? 'text-amber-600' : 'text-green-600'}>{new Date(lease.expiryDate).toLocaleDateString('zh-TW')}</strong></span>
                        <span>租期：{lease.duration} 個月</span>
                      </div>
                    </div>

                    {/* Right — quick actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <a href={`mailto:${lease.tenant.email}`}
                        className="text-xs border border-blue-200 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors text-center">
                        ✉ 聯絡房客
                      </a>
                      <a href={`mailto:${lease.listing.owner.email}`}
                        className="text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors text-center">
                        ✉ 聯絡房東
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>

      {/* ══ 身份驗證審核 Modal ══ */}

      {verifyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-lg">🔍 身份驗證審核</h2>
                  <p className="text-amber-100 text-sm mt-0.5">{verifyModal.userName}</p>
                </div>
                <button onClick={() => setVerifyModal(null)} className="text-white/80 hover:text-white text-xl">✕</button>
              </div>
            </div>

            {/* ID Document Image */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase">上傳的身份文件</h3>
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 mb-4"
                style={{ maxHeight: '320px' }}>
                <img
                  src={verifyModal.idDocUrl}
                  alt="身份文件"
                  className="w-full h-full object-contain"
                  style={{ maxHeight: '320px' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '';
                    (e.target as HTMLImageElement).parentElement!.innerHTML =
                      '<div class="p-8 text-center text-gray-400"><div class="text-3xl mb-2">🖼️</div><div class="text-sm">圖片無法顯示</div></div>';
                  }}
                />
              </div>

              {/* Rejection note */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  駁回備註 <span className="text-gray-400 font-normal">（駁回時填寫，通知原因）</span>
                </label>
                <textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="例：文件模糊、請重新上傳清晰的身分證正面照片"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleVerifyApprove}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  ✅ 核准驗證
                </button>
                <button
                  onClick={handleVerifyReject}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  ❌ 駁回申請
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-3">
                審核結果將自動寄送 Email 通知給用戶
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══ 房源退件原因 Modal ══ */}
      {rejectListingModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-rose-600 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-lg">⚠ 退件 / 下架房源</h2>
                  <p className="text-red-100 text-sm mt-0.5 line-clamp-1">{rejectListingModal.title}</p>
                </div>
                <button onClick={() => setRejectListingModal(null)} className="text-white/80 hover:text-white text-xl">✕</button>
              </div>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                退件原因 <span className="text-gray-400 font-normal">（將寄送 Email 通知房東）</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {['照片不清晰，請重新上傳', '房源資訊不完整', '地址無法核實', 'Wi-Fi 資訊異常', '違反平台使用規範', '重複刊登'].map(t => (
                  <button key={t} onClick={() => setRejectListingReason(t)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${rejectListingReason === t ? 'bg-red-100 border-red-400 text-red-700' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <textarea
                value={rejectListingReason}
                onChange={e => setRejectListingReason(e.target.value)}
                placeholder="請說明退件原因，房東收到通知後可修改重新提交…"
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-4"
              />
              <div className="flex gap-3">
                <button onClick={() => setRejectListingModal(null)} className="flex-1 btn-secondary py-2.5 text-sm">取消</button>
                <button onClick={confirmRejectListing} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors">
                  確認退件，通知房東
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ 檢舉詳情 Modal ══ */}
      {reportDetailModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-500 to-red-600 p-5 sticky top-0 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-lg">🚩 檢舉詳情</h2>
                  <p className="text-rose-100 text-sm mt-0.5">
                    {({ listing: '🏠 房源', user: '👤 用戶', message: '💬 訊息' } as Record<string,string>)[reportDetailModal.targetType] ?? reportDetailModal.targetType}
                    ·{' '}
                    {reportDetailModal.status === 'pending' ? '⏳ 待處理' : reportDetailModal.status === 'resolved' ? '✅ 已處理' : '🗑 已忽略'}
                  </p>
                </div>
                <button onClick={() => setReportDetailModal(null)} className="text-white/80 hover:text-white text-xl">✕</button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* 檢舉資訊 */}
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
                <p><span className="text-gray-500">檢舉者：</span><strong className="text-gray-800">{reportDetailModal.reporter.name}</strong> ({reportDetailModal.reporter.email})</p>
                <p><span className="text-gray-500">原因：</span><strong className="text-gray-800">{reportDetailModal.reason}</strong></p>
                {reportDetailModal.detail && <p><span className="text-gray-500">說明：</span><span className="text-gray-700">{reportDetailModal.detail}</span></p>}
                <p><span className="text-gray-500">時間：</span>{new Date(reportDetailModal.createdAt).toLocaleString('zh-TW')}</p>
              </div>

              {/* 被舉報對象預覽 */}
              {reportDetailModal.targetContent && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">被舉報對象</h3>
                  {reportDetailModal.targetType === 'listing' && (() => {
                    const lc = reportDetailModal.targetContent as ReportTargetListing;
                    const img = (() => { try { return (JSON.parse(lc.images as unknown as string) as string[])[0]; } catch { return (lc.images as unknown as string[])[0]; } })();
                    return (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        {img && <img src={img} alt={lc.title} loading="lazy" className="w-full h-40 object-cover" />}
                        <div className="p-3">
                          <p className="font-semibold text-gray-900">{lc.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{lc.city}{lc.district}</p>
                          <p className="text-xs text-gray-500">房東：{lc.owner.name} ({lc.owner.email})</p>
                          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${statusColors[lc.status]}`}>{statusLabels[lc.status]}</span>
                        </div>
                      </div>
                    );
                  })()}
                  {reportDetailModal.targetType === 'user' && (() => {
                    const uc = reportDetailModal.targetContent as ReportTargetUser;
                    return (
                      <div className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">{uc.name[0]}</div>
                          <div>
                            <p className="font-semibold text-gray-900">{uc.name}</p>
                            <p className="text-xs text-gray-500">{uc.email}</p>
                            <div className="flex gap-1 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[uc.role]}`}>{roleLabels[uc.role]}</span>
                              {uc.verified && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ 已驗證</span>}
                              {uc.banned && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">🚫 已封禁</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {reportDetailModal.targetType === 'message' && (() => {
                    const mc = reportDetailModal.targetContent as ReportTargetMessage;
                    return (
                      <div className="border border-gray-200 rounded-xl p-4">
                        <p className="text-xs text-gray-500 mb-1">發送者：{mc.sender.name} ({mc.sender.email})</p>
                        <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 leading-relaxed">{mc.content}</p>
                        {mc.hasContact && (
                          <p className="text-xs text-orange-600 mt-2">⚠️ 系統偵測到此訊息包含聯絡資訊（跑單疑慮）</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 處理備註 */}
              {reportDetailModal.status === 'pending' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">處理備註（選填）</label>
                  <textarea
                    value={reportNote}
                    onChange={e => setReportNote(e.target.value)}
                    placeholder="記錄處理原因或備忘事項…"
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  />
                </div>
              )}
              {reportDetailModal.resolutionNote && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-green-700 mb-0.5">📝 處理備註</p>
                  <p className="text-sm text-green-800">{reportDetailModal.resolutionNote}</p>
                </div>
              )}

              {/* Actions */}
              {reportDetailModal.status === 'pending' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReportAction('resolved')}
                      disabled={reportActionLoading}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50">
                      ✅ 標記已處理
                    </button>
                    <button
                      onClick={() => handleReportAction('dismissed')}
                      disabled={reportActionLoading}
                      className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50">
                      🗑 忽略此檢舉
                    </button>
                  </div>
                  {/* Quick actions */}
                  {reportDetailModal.targetType === 'user' && (() => {
                    const uc = reportDetailModal.targetContent as ReportTargetUser | null;
                    return !uc?.banned ? (
                      <button
                        onClick={() => { if (window.confirm('確定封禁此用戶並標記檢舉為已處理？')) handleReportAction('resolved', 'ban_user'); }}
                        disabled={reportActionLoading}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50">
                        🚫 封禁用戶並標記已處理
                      </button>
                    ) : null;
                  })()}
                  {reportDetailModal.targetType === 'listing' && (() => {
                    const lc = reportDetailModal.targetContent as ReportTargetListing | null;
                    return lc?.status === 'active' ? (
                      <button
                        onClick={() => { if (window.confirm('確定下架此房源並標記檢舉為已處理？')) handleReportAction('resolved', 'takedown'); }}
                        disabled={reportActionLoading}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50">
                        ⏸ 下架房源並標記已處理
                      </button>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 6 — 行為分析
      ══════════════════════════════════════════════════════════ */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {analyticsLoading || !analyticsData ? (
            <div className="card p-12 text-center">
              <div className="text-5xl mb-3 animate-pulse">📊</div>
              <p className="text-gray-500">載入行為分析資料…</p>
            </div>
          ) : (
            <>
              {/* ── 活躍度指標卡片 ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { icon: '🔥', label: '7 天活躍用戶', value: analyticsData.retentionMetrics.activeUsers7d, sub: `共 ${analyticsData.retentionMetrics.totalUsers} 位用戶`, color: 'text-orange-600' },
                  { icon: '❤️', label: '有收藏行為', value: analyticsData.retentionMetrics.usersWithFavorites, sub: `佔 ${Math.round(analyticsData.retentionMetrics.usersWithFavorites / Math.max(analyticsData.retentionMetrics.totalUsers, 1) * 100)}%`, color: 'text-rose-500' },
                  { icon: '📩', label: '申請率（用戶）', value: `${analyticsData.retentionMetrics.engagementRate}%`, sub: `${analyticsData.retentionMetrics.usersWithApplications} 人曾申請`, color: 'text-green-600' },
                ].map(k => (
                  <div key={k.label} className="card p-4 text-center">
                    <div className="text-2xl mb-1">{k.icon}</div>
                    <div className={`text-xl font-bold ${k.color}`}>{typeof k.value === 'number' ? k.value.toLocaleString() : k.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
                    <div className="text-xs text-gray-400">{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* ── 30 天每日注冊 + 新增房源趨勢（雙線圖）── */}
              {(() => {
                const reg = analyticsData.dailyRegistrations;
                const maxV = Math.max(...reg.map(r => Math.max(r.users, r.listings)), 1);
                const W = 600; const H = 90; const PAD = 6;
                const xOf = (i: number) => PAD + (i / (reg.length - 1)) * (W - PAD * 2);
                const yOf = (v: number) => H - PAD - (v / maxV) * (H - PAD * 2);
                const uPts = reg.map((r, i) => `${xOf(i)},${yOf(r.users)}`).join(' ');
                const lPts = reg.map((r, i) => `${xOf(i)},${yOf(r.listings)}`).join(' ');
                return (
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800">30 天每日新增趨勢</h3>
                      <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> 用戶</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block rounded" /> 房源</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-2 pt-2 pb-1">
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }} preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="uGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="lGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <polygon points={`${PAD},${H} ${uPts} ${W - PAD},${H}`} fill="url(#uGrad)" />
                        <polygon points={`${PAD},${H} ${lPts} ${W - PAD},${H}`} fill="url(#lGrad)" />
                        <polyline points={uPts} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
                        <polyline points={lPts} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                      <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                        <span>{reg[0]?.date}</span>
                        <span>{reg[Math.floor(reg.length / 2)]?.date}</span>
                        <span>{reg[reg.length - 1]?.date}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── 城市 + 類型分布（橫向 Bar）── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 城市分布 */}
                <div className="card p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">🏙 熱門城市房源分布</h3>
                  <div className="space-y-2.5">
                    {analyticsData.cityDistribution.map((c, idx) => {
                      const maxCount = analyticsData.cityDistribution[0]?.count || 1;
                      const pct = (c.count / maxCount) * 100;
                      const colors = ['bg-blue-500','bg-blue-400','bg-indigo-400','bg-purple-400','bg-violet-400','bg-fuchsia-400','bg-pink-400','bg-rose-400','bg-orange-400','bg-amber-400'];
                      return (
                        <div key={c.city}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-gray-700">{c.city}</span>
                            <span className="text-gray-500">{c.count} 間</span>
                          </div>
                          <div className="bg-gray-100 rounded-full h-2">
                            <div className={`${colors[idx % colors.length]} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 類型分布 */}
                <div className="card p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">🏠 房源類型分布</h3>
                  {(() => {
                    const total = analyticsData.typeDistribution.reduce((s, t) => s + t.count, 0) || 1;
                    const typeColors: Record<string, string> = {
                      '套房': 'bg-blue-500',
                      '雅房': 'bg-purple-500',
                      '整層公寓': 'bg-green-500',
                      '共居空間': 'bg-orange-500',
                    };
                    return (
                      <div className="space-y-3">
                        {analyticsData.typeDistribution.map(t => {
                          const pct = (t.count / total) * 100;
                          return (
                            <div key={t.type}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-gray-700">{t.type}</span>
                                <span className="text-gray-500">{t.count} 間 ({pct.toFixed(0)}%)</span>
                              </div>
                              <div className="bg-gray-100 rounded-full h-3">
                                <div className={`${typeColors[t.type] || 'bg-gray-400'} h-3 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ── 申請漏斗 ── */}
              <div className="card p-5">
                <h3 className="font-semibold text-gray-800 mb-1">📐 申請轉換漏斗</h3>
                <p className="text-xs text-gray-400 mb-4">核准率 {analyticsData.applicationFunnel.approvalRate}% · 總申請 {analyticsData.applicationFunnel.total} 筆</p>
                {(() => {
                  const f = analyticsData.applicationFunnel;
                  const maxW = f.total || 1;
                  const steps = [
                    { label: '全部申請', count: f.total,    color: 'bg-blue-500',  pct: 100 },
                    { label: '待審核',   count: f.pending,  color: 'bg-amber-400', pct: (f.pending / maxW) * 100 },
                    { label: '已審核',   count: f.reviewed, color: 'bg-indigo-500', pct: (f.reviewed / maxW) * 100 },
                    { label: '已核准',   count: f.approved, color: 'bg-green-500', pct: (f.approved / maxW) * 100 },
                    { label: '已退件',   count: f.rejected, color: 'bg-red-400',   pct: (f.rejected / maxW) * 100 },
                  ];
                  return (
                    <div className="flex flex-col gap-2">
                      {steps.map(s => (
                        <div key={s.label} className="flex items-center gap-3">
                          <div className="w-14 text-xs text-right text-gray-500 shrink-0">{s.label}</div>
                          <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                            <div className={`${s.color} h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2`} style={{ width: `${Math.max(s.pct, 2)}%` }}>
                              {s.pct > 10 && <span className="text-white text-xs font-bold">{s.count}</span>}
                            </div>
                            {s.pct <= 10 && <span className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-500">{s.count}</span>}
                          </div>
                          <div className="w-10 text-xs text-gray-400 shrink-0">{s.pct.toFixed(0)}%</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* ── 高峰時段熱度圖 + 搜尋關鍵字 ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 24 小時活動熱度圖 */}
                <div className="card p-5">
                  <h3 className="font-semibold text-gray-800 mb-1">⏰ 申請高峰時段（台灣時間）</h3>
                  <p className="text-xs text-gray-400 mb-3">近 30 天申請量，按小時分布</p>
                  {(() => {
                    const peak = analyticsData.peakActivity;
                    const maxC = Math.max(...peak.map(p => p.count), 1);
                    return (
                      <div className="flex items-end gap-0.5 h-16">
                        {peak.map(p => {
                          const h = Math.max((p.count / maxC) * 100, 2);
                          const isPeak = p.count === maxC;
                          return (
                            <div key={p.hour} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                              <div
                                className={`w-full rounded-t transition-all ${isPeak ? 'bg-orange-500' : p.count > maxC * 0.6 ? 'bg-blue-400' : p.count > maxC * 0.3 ? 'bg-blue-300' : 'bg-gray-200'}`}
                                style={{ height: `${h}%` }}
                              />
                              {/* tooltip */}
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                {p.hour}時: {p.count}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0 時</span><span>6 時</span><span>12 時</span><span>18 時</span><span>23 時</span>
                  </div>
                </div>

                {/* 熱門搜尋城市 */}
                <div className="card p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">🔍 熱門搜尋城市</h3>
                  {analyticsData.searchKeywords.cities.length === 0 ? (
                    <p className="text-sm text-gray-400">尚無儲存的搜尋條件</p>
                  ) : (
                    <div className="space-y-2">
                      {analyticsData.searchKeywords.cities.map((c, i) => {
                        const maxK = analyticsData.searchKeywords.cities[0]?.count || 1;
                        const pct  = (c.count / maxK) * 100;
                        return (
                          <div key={c.city} className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                            <span className="text-sm font-medium text-gray-700 w-16 shrink-0">{c.city}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className="bg-teal-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-6 text-right">{c.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 批量退件 Modal ─────────────────────────────────────────────────── */}
      {bulkRejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-5 rounded-t-2xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">批量退件確認</h3>
                  <p className="text-red-100 text-sm mt-0.5">共 {selectedIds.size} 筆房源將被退件並通知房東</p>
                </div>
                <button onClick={() => { setBulkRejectModal(false); setBulkRejectReason(''); }} className="text-white/80 hover:text-white text-xl">✕</button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">退件原因（將傳送給所有房東）</label>
                <textarea
                  value={bulkRejectReason}
                  onChange={e => setBulkRejectReason(e.target.value)}
                  placeholder="例：資料不完整，請補充房源照片及正確地址後重新提交…"
                  rows={3}
                  className="input text-sm resize-none"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                ⚠️ 此操作將同時退件 {selectedIds.size} 筆房源，每位房東都會收到退件通知 Email。
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setBulkRejectModal(false); setBulkRejectReason(''); }} className="flex-1 btn-secondary py-2.5 text-sm">
                  取消
                </button>
                <button
                  onClick={() => bulkAction('rejected', bulkRejectReason)}
                  disabled={bulkLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50">
                  {bulkLoading ? '退件中…' : `確認退件 ${selectedIds.size} 筆`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
