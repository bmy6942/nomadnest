'use client';
import { useRef, useState } from 'react';

interface Props {
  images: string[];           // 目前的圖片 URL 陣列
  onChange: (urls: string[]) => void;
  maxImages?: number;
  folder?: 'listings' | 'avatars' | 'docs';
}

// ✅ 客戶端 MIME type 白名單（與伺服器端保持一致）
// <input accept> 只是瀏覽器提示，拖曳上傳可完全繞過，需在 handleFiles 主動驗證
const CLIENT_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const CLIENT_MAX_SIZE = 5 * 1024 * 1024; // 5MB — 與伺服器端同步

export default function ImageUploader({
  images,
  onChange,
  maxImages = 5,
  folder = 'listings',
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = maxImages - images.length;
    if (remaining <= 0) { setError(`最多只能上傳 ${maxImages} 張圖片`); return; }

    const toUpload = Array.from(files).slice(0, remaining);

    // ✅ 客戶端預先驗證：拖曳上傳可完全繞過 <input accept>，需主動檢查
    for (const f of toUpload) {
      if (!CLIENT_ALLOWED_TYPES.has(f.type)) {
        setError(`「${f.name}」格式不支援（僅限 JPG / PNG / WebP / GIF）`);
        return;
      }
      if (f.size > CLIENT_MAX_SIZE) {
        setError(`「${f.name}」超過 5MB 上限（${(f.size / 1024 / 1024).toFixed(1)}MB）`);
        return;
      }
    }

    setUploading(true);
    setError('');

    const fd = new FormData();
    toUpload.forEach(f => fd.append('files', f));
    fd.append('folder', folder);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        onChange([...images, ...data.urls]);
      } else {
        setError(data.error || '上傳失敗，請稍後再試');
      }
    } catch {
      setError('網路錯誤，請重試');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /** 刪除圖片：先從 Storage 刪除，再更新本地狀態 */
  const removeImage = async (idx: number) => {
    const url = images[idx];
    // 只刪 Supabase Storage 上的圖片（種子資料 Unsplash 圖片不刪）
    if (url && url.includes('supabase.co')) {
      try {
        await fetch('/api/upload/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
      } catch {
        // 刪除失敗不阻擋 UI 更新（最終一致性）
        console.warn('[ImageUploader] 無法從 Storage 刪除圖片:', url);
      }
    }
    onChange(images.filter((_, i) => i !== idx));
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= images.length) return;
    const arr = [...images];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    onChange(arr);
  };

  return (
    <div>
      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {images.map((url, i) => (
            <div key={url} className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`上傳圖片 ${i + 1}${i === 0 ? '（封面）' : ''}`} loading="lazy" className="w-full h-full object-cover" />
              {/* Overlay actions */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => moveImage(i, -1)}
                    aria-label={`Move image ${i + 1} left`}
                    className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center text-sm hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none">
                    <span aria-hidden="true">◀</span>
                  </button>
                )}
                {i < images.length - 1 && (
                  <button
                    type="button"
                    onClick={() => moveImage(i, 1)}
                    aria-label={`Move image ${i + 1} right`}
                    className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center text-sm hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none">
                    <span aria-hidden="true">▶</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label={`Remove image ${i + 1}`}
                  className="w-9 h-9 bg-red-500 rounded-full flex items-center justify-center text-sm text-white hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none">
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
              {i === 0 && (
                <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-medium" aria-hidden="true">封面</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload area — role="button" 讓鍵盤使用者可以用 Enter/Space 觸發 */}
      {images.length < maxImages && (
        <div
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-label={uploading ? 'Uploading images, please wait' : `Upload images. ${images.length} of ${maxImages} uploaded.`}
          aria-disabled={uploading}
          onClick={() => !uploading && fileRef.current?.click()}
          onKeyDown={e => {
            if (!uploading && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
            uploading
              ? 'border-blue-300 bg-blue-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          {uploading ? (
            <div className="text-gray-500">
              <div className="text-2xl mb-2">⏳</div>
              <p className="text-sm">上傳至雲端中，請稍候...</p>
            </div>
          ) : (
            <div className="text-gray-400">
              <div className="text-3xl mb-2">📷</div>
              <p className="text-sm font-medium text-gray-600">點擊或拖曳圖片至此</p>
              <p className="text-xs mt-1">支援 JPG / PNG / WebP，單檔最大 5MB，最多 {maxImages} 張</p>
              <p className="text-xs text-gray-400 mt-0.5">已上傳 {images.length} / {maxImages} 張</p>
            </div>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        aria-label="Select image files to upload"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {error && (
        <p role="alert" aria-live="assertive" className="text-xs text-red-500 mt-2">⚠ {error}</p>
      )}
      {images.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          提示：滑鼠移到圖片可調整順序或刪除，第一張為封面照
        </p>
      )}
    </div>
  );
}
