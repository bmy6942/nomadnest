'use client';

/**
 * global-error.tsx — 根層級錯誤邊界
 *
 * 當 RootLayout 本身崩潰時觸發（例如 i18n provider、Navbar 等拋出未捕捉的錯誤）。
 * 注意：此元件必須提供完整的 <html><body> 結構，因為 RootLayout 已不可用。
 * 參考：https://nextjs.org/docs/app/api-reference/file-conventions/error#global-errorjs
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 不依賴 logger（因為此時 server utilities 可能也不可用）
  if (typeof console !== 'undefined') {
    console.error('[GlobalError]', error.digest ?? error.message, error);
  }

  return (
    <html lang="zh-TW">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f9fafb' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '480px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🚨</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f2033', marginBottom: '0.75rem' }}>
              應用程式發生嚴重錯誤
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              系統發生非預期的問題，請嘗試重新載入頁面。<br />
              若問題持續發生，請聯絡客服並提供以下錯誤編號。
            </p>
            {error.digest && (
              <p style={{
                fontSize: '0.75rem', color: '#9ca3af',
                fontFamily: 'monospace', marginBottom: '1.5rem',
              }}>
                錯誤 ID：{error.digest}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.625rem 1.5rem',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                🔄 重新嘗試
              </button>
              <a
                href="/"
                style={{
                  padding: '0.625rem 1.5rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '0.75rem',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                🏡 回首頁
              </a>
            </div>
            {process.env.NODE_ENV === 'development' && error.message && (
              <details style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                <summary style={{ fontSize: '0.75rem', color: '#9ca3af', cursor: 'pointer' }}>
                  開發模式：錯誤詳情
                </summary>
                <pre style={{
                  marginTop: '0.5rem', fontSize: '0.7rem', color: '#dc2626',
                  background: '#fef2f2', padding: '0.75rem', borderRadius: '0.5rem',
                  overflow: 'auto', maxHeight: '10rem',
                }}>
                  {error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
