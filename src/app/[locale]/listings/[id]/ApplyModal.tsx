'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ApplyModal({ listingId, listingTitle, isLoggedIn, isSameUser }: {
  listingId: string; listingTitle: string; isLoggedIn: boolean; isSameUser: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ message: '', moveInDate: '', duration: '1' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const submit = async () => {
    if (!form.message || !form.moveInDate) { setError('請填寫所有欄位'); return; }
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

  if (isSameUser) return <div className="bg-gray-100 text-gray-500 text-center py-3 rounded-xl text-sm">這是您刊登的房源</div>;

  if (!isLoggedIn) return (
    <a href="/auth/login" className="btn-primary w-full text-center block py-3 rounded-xl">登入後申請看房</a>
  );

  if (success) return (
    <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-center">
      <div className="text-2xl mb-2">🎉</div>
      <div className="font-semibold">申請已送出！</div>
      <div className="text-xs mt-1">房東將在 24 小時內回覆您</div>
      <button onClick={() => router.push('/dashboard')} className="mt-3 text-xs text-green-600 underline">查看我的申請 →</button>
    </div>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary w-full py-3 rounded-xl text-base font-semibold">
        📩 申請看房 / 租屋
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-nomad-navy">申請租屋</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm text-blue-800">
              <strong>{listingTitle}</strong>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">預計入住日期 *</label>
                {/* suppressHydrationWarning：min 依當天日期，server/client 毫秒差不影響日期但保險起見 */}
                <input suppressHydrationWarning type="date" value={form.moveInDate}
                  onChange={e => setForm(f => ({ ...f, moveInDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]} className="input" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">預計租期（月）*</label>
                <select value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className="input">
                  {[1,2,3,4,5,6,12].map(n => <option key={n} value={n}>{n} 個月</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">自我介紹 / 留言給房東 *</label>
                <textarea rows={4} value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="簡短介紹你的工作類型、作息習慣，讓房東更了解你..."
                  className="input resize-none" />
                <div className="text-xs text-gray-400 text-right">{form.message.length}/200</div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button onClick={() => setOpen(false)} className="btn-secondary flex-1">取消</button>
              <button onClick={submit} disabled={loading} className="btn-primary flex-1">
                {loading ? '送出中...' : '確認送出申請'}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">申請成功後平台將向您收取服務費（半個月租金）</p>
          </div>
        </div>
      )}
    </>
  );
}
