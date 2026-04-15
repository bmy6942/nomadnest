'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * 房源列表段落錯誤邊界
 * 當 /listings 及其子路由發生未捕捉錯誤時顯示此頁面。
 */
export default function ListingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 記錄錯誤（不暴露詳細 stack 至 console 以外）
    console.error('[ListingsError]', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-5">🔍</div>
        <h1 className="text-2xl font-bold text-nomad-navy mb-3">房源列表載入失敗</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          房源資料暫時無法取得，請稍後再試。<br />
          您也可以嘗試重新整理或調整篩選條件。
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
          <Link href="/" className="btn-secondary px-8 py-3">
            🏡 回首頁
          </Link>
        </div>
      </div>
    </div>
  );
}
