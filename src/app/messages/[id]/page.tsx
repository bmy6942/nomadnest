'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { ChatSkeleton } from '@/components/SkeletonCard';

// ─── Types ────────────────────────────────────────────────────────────────────
type MsgSender = { name: string };
type Message   = {
  id: string; content: string; senderId: string;
  read: boolean; hasContact: boolean; createdAt: string; sender: MsgSender;
};
type ConvUser  = { id: string; name: string; verified: boolean };
type Listing   = { id: string; title: string; city: string; images: string; price: number; ownerId: string };
type ConvData  = {
  id: string; tenantId: string; landlordId: string;
  listing: Listing; tenant: ConvUser; landlord: ConvUser; messages: Message[];
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

// ─── Date/time helpers (Western-style) ────────────────────────────────────────
function formatDateHeader(dateStr: string): string {
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
  if (diff === 0)  return 'Today';
  if (diff === 1)  return 'Yesterday';
  if (diff < 7)    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diff > 365 ? 'numeric' : undefined });
}

function formatMsgTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function groupByDate(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  messages.forEach(msg => {
    const date = new Date(msg.createdAt).toDateString();         // stable key
    const last = groups[groups.length - 1];
    if (last?.date === date) last.messages.push(msg);
    else groups.push({ date, messages: [msg] });
  });
  return groups;
}

// ─── Read-receipt icon ────────────────────────────────────────────────────────
function ReadReceipt({ read }: { read: boolean }) {
  return read ? (
    // Double check — blue when read
    <svg className="w-3.5 h-3.5 text-blue-300 inline" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M1 5l4 4L13 1M5 9l4-4" />
    </svg>
  ) : (
    // Single check — grey when delivered
    <svg className="w-3.5 h-3.5 text-blue-300/70 inline" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 5l4 4L14 1" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const id     = params.id as string;

  const [conv,    setConv]    = useState<ConvData | null>(null);
  const [me,      setMe]      = useState<{ id: string; name: string; role: string } | null>(null);
  const [input,   setInput]   = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [safeDismissed, setSafeDismissed] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const meIdRef   = useRef<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/conversations/${id}`);
    if (res.status === 401) { router.push('/auth/login'); return; }
    if (res.ok) {
      const data = await res.json();
      setConv(data);
      setLoading(false);
    }
  }, [id, router]);

  // ✅ Parallel: auth + conversation
  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
      loadMessages(),
    ]).then(([meData]) => {
      if (meData?.user) { setMe(meData.user); meIdRef.current = meData.user.id; }
    });
  }, [loadMessages]);

  // ✅ SSE — real-time message streaming
  useEffect(() => {
    const es = new EventSource(`/api/conversations/${id}/stream`);

    es.onmessage = (e) => {
      try {
        const msg: Message = JSON.parse(e.data);
        setConv(prev => {
          if (!prev) return prev;
          if (prev.messages.some(m => m.id === msg.id)) return prev;
          return { ...prev, messages: [...prev.messages, msg] };
        });
        if (msg.senderId !== meIdRef.current) {
          fetch(`/api/conversations/${id}`, { method: 'PATCH' }).catch(() => {});
        }
      } catch {}
    };

    return () => es.close();
  }, [id]);

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conv?.messages.length]);

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  };

  const send = async () => {
    if (!input.trim() || sending || !me) return;
    const content = input.trim();
    setSending(true);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const res = await fetch(`/api/conversations/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const msg: Message = await res.json();
      setConv(prev => {
        if (!prev) return prev;
        if (prev.messages.some(m => m.id === msg.id)) return prev;
        return { ...prev, messages: [...prev.messages, msg] };
      });
    } else {
      setInput(content);
    }
    setSending(false);
    textareaRef.current?.focus();
  };

  if (loading) return <ChatSkeleton />;
  if (!conv || !me) return null;

  const other  = me.id === conv.tenantId ? conv.landlord : conv.tenant;
  const imgs: string[] = (() => {
    try { return JSON.parse(String(conv.listing.images || '[]')) as string[]; }
    catch { return []; }
  })();
  const grouped = groupByDate(conv.messages);

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-64px)]">

      {/* ══ Header ══════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
        {/* Back */}
        <Link href="/messages"
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 -ml-1 rounded-lg hover:bg-gray-100"
          aria-label="Back to messages">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>

        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${avatarColor(other.name)}`}>
          {initials(other.name)}
        </div>

        {/* Name + listing */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-gray-900 text-sm">{other.name}</p>
            {other.verified && (
              <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" />
              </svg>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">{conv.listing.title}</p>
        </div>

        {/* Listing thumbnail */}
        <Link href={`/listings/${conv.listing.id}`} className="shrink-0 rounded-xl overflow-hidden w-10 h-10 bg-gray-100 hover:opacity-80 transition-opacity" title="View listing">
          {imgs[0]
            ? <img src={imgs[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
            : <span className="flex items-center justify-center h-full text-xl">🏠</span>}
        </Link>
      </div>

      {/* ══ Listing info bar ════════════════════════════════════════════════ */}
      <Link href={`/listings/${conv.listing.id}`}
        className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-2 shrink-0 hover:bg-gray-100 transition-colors group">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-9.5 11.25S.5 17.642.5 10.5a9 9 0 1119 0z" />
          </svg>
          <span className="text-xs text-gray-500 truncate">{conv.listing.city} · {conv.listing.title}</span>
        </div>
        <span className="text-xs font-semibold text-gray-700 shrink-0 group-hover:text-blue-600 transition-colors">
          {formatPrice(conv.listing.price)}<span className="font-normal text-gray-400">/mo</span>
        </span>
      </Link>

      {/* ══ Safety banner ═══════════════════════════════════════════════════ */}
      {!safeDismissed && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 flex items-start gap-2.5 shrink-0">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <p className="text-xs text-amber-800 leading-relaxed flex-1">
            <span className="font-semibold">Stay safe.</span> Never share your phone number, email, or payment info outside NomadNest. All bookings and contracts are protected through our platform.
          </p>
          <button onClick={() => setSafeDismissed(true)}
            aria-label="Dismiss"
            className="text-amber-400 hover:text-amber-600 transition-colors shrink-0 p-0.5 rounded">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ══ Messages area ═══════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-gray-50/50">

        {conv.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg mb-3 ${avatarColor(other.name)}`}>
              {initials(other.name)}
            </div>
            <p className="font-semibold text-gray-800">{other.name}</p>
            <p className="text-sm text-gray-400 mt-1">Say hello to start the conversation!</p>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.date}>
            {/* Date divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium px-2 shrink-0">
                {formatDateHeader(group.messages[0].createdAt)}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Messages in group */}
            <div className="space-y-1">
              {group.messages.map((msg, idx) => {
                const isMe   = msg.senderId === me.id;
                const isLast = idx === group.messages.length - 1;
                const nextMsg = group.messages[idx + 1];
                const isSameNextSender = nextMsg?.senderId === msg.senderId;

                return (
                  <div key={msg.id}>
                    {/* Contact-sharing warning */}
                    {msg.hasContact && (
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl max-w-xs">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                          Contact info detected — keep transactions on NomadNest for your protection.
                        </div>
                      </div>
                    )}

                    <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''} ${!isSameNextSender ? 'mb-2' : ''}`}>
                      {/* Other user avatar — only show on last in a sequence */}
                      {!isMe && (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 transition-opacity ${isSameNextSender ? 'opacity-0' : 'opacity-100'} ${avatarColor(other.name)}`}>
                          {initials(other.name)}
                        </div>
                      )}

                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[72%]`}>
                        <div className={`px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap
                          ${isMe
                            ? 'bg-blue-600 text-white rounded-2xl rounded-br-md shadow-sm'
                            : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-200 shadow-sm'}`}>
                          {msg.content}
                        </div>

                        {/* Timestamp + read receipt — show only on last in sequence or last overall */}
                        {(!isSameNextSender || isLast) && (
                          <span className="flex items-center gap-1 text-xs text-gray-400 mt-1 px-0.5">
                            {formatMsgTime(msg.createdAt)}
                            {isMe && <ReadReceipt read={msg.read} />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* ══ Input area ══════════════════════════════════════════════════════ */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
        <div className="flex items-end gap-2">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={1}
            maxLength={1000}
            className="flex-1 input resize-none min-h-[44px] max-h-32 py-2.5 text-sm bg-gray-50 focus:bg-white transition-colors"
          />

          {/* Send button */}
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            aria-label="Send message"
            className="w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-colors shadow-sm">
            {sending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>

        {/* Footer hint + char count */}
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-gray-400">
            🔒 Book viewings &amp; sign contracts through NomadNest to stay protected
          </p>
          {input.length > 800 && (
            <span className={`text-xs shrink-0 ml-2 tabular-nums ${input.length >= 1000 ? 'text-red-500 font-medium' : 'text-amber-500'}`}>
              {input.length}/1000
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
