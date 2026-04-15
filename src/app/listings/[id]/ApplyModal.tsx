'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * ApplyModal — 租屋申請 Dialog
 *
 * WCAG 2.1 AA 合規：
 *  - role="dialog" + aria-modal="true" + aria-labelledby
 *  - Focus trap：Tab / Shift+Tab 在 dialog 內循環，不洩漏至背景
 *  - Esc 鍵關閉
 *  - 開啟時 focus 第一個可互動元素；關閉後 focus 回觸發按鈕
 *  - 所有 input/select/textarea 有 htmlFor/id 配對
 *  - 錯誤訊息用 role="alert" + aria-live="assertive"
 *  - 字元計數用 aria-live="polite" 讓螢幕閱讀器即時播報
 */
export default function ApplyModal({ listingId, listingTitle, isLoggedIn, isSameUser }: {
  listingId: string; listingTitle: string; isLoggedIn: boolean; isSameUser: boolean;
}) {
  const [open, setOpen]         = useState(false);
  const [form, setForm]         = useState({ message: '', moveInDate: '', duration: '1' });
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState('');
  const router                  = useRouter();

  // Focus refs
  const triggerRef  = useRef<HTMLButtonElement>(null);
  const dialogRef   = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);

  // ── Focus trap ──────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;

    // Esc 關閉
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (e.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      // Shift+Tab — 若在第一個元素則跳到最後
      if (document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
    } else {
      // Tab — 若在最後一個元素則跳回第一個
      if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }, [open]);

  // 開啟：綁定 focus trap；關閉：解綁並 focus 回觸發按鈕
  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      // 稍延遲確保 DOM 已渲染
      const t = setTimeout(() => firstFocusRef.current?.focus(), 50);
      return () => {
        clearTimeout(t);
        document.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.removeEventListener('keydown', handleKeyDown);
      // 關閉後 focus 回觸發按鈕
      setTimeout(() => triggerRef.current?.focus(), 50);
    }
  }, [open, handleKeyDown]);

  const closeModal = () => setOpen(false);

  const submit = async () => {
    if (!form.moveInDate) { setError('請填寫預計入住日期'); return; }
    if (!form.message.trim()) { setError('請填寫自我介紹 / 留言'); return; }
    if (form.message.trim().length < 10) { setError('申請說明至少需要 10 個字元'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, ...form }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) { setSuccess(true); }
    else { setError(data.error || '申請失敗'); }
  };

  if (isSameUser) {
    return (
      <div className="bg-gray-100 text-gray-600 text-center py-3 rounded-xl text-sm">
        這是您刊登的房源
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <a
        href="/auth/login"
        className="btn-primary w-full text-center block py-3 rounded-xl"
        aria-label="前往登入頁面，登入後即可申請看房"
      >
        登入後申請看房
      </a>
    );
  }

  if (success) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-center"
      >
        <div className="text-2xl mb-2" aria-hidden="true">🎉</div>
        <div className="font-semibold">申請已送出！</div>
        <div className="text-xs mt-1">房東將在 24 小時內回覆您</div>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-3 text-xs text-green-600 underline focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:outline-none rounded"
        >
          查看我的申請 →
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 觸發按鈕：保留 ref 以在 modal 關閉後回歸焦點 */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="btn-primary w-full py-3 rounded-xl text-base font-semibold"
      >
        <span aria-hidden="true">📩</span>{' '}申請看房 / 租屋
      </button>

      {/* ── Dialog overlay ── */}
      {open && (
        /* 點擊背景關閉（role="presentation" 讓 AT 不播報 overlay） */
        <div
          role="presentation"
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          {/* ── Dialog panel ── */}
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-modal-title"
            aria-describedby="apply-modal-desc"
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 id="apply-modal-title" className="font-bold text-lg text-nomad-navy">
                申請租屋
              </h2>
              <button
                onClick={closeModal}
                aria-label="關閉申請對話框"
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 rounded focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            {/* 房源名稱描述 */}
            <div
              id="apply-modal-desc"
              className="bg-blue-50 rounded-xl p-3 mb-4 text-sm text-blue-800"
              aria-label={`申請房源：${listingTitle}`}
            >
              <strong>{listingTitle}</strong>
            </div>

            {/* 錯誤訊息 */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4"
              >
                {error}
              </div>
            )}

            {/* 表單欄位 */}
            <div className="space-y-4">
              {/* 入住日期 */}
              <div>
                <label
                  htmlFor="apply-move-in-date"
                  className="text-sm font-medium text-gray-700 block mb-1"
                >
                  預計入住日期
                  <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
                  <span className="sr-only">（必填）</span>
                </label>
                {/* suppressHydrationWarning：min 依當天日期，server/client 毫秒差不影響日期 */}
                <input
                  ref={firstFocusRef}
                  id="apply-move-in-date"
                  suppressHydrationWarning
                  type="date"
                  value={form.moveInDate}
                  onChange={e => setForm(f => ({ ...f, moveInDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  aria-required="true"
                  className="input"
                />
              </div>

              {/* 租期 */}
              <div>
                <label
                  htmlFor="apply-duration"
                  className="text-sm font-medium text-gray-700 block mb-1"
                >
                  預計租期
                  <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
                  <span className="sr-only">（必填）</span>
                </label>
                <select
                  id="apply-duration"
                  value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                  required
                  aria-required="true"
                  className="input"
                >
                  {[1,2,3,4,5,6,12].map(n => (
                    <option key={n} value={n}>{n} 個月</option>
                  ))}
                </select>
              </div>

              {/* 留言 */}
              <div>
                <label
                  htmlFor="apply-message"
                  className="text-sm font-medium text-gray-700 block mb-1"
                >
                  自我介紹 / 留言給房東
                  <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
                  <span className="sr-only">（必填，至少 10 字，上限 500 字）</span>
                </label>
                <textarea
                  id="apply-message"
                  rows={4}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value.slice(0, 500) }))}
                  placeholder="簡短介紹你的工作類型、作息習慣，讓房東更了解你..."
                  required
                  aria-required="true"
                  aria-describedby="apply-message-count"
                  maxLength={500}
                  className="input resize-none"
                />
                {/* aria-live="polite" 讓螢幕閱讀器在使用者暫停輸入後播報計數 */}
                <div
                  id="apply-message-count"
                  aria-live="polite"
                  aria-atomic="true"
                  className="flex items-center justify-between mt-0.5"
                >
                  {form.message.trim().length > 0 && form.message.trim().length < 10 ? (
                    <span className="text-xs text-red-500">還需 {10 - form.message.trim().length} 個字元</span>
                  ) : form.message.trim().length >= 10 ? (
                    <span className="text-xs text-green-600">✓</span>
                  ) : (
                    <span />
                  )}
                  <span className={`text-xs ${form.message.length > 450 ? 'text-amber-500' : 'text-gray-400'}`}>
                    {form.message.length}/500 字
                  </span>
                </div>
              </div>
            </div>

            {/* 操作按鈕 */}
            <div className="mt-5 flex gap-3">
              <button
                onClick={closeModal}
                className="btn-secondary flex-1"
                aria-label="取消申請，關閉對話框"
              >
                取消
              </button>
              <button
                onClick={submit}
                disabled={loading}
                aria-disabled={loading}
                aria-label={loading ? '申請送出中，請稍候' : '確認送出租屋申請'}
                className="btn-primary flex-1"
              >
                {loading ? '送出中…' : '確認送出申請'}
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center mt-3">
              申請成功後平台將向您收取服務費（半個月租金）
            </p>
          </div>
        </div>
      )}
    </>
  );
}
