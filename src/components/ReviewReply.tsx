'use client';
import { useState } from 'react';

type Props = {
  reviewId: string;
  existingReply?: string | null;
  isOwner: boolean;
};

export default function ReviewReply({ reviewId, existingReply, isOwner }: Props) {
  const [reply, setReply] = useState(existingReply ?? '');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(!!existingReply);
  const [displayReply, setDisplayReply] = useState(existingReply ?? '');
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    if (!reply.trim()) return;
    setSaveError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerReply: reply.trim() }),
      });
      if (res.ok) {
        setDisplayReply(reply.trim());
        setSaved(true);
        setEditing(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || '回覆儲存失敗，請稍後再試');
      }
    } catch {
      setSaveError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('確定要刪除此回覆嗎？')) return;
    setSaveError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || '刪除失敗，請稍後再試');
        return;
      }
      setDisplayReply('');
      setReply('');
      setSaved(false);
      setEditing(false);
    } catch {
      setSaveError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 顯示現有回覆（非房東模式）
  if (!isOwner) {
    if (!displayReply) return null;
    return (
      <div className="mt-3 bg-blue-50 border-l-4 border-blue-300 rounded-r-xl p-3">
        <p className="text-xs font-semibold text-blue-700 mb-1">🏠 房東回覆</p>
        <p className="text-sm text-gray-700">{displayReply}</p>
      </div>
    );
  }

  // 房東模式
  return (
    <div className="mt-3">
      {saved && !editing && (
        <div className="bg-blue-50 border-l-4 border-blue-300 rounded-r-xl p-3 mb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-1">🏠 您的回覆</p>
              <p className="text-sm text-gray-700">{displayReply}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { setReply(displayReply); setEditing(true); }}
                className="text-xs text-blue-500 hover:underline">編輯</button>
              <button onClick={handleDelete} disabled={loading}
                className="text-xs text-red-400 hover:underline">刪除</button>
            </div>
          </div>
        </div>
      )}

      {!saved && !editing && (
        <button onClick={() => setEditing(true)}
          className="text-xs text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
          ✏ 回覆此評價
        </button>
      )}

      {editing && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <p className="text-xs font-medium text-gray-600 mb-2">回覆租客評價（最多 500 字）</p>
          <textarea
            value={reply}
            onChange={e => { setReply(e.target.value); setSaveError(''); }}
            maxLength={500}
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="感謝您的入住，很高興您喜歡這個空間..."
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs ${reply.length > 450 ? 'text-amber-500' : 'text-gray-400'}`}>{reply.length}/500</span>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setReply(displayReply); setSaveError(''); }}
                className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                取消
              </button>
              <button onClick={handleSave} disabled={loading || !reply.trim()}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? '儲存中...' : '發布回覆'}
              </button>
            </div>
          </div>
          {/* 錯誤訊息（儲存/刪除失敗時顯示） */}
          {saveError && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 flex items-center justify-between">
              <span>{saveError}</span>
              <button onClick={() => setSaveError('')} className="ml-2 text-red-400 hover:text-red-600 leading-none">×</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
