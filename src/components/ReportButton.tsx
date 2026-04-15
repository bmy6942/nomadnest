'use client';
import { useState, useEffect } from 'react';

interface Props {
  targetType: 'listing' | 'message' | 'user';
  targetId: string;
  label?: string;          // 按鈕文字（預設 🚩 檢舉）
  className?: string;
}

export default function ReportButton({ targetType, targetId, label, className }: Props) {
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && reasons.length === 0) {
      fetch(`/api/reports?type=${targetType}`)
        .then(r => r.json())
        .then(d => { if (d.reasons) { setReasons(d.reasons); setSelected(d.reasons[0]); } });
    }
  }, [open, targetType, reasons.length]);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, reason: selected, detail }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); }, 2000);
    } else if (data.alreadyReported) {
      setError('您已對此內容提出過檢舉');
    } else if (res.status === 401) {
      setError('請先登入才能檢舉');
    } else {
      setError('提交失敗，請稍後再試');
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className || 'text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1'}>
        🚩 {label ?? '檢舉'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            {done ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="font-semibold text-gray-800">檢舉已提交</h3>
                <p className="text-sm text-gray-500 mt-1">感謝你的回報，管理員將盡快處理</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">🚩 提交檢舉</h3>
                  <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">檢舉原因</label>
                  <div className="space-y-2">
                    {reasons.map(r => (
                      <label key={r} className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" name="reason" value={r} checked={selected === r}
                          onChange={() => setSelected(r)}
                          className="accent-red-500 shrink-0" />
                        <span className={`text-sm transition-colors ${selected === r ? 'text-red-600 font-medium' : 'text-gray-700 group-hover:text-gray-900'}`}>{r}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">補充說明（選填）</label>
                  <textarea value={detail} onChange={e => setDetail(e.target.value)}
                    rows={3} maxLength={300}
                    placeholder="請描述具體情形，協助我們更快速處理..."
                    className="input text-sm resize-none" />
                  <p className="text-xs text-gray-400 text-right mt-1">{detail.length}/300</p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5 mb-4">
                    ⚠ {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setOpen(false)} className="btn-secondary flex-1">取消</button>
                  <button onClick={submit} disabled={!selected || submitting}
                    className="btn-danger flex-1 disabled:opacity-50">
                    {submitting ? '提交中...' : '確認檢舉'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
