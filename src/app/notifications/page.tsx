'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Notification = {
  id: string; type: string; title: string; body: string;
  href: string; createdAt: string; read: boolean;
};

const typeIcon: Record<string, string> = {
  success: '🎉', warning: '⚠️', info: '📩', message: '💬', calendar: '📅', reply: '💬',
};
const typeBg: Record<string, string> = {
  success:  'bg-green-50 border-green-200',
  warning:  'bg-yellow-50 border-yellow-200',
  info:     'bg-blue-50 border-blue-200',
  message:  'bg-purple-50 border-purple-200',
  calendar: 'bg-cyan-50 border-cyan-200',
  reply:    'bg-indigo-50 border-indigo-200',
};
const typeAccent: Record<string, string> = {
  success:  'bg-green-500',
  warning:  'bg-yellow-500',
  info:     'bg-blue-500',
  message:  'bg-purple-500',
  calendar: 'bg-cyan-500',
  reply:    'bg-indigo-500',
};
const typeLabel: Record<string, string> = {
  success: '成功', warning: '警告', info: '資訊', message: '訊息', calendar: '看房', reply: '房東回覆',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} 天前`;
  if (hours > 0) return `${hours} 小時前`;
  if (mins > 0) return `${mins} 分鐘前`;
  return '剛剛';
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  // ✅ 已讀 ID 集合：從 localStorage 初始化，變更時同步寫回
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  // ① 載入 localStorage 中的已讀 ID
  useEffect(() => {
    try {
      const stored = localStorage.getItem('nomad-read-notifications');
      if (stored) setReadIds(new Set(JSON.parse(stored) as string[]));
    } catch { /* localStorage 不可用時靜默忽略 */ }
  }, []);

  // ② 已讀 ID 變動時同步回 localStorage（最多保留 200 筆，防止無限增長）
  useEffect(() => {
    if (readIds.size === 0) return;
    try {
      const ids = Array.from(readIds).slice(-200);
      localStorage.setItem('nomad-read-notifications', JSON.stringify(ids));
    } catch { /* 靜默忽略 */ }
  }, [readIds]);

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => {
        if (r.status === 401) { router.push('/auth/login'); return null; }
        return r.ok ? r.json() : null;
      })
      .then(d => {
        if (d) setNotifications(d.notifications || []);
        setLoading(false);
      });
  }, [router]);

  const markAllRead = () => {
    setReadIds(prev => new Set([...Array.from(prev), ...notifications.map(n => n.id)]));
  };

  const markRead = (id: string) => {
    setReadIds(prev => new Set([...Array.from(prev), id]));
  };

  // 篩選後的通知列表
  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);
  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  // 可用的通知類型（for filter tabs）
  const availableTypes = Array.from(new Set(notifications.map(n => n.type)));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-nomad-navy">🔔 通知中心</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            最近 7 天的平台通知
            {unreadCount > 0 && (
              <span className="ml-2 bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount} 則未讀
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="text-xs text-blue-600 hover:underline px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors">
              ✓ 全部標為已讀
            </button>
          )}
          <Link href="/dashboard" className="btn-secondary text-sm py-1.5">← 控制台</Link>
        </div>
      </div>

      {/* 類型篩選 Tabs */}
      {!loading && notifications.length > 0 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-full border shrink-0 transition-colors ${filter === 'all' ? 'bg-nomad-navy text-white border-nomad-navy' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
            全部（{notifications.length}）
          </button>
          {availableTypes.map(type => (
            <button key={type}
              onClick={() => setFilter(type)}
              className={`text-xs px-3 py-1.5 rounded-full border shrink-0 transition-colors ${filter === type ? 'bg-nomad-navy text-white border-nomad-navy' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              {typeIcon[type]} {typeLabel[type] || type}（{notifications.filter(n => n.type === type).length}）
            </button>
          ))}
        </div>
      )}

      {/* 通知列表 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">{filter === 'all' ? '🔕' : typeIcon[filter] || '🔔'}</div>
          <h3 className="font-semibold text-gray-700 mb-2">
            {filter === 'all' ? '目前沒有新通知' : `沒有「${typeLabel[filter] || filter}」類型的通知`}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {filter === 'all'
              ? '申請狀態變更、新訊息、看房確認等都會顯示在這裡'
              : '試試查看其他類型的通知'}
          </p>
          {filter === 'all'
            ? <Link href="/listings" className="btn-primary">瀏覽房源</Link>
            : <button onClick={() => setFilter('all')} className="btn-secondary">查看全部通知</button>}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(n => {
            const isRead = readIds.has(n.id);
            return (
              <Link key={n.id} href={n.href}
                onClick={() => markRead(n.id)}
                className={`block card p-4 border transition-all hover:shadow-md relative ${
                  isRead
                    ? 'bg-white border-gray-100 opacity-75'
                    : typeBg[n.type] || 'bg-white border-gray-100'
                }`}>
                {/* 未讀紅點 */}
                {!isRead && (
                  <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full" />
                )}
                <div className="flex gap-3">
                  {/* 類型色條 */}
                  <div className={`w-1 rounded-full shrink-0 self-stretch ${isRead ? 'bg-gray-200' : typeAccent[n.type] || 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`font-semibold text-sm leading-snug ${isRead ? 'text-gray-500' : 'text-gray-900'}`}>
                        {typeIcon[n.type]} {n.title}
                      </h3>
                      <span className="text-xs text-gray-400 shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className={`text-sm mt-1 leading-relaxed ${isRead ? 'text-gray-400' : 'text-gray-600'}`}>
                      {n.body}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}

          {/* 底部提示 */}
          <p className="text-center text-xs text-gray-400 pt-3">
            僅顯示最近 7 天的通知 · 點擊即可前往相關頁面
          </p>
        </div>
      )}
    </div>
  );
}
