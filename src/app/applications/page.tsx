'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Application = {
  id: string; status: string; moveInDate: string; duration: number; message: string; createdAt: string;
  tenant: { id: string; name: string; email: string; phone?: string; lineId?: string; verified: boolean };
  listing: { id: string; title: string; city: string; district: string; images: string; price: number };
};

const COLUMNS: { key: string; label: string; color: string; border: string }[] = [
  { key: 'pending',   label: '⏳ 待審核',  color: 'bg-yellow-50',  border: 'border-yellow-200' },
  { key: 'approved',  label: '✅ 已接受',  color: 'bg-green-50',   border: 'border-green-200' },
  { key: 'rejected',  label: '❌ 已婉拒',  color: 'bg-red-50',     border: 'border-red-200' },
  { key: 'withdrawn', label: '↩ 已撤回',  color: 'bg-gray-50',    border: 'border-gray-200' },
];

export default function ApplicationsKanbanPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('');
  const [filter, setFilter] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchApps = () => {
    fetch('/api/dashboard')
      .then(r => {
        if (r.status === 401) { window.location.href = '/auth/login'; return null; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (!d) return;
        setRole(d.user.role);
        // Landlords see incomingApplications; tenants see myApplications
        const list = d.user.role === 'tenant' ? d.myApplications : d.incomingApplications;
        setApps(Array.isArray(list) ? list as Application[] : []);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  };

  useEffect(() => { fetchApps(); }, []);

  const updateStatus = async (id: string, status: string) => {
    setActionError('');
    const res = await fetch('/api/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error || '操作失敗，請稍後再試');
      return;
    }
    fetchApps();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-4">⏳</div><p className="text-gray-500">載入中...</p></div>
    </div>
  );

  const filtered = filter
    ? apps.filter(a => {
        const lst = a.listing;
        const t = a.tenant;
        const q = filter.toLowerCase();
        return (lst.title + lst.city + lst.district + t.name + t.email).toLowerCase().includes(q);
      })
    : apps;

  const byStatus = (status: string) => filtered.filter(a => a.status === status);

  const statusBadge: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700', withdrawn: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nomad-navy">
            {role === 'tenant' ? '我的申請' : '申請管理 Kanban'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {apps.length} 筆申請 · 待審 {apps.filter(a => a.status === 'pending').length} 筆
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="搜尋房源或租客名稱…"
            className="input text-sm py-2 w-52"
          />
          <Link href="/dashboard" className="btn-secondary text-sm">← 返回控制台</Link>
        </div>
      </div>

      {/* 操作錯誤提示 */}
      {actionError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-4 flex items-center justify-between"
        >
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600 text-lg leading-none ml-3">×</button>
        </div>
      )}

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const items = byStatus(col.key);
          return (
            <div key={col.key} className={`rounded-2xl border ${col.border} ${col.color} p-4 min-h-[400px]`}>
              {/* Column header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-gray-700">{col.label}</h3>
                <span className="bg-white text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200">
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {items.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-8">— 無 —</div>
                )}
                {items.map(a => {
                  const lst = a.listing;
                  const imgs: string[] = (() => { try { return JSON.parse(String(lst.images || '[]')); } catch { return []; } })();
                  const t = a.tenant;
                  return (
                    <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                      {/* Listing thumbnail + title */}
                      <div className="flex gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                          {imgs[0] && <img src={imgs[0]} alt="" loading="lazy" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/listings/${lst.id}`} className="text-xs font-semibold text-gray-800 hover:text-blue-600 line-clamp-2 leading-snug">
                            {lst.title}
                          </Link>
                          <p className="text-xs text-gray-400 mt-0.5">{lst.city} {lst.district}</p>
                        </div>
                      </div>

                      {/* Tenant info */}
                      {role !== 'tenant' && (
                        <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
                          <div className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                            {t.name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{t.name}</p>
                            <p className="text-xs text-gray-400 truncate">{t.email}</p>
                          </div>
                          {t.verified && <span className="text-xs text-green-600 shrink-0">✓</span>}
                        </div>
                      )}

                      {/* Move-in details */}
                      <div className="text-xs text-gray-600 space-y-1 mb-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">入住日：</span>
                          <span>{a.moveInDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">租期：</span>
                          <span>{a.duration} 個月</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">申請時間：</span>
                          <span>{new Date(a.createdAt).toLocaleDateString('zh-TW')}</span>
                        </div>
                      </div>

                      {/* Message preview */}
                      {a.message && (
                        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mb-3 line-clamp-2 leading-relaxed">
                          &ldquo;{a.message}&rdquo;
                        </p>
                      )}

                      {/* Actions */}
                      {role !== 'tenant' && a.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => updateStatus(a.id, 'approved')}
                            className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded-lg hover:bg-green-700 transition-colors font-medium">
                            ✓ 接受
                          </button>
                          <button onClick={() => updateStatus(a.id, 'rejected')}
                            className="flex-1 bg-red-500 text-white text-xs py-1.5 rounded-lg hover:bg-red-600 transition-colors font-medium">
                            ✗ 婉拒
                          </button>
                        </div>
                      )}
                      {role === 'tenant' && a.status === 'pending' && (
                        <button onClick={() => updateStatus(a.id, 'withdrawn')}
                          className="w-full text-xs text-red-500 border border-red-200 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                          撤回申請
                        </button>
                      )}
                      {role !== 'tenant' && a.status === 'approved' && (
                        <button onClick={() => updateStatus(a.id, 'rejected')}
                          className="w-full text-xs text-gray-500 border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                          改為婉拒
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
