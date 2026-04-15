'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-5">⚠️</div>
        <h1 className="text-2xl font-bold text-nomad-navy mb-3">發生了一點問題</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          系統發生非預期的錯誤，我們已記錄此問題。<br />
          請嘗試重新載入，或稍後再試。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={reset} className="btn-primary px-8 py-3">🔄 重新嘗試</button>
          <Link href="/" className="btn-secondary px-8 py-3">🏡 回首頁</Link>
        </div>
        {process.env.NODE_ENV === 'development' && error.message && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">開發模式：錯誤詳情</summary>
            <pre className="mt-2 text-xs text-red-600 bg-red-50 p-3 rounded-lg overflow-auto max-h-40">{error.message}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
