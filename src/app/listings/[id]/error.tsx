'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * 房源詳情段落錯誤邊界
 * 當 /listings/[id] 發生未捕捉錯誤時顯示此頁面。
 */
export default function ListingDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ListingDetailError]', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-5">🏠</div>
        <h1 className="text-2xl font-bold text-nomad-navy mb-3">房源載入失敗</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          此房源資料暫時無法取得。<br />
          可能是網路問題或房源已下架，請稍後再試。
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-6">錯誤 ID：{error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-primary px-8 py-3"
          >
            🔄 重新嘗試
          </button>
          <Link href="/listings" className="btn-secondary px-8 py-3">
            ← 返回房源列表
          </Link>
        </div>
      </div>
    </div>
  );
}
