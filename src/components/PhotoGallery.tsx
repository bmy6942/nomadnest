'use client';
import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';

interface Props {
  images: string[];
  title?: string;
}

export default function PhotoGallery({ images, title = '' }: Props) {
  const [current, setCurrent]     = useState(0);
  const [lightbox, setLightbox]   = useState(false);
  const [lbIndex, setLbIndex]     = useState(0);
  const [imgError, setImgError]   = useState<Record<number, boolean>>({});

  const total = images.length;

  const prev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrent(c => (c - 1 + total) % total);
  }, [total]);

  const next = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrent(c => (c + 1) % total);
  }, [total]);

  const lbPrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLbIndex(i => (i - 1 + total) % total);
  }, [total]);

  const lbNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLbIndex(i => (i + 1) % total);
  }, [total]);

  const openLightbox = (idx: number) => {
    setLbIndex(idx);
    setLightbox(true);
  };

  // 鍵盤支援
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  lbPrev();
      if (e.key === 'ArrowRight') lbNext();
      if (e.key === 'Escape')     setLightbox(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [lightbox, lbPrev, lbNext]);

  // 防止 body scroll 在 lightbox 開啟時
  useEffect(() => {
    document.body.style.overflow = lightbox ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightbox]);

  if (total === 0) {
    return (
      <div className="rounded-2xl overflow-hidden h-72 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-5xl mb-2">🏠</div>
          <div className="text-sm">尚無照片</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── 主畫廊 ── */}
      <div className="mb-4">
        {/* 主圖區 — 外層 div 負責尺寸與 group hover；
            箭頭 button 與主圖 button 並排（兄弟），避免 button > button 違規 */}
        <div
          className="relative rounded-2xl overflow-hidden bg-gray-200 group w-full"
          style={{ height: '380px' }}
        >
          {/* 點擊放大按鈕（inset-0 覆蓋全圖區域） */}
          <button
            type="button"
            aria-label={`View full size: ${title} photo ${current + 1} of ${total}`}
            className="absolute inset-0 w-full h-full cursor-pointer"
            onClick={() => openLightbox(current)}>
            {!imgError[current] ? (
              <Image
                src={images[current]}
                alt={`${title} - 照片 ${current + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 800px"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                priority={current === 0}
                onError={() => setImgError(p => ({ ...p, [current]: true }))}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <div className="text-center"><div className="text-4xl mb-2">🖼</div><div className="text-sm">圖片載入失敗</div></div>
              </div>
            )}

            {/* 放大提示 */}
            <div className="absolute top-3 right-3 bg-black/40 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm pointer-events-none">
              🔍 點擊放大
            </div>

            {/* 計數 — aria-live 讓螢幕閱讀器在切換照片時宣告 */}
            <div
              aria-live="polite"
              aria-atomic="true"
              className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm pointer-events-none">
              {current + 1} / {total}
            </div>
          </button>

          {/* 左右箭頭 — 與主圖按鈕同層（sibling），不巢狀在 button 內 */}
          {total > 1 && (
            <>
              <button
                onClick={prev}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 text-gray-800 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none z-10">
                <span aria-hidden="true">‹</span>
              </button>
              <button
                onClick={next}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 text-gray-800 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none z-10">
                <span aria-hidden="true">›</span>
              </button>
            </>
          )}
        </div>

        {/* 縮圖列 */}
        {total > 1 && (
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => { setCurrent(i); }}
                aria-label={`View photo ${i + 1}`}
                aria-pressed={i === current}
                className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all relative focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${i === current ? 'border-blue-500 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                <Image src={img} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
            {total > 5 && (
              <button
                onClick={() => openLightbox(0)}
                className="shrink-0 w-16 h-12 rounded-lg bg-gray-900/70 flex items-center justify-center text-white text-xs font-bold">
                全部
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title ? `${title} — Photo viewer` : 'Photo viewer'}
          className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
          onClick={() => setLightbox(false)}>

          {/* 頂部控制列 */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
            <div aria-live="polite" aria-atomic="true" className="text-white/70 text-sm">
              {title && <span className="font-medium text-white">{title}</span>}
              &nbsp;{lbIndex + 1} / {total}
            </div>
            <button
              onClick={() => setLightbox(false)}
              aria-label="Close image viewer"
              className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors text-lg focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {/* 主圖區 */}
          <div className="flex-1 flex items-center justify-center relative px-16 min-h-0" onClick={e => e.stopPropagation()}>
            {/* ✅ 保留 <img>：lightbox 需要 object-contain + 自動寬高，<Image fill> 不適合此場景 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[lbIndex]}
              alt=""
              loading="lazy"
              className="max-h-full max-w-full object-contain rounded-lg select-none"
              style={{ maxHeight: 'calc(100vh - 180px)' }}
            />

            {total > 1 && (
              <>
                <button
                  onClick={lbPrev}
                  aria-label="Previous photo"
                  className="absolute left-3 w-11 h-11 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white text-2xl transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
                  <span aria-hidden="true">‹</span>
                </button>
                <button
                  onClick={lbNext}
                  aria-label="Next photo"
                  className="absolute right-3 w-11 h-11 bg-white/10 hover:bg-white/25 rounded-full flex items-center justify-center text-white text-2xl transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
                  <span aria-hidden="true">›</span>
                </button>
              </>
            )}
          </div>

          {/* 底部縮圖列 */}
          {total > 1 && (
            <div className="shrink-0 flex gap-2 px-4 py-3 overflow-x-auto justify-center" onClick={e => e.stopPropagation()}>
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setLbIndex(i)}
                  aria-label={`View photo ${i + 1}`}
                  aria-pressed={i === lbIndex}
                  className={`shrink-0 w-14 h-10 rounded-md overflow-hidden border-2 transition-all relative focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none ${i === lbIndex ? 'border-white' : 'border-transparent opacity-50 hover:opacity-80'}`}>
                  <Image src={img} alt="" fill sizes="56px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
