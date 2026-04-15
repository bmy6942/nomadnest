'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils';

interface Props {
  listingId: string;
  ownerId: string;
  price: number;
  isLoggedIn: boolean;
  isTenant: boolean;
  hasApproved: boolean;        // 是否可以評價（入住日已到 或 已完成看房）
  hasReviewed: boolean;        // 是否已評價過
  pendingMoveInDate?: string | null; // 申請已批准但入住日尚未到（YYYY-MM-DD）
}

export default function ListingActions({ listingId, ownerId, price, isLoggedIn, isTenant, hasApproved, hasReviewed, pendingMoveInDate }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  // 在 useEffect 中取得 URL，避免 Server/Client 不一致的 SSR 反模式
  const [shareUrl, setShareUrl] = useState('');
  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareToLine = () => {
    if (!shareUrl) return;
    const text = encodeURIComponent(`游牧友善房源推薦！\n${shareUrl}`);
    window.open(`https://line.me/R/msg/text/?${text}`, '_blank');
  };

  // 頁面載入時靜默記錄一次瀏覽
  useEffect(() => {
    fetch('/api/listings/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId }),
    }).catch(() => {}); // 靜默失敗，不影響用戶體驗
  }, [listingId]);
  const [showViewing, setShowViewing] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  // 看房預約表單
  const [times, setTimes] = useState({ t1: '', t2: '', t3: '' });
  const [notes, setNotes] = useState('');
  const [viewingLoading, setViewingLoading] = useState(false);
  const [viewingDone, setViewingDone] = useState(false);

  // 評價表單
  const [review, setReview] = useState({ rating: 5, wifiRating: 5, content: '' });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewDone, setReviewDone] = useState(hasReviewed);

  const openConversation = async () => {
    if (!isLoggedIn) { router.push('/auth/login'); return; }
    setContactLoading(true);
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId }),
    });
    setContactLoading(false);
    if (res.ok) {
      const conv = await res.json();
      router.push(`/messages/${conv.id}`);
    } else {
      const data = await res.json();
      alert(data.error || '無法開啟對話');
    }
  };

  const submitViewing = async () => {
    if (!times.t1) { alert('請至少填寫一個候選時間'); return; }
    setViewingLoading(true);
    const res = await fetch('/api/viewings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, proposedTime1: times.t1, proposedTime2: times.t2 || undefined, proposedTime3: times.t3 || undefined, notes }),
    });
    setViewingLoading(false);
    if (res.ok) {
      setViewingDone(true);
      setShowViewing(false);
    } else {
      const d = await res.json();
      alert(d.error || '預約失敗');
    }
  };

  const submitReview = async () => {
    if (!review.content.trim()) { alert('請填寫評價內容'); return; }
    setReviewLoading(true);
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, ...review }),
    });
    setReviewLoading(false);
    if (res.ok) {
      setReviewDone(true);
      setShowReview(false);
      router.refresh();
    } else {
      const d = await res.json();
      alert(d.error || '評價提交失敗');
    }
  };

  return (
    <div className="space-y-3 mt-4">
      {/* 租客操作按鈕群 */}
      {isTenant && (
        <>
          <button onClick={openConversation} disabled={contactLoading}
            className="btn-secondary w-full py-2.5 text-sm flex items-center justify-center gap-2">
            {contactLoading ? '…' : <><span>💬</span> 聯絡房東</>}
          </button>

          {!viewingDone ? (
            <button onClick={() => setShowViewing(!showViewing)}
              className="w-full py-2.5 text-sm border-2 border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
              <span>📅</span> 預約看房
            </button>
          ) : (
            <div className="text-center text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl py-2.5">
              ✅ 看房預約已送出，等待房東確認
            </div>
          )}

          {hasApproved && !reviewDone && (
            <button onClick={() => setShowReview(!showReview)}
              className="w-full py-2.5 text-sm border-2 border-yellow-200 text-yellow-700 rounded-xl hover:bg-yellow-50 transition-colors flex items-center justify-center gap-2">
              <span>⭐</span> 撰寫評價
            </button>
          )}
          {/* 申請通過但入住日尚未到 → 顯示提示 */}
          {!hasApproved && pendingMoveInDate && !reviewDone && (
            <div className="text-center text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-xl py-2.5 px-3">
              📅 入住日（{pendingMoveInDate}）後即可撰寫評價
            </div>
          )}
          {reviewDone && (
            <div className="text-center text-xs text-gray-400 py-1">✓ 已評價此房源</div>
          )}
        </>
      )}

      {/* 看房預約表單 */}
      {showViewing && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-blue-800 text-sm">📅 預約看房時間</h4>
          <p className="text-xs text-gray-500">請提供 1~3 個候選時間，房東將從中確認</p>
          {[
            { key: 't1', label: '時間選項 1（必填）' },
            { key: 't2', label: '時間選項 2（選填）' },
            { key: 't3', label: '時間選項 3（選填）' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              {/* suppressHydrationWarning：min 含分鐘，server/client 渲染時間差可能不同 */}
              <input suppressHydrationWarning type="datetime-local" value={times[key as keyof typeof times]}
                onChange={e => setTimes(t => ({ ...t, [key]: e.target.value }))}
                min={new Date().toISOString().slice(0, 16)}
                className="input text-sm py-2" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">備註（選填）</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="例：希望看一樓或頂樓" className="input text-sm resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={submitViewing} disabled={viewingLoading}
              className="btn-primary flex-1 py-2 text-sm">{viewingLoading ? '送出中…' : '送出預約'}</button>
            <button onClick={() => setShowViewing(false)}
              className="btn-secondary flex-1 py-2 text-sm">取消</button>
          </div>
        </div>
      )}

      {/* 評價表單 */}
      {showReview && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-yellow-800 text-sm">⭐ 撰寫評價</h4>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">整體評分</label>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setReview(r => ({ ...r, rating: n }))}
                  className={`text-2xl transition-all ${n <= review.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Wi-Fi 實際表現</label>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setReview(r => ({ ...r, wifiRating: n }))}
                  className={`text-2xl transition-all ${n <= review.wifiRating ? 'text-blue-400' : 'text-gray-300'}`}>📶</button>
              ))}
              <span className="text-xs text-gray-400 ml-2 self-center">{review.wifiRating === 5 ? '完美' : review.wifiRating >= 4 ? '良好' : review.wifiRating >= 3 ? '普通' : '偏慢'}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">評價內容</label>
            <textarea value={review.content} onChange={e => setReview(r => ({ ...r, content: e.target.value }))}
              rows={3} placeholder="分享你的入住體驗…" className="input text-sm resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={submitReview} disabled={reviewLoading}
              className="btn-primary flex-1 py-2 text-sm">{reviewLoading ? '送出中…' : '送出評價'}</button>
            <button onClick={() => setShowReview(false)}
              className="btn-secondary flex-1 py-2 text-sm">取消</button>
          </div>
        </div>
      )}

      {/* 非登入用戶 */}
      {!isLoggedIn && (
        <button onClick={() => router.push('/auth/login')}
          className="btn-secondary w-full py-2.5 text-sm flex items-center justify-center gap-2">
          <span>💬</span> 登入後聯絡房東
        </button>
      )}

      {/* ── 分享區塊 ── */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-2 text-center">分享此房源</p>
        <div className="flex gap-2">
          <button onClick={shareToLine}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-medium transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            LINE 分享
          </button>
          <button onClick={copyLink}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl border transition-colors font-medium ${copied ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {copied ? '✅ 已複製！' : '🔗 複製連結'}
          </button>
        </div>
      </div>
    </div>
  );
}
