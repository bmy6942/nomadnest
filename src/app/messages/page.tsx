'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessagesSkeleton } from '@/components/SkeletonCard';
import { getCachedStale, setCached } from '@/lib/clientCache';

// ─── Types ────────────────────────────────────────────────────────────────────
type ConvListing = { id: string; title: string; city: string; images: string; price: number };
type ConvUser    = { id: string; name: string };
type LastMsg     = { content: string; createdAt: string; senderId: string };

type Conversation = {
  id: string;
  listingId: string;
  tenantId: string;
  landlordId: string;
  updatedAt: string;
  unreadCount: number;
  listing: ConvListing;
  tenant: ConvUser;
  landlord: ConvUser;
  messages: LastMsg[];
};

// ─── Avatar helpers ───────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  'bg-violet-500', 'bg-blue-500',   'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500',   'bg-indigo-500', 'bg-teal-500',    'bg-orange-500',
  'bg-pink-500',   'bg-cyan-500',
];

function avatarColor(name: string): string {
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Time helpers (Western-style) ─────────────────────────────────────────────
function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7)   return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CACHE_CONV = '/api/conversations';
const CACHE_ME   = '/api/auth/me';

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MessagesPage() {
  const router = useRouter();

  // ✅ Synchronous cache read — instant render on revisit
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const c = getCachedStale<Conversation[]>(CACHE_CONV);
    return c?.data ?? [];
  });
  const [me, setMe]       = useState<{ id: string; name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(() => getCachedStale(CACHE_CONV) === null);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    const cachedConv = getCachedStale<Conversation[]>(CACHE_CONV);

    // ✅ Parallel fetch — auth + conversations simultaneously
    Promise.all([
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
      (cachedConv && !cachedConv.stale)
        ? Promise.resolve(null)                                // fresh cache → skip
        : fetch('/api/conversations').then(r => r.ok ? r.json() : null),
    ]).then(([meData, convData]) => {
      if (!meData?.user) { router.push('/auth/login?redirect=/messages'); return; }
      setMe(meData.user);

      if (convData !== null) {
        const list = Array.isArray(convData) ? convData : [];
        setCached(CACHE_CONV, list);
        setConversations(list);
      } else if (cachedConv) {
        setConversations(cachedConv.data);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [router]);

  // ✅ Client-side search filter (memoised)
  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c =>
      c.listing.title.toLowerCase().includes(q) ||
      c.tenant.name.toLowerCase().includes(q)   ||
      c.landlord.name.toLowerCase().includes(q) ||
      (c.messages[0]?.content.toLowerCase().includes(q))
    );
  }, [conversations, search]);

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  if (loading) return <MessagesSkeleton />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28 lg:pb-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          {totalUnread > 0 && (
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {totalUnread}
            </span>
          )}
        </div>
        {me?.role === 'tenant' && (
          <Link href="/listings"
            className="btn-secondary text-sm px-4 py-2 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            Browse listings
          </Link>
        )}
      </div>

      {/* ── Search bar ── */}
      {conversations.length > 0 && (
        <div className="relative mb-4">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="input w-full pl-10 py-2.5 text-sm bg-gray-50 border-gray-200 focus:bg-white"
          />
        </div>
      )}

      {/* ── Empty states ── */}
      {conversations.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">No conversations yet</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
            {me?.role === 'tenant'
              ? 'Find a listing you like and message the host to start chatting.'
              : 'Your conversations with tenants will appear here.'}
          </p>
          {me?.role === 'tenant' && (
            <Link href="/listings" className="btn-primary px-6 py-2.5 text-sm">
              Browse listings
            </Link>
          )}
        </div>
      )}

      {/* ── No search results ── */}
      {conversations.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No conversations match &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch('')} className="mt-2 text-blue-600 text-sm hover:underline">
            Clear search
          </button>
        </div>
      )}

      {/* ── Conversation list ── */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100 shadow-sm">
          {filtered.map(conv => {
            const other   = me?.id === conv.tenantId ? conv.landlord : conv.tenant;
            const lastMsg = conv.messages[0];
            const imgs: string[] = (() => {
              try { return JSON.parse(String(conv.listing.images || '[]')) as string[]; }
              catch { return []; }
            })();
            const timeAgo  = lastMsg ? formatTimeAgo(lastMsg.createdAt) : '';
            const isMyMsg  = lastMsg?.senderId === me?.id;
            const hasUnread = conv.unreadCount > 0;

            return (
              <Link key={conv.id} href={`/messages/${conv.id}`}
                className={`flex items-center gap-3.5 px-4 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer group
                  ${hasUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : ''}`}>

                {/* ── Avatar ── */}
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 ${avatarColor(other.name)}`}>
                    {initials(other.name)}
                  </div>
                  {hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-600 border-2 border-white rounded-full" />
                  )}
                </div>

                {/* ── Content ── */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className={`text-sm truncate ${hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
                      {other.name}
                    </span>
                    <span className={`text-xs shrink-0 ${hasUnread ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                      {timeAgo}
                    </span>
                  </div>

                  {/* Listing title */}
                  <p className="text-xs text-gray-400 truncate mb-1 flex items-center gap-1">
                    {/* Listing thumbnail inline */}
                    {imgs[0]
                      ? <img src={imgs[0]} alt="" className="w-4 h-4 rounded object-cover inline-block shrink-0" />
                      : <span className="text-sm">🏠</span>}
                    {conv.listing.city} · {conv.listing.title}
                  </p>

                  {/* Last message preview */}
                  {lastMsg && (
                    <p className={`text-sm truncate ${hasUnread && !isMyMsg ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                      {isMyMsg && <span className="text-gray-400">You: </span>}
                      {lastMsg.content}
                    </p>
                  )}
                </div>

                {/* ── Unread badge ── */}
                {hasUnread && (
                  <span className="shrink-0 bg-blue-600 text-white text-xs font-bold min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center">
                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                  </span>
                )}

                {/* ── Chevron ── */}
                <svg className="w-4 h-4 text-gray-300 shrink-0 group-hover:text-gray-400 transition-colors"
                  fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Footer note ── */}
      {conversations.length > 0 && (
        <p className="text-center text-xs text-gray-400 mt-6">
          All conversations are encrypted and private · Never share payment info outside the platform
        </p>
      )}
    </div>
  );
}
