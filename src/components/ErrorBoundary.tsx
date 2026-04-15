'use client';

/**
 * ErrorBoundary — React 錯誤邊界
 *
 * 功能：
 *  1. 捕獲子樹的 React 渲染錯誤（JS exceptions in render / lifecycle）
 *  2. 顯示友善的錯誤回復 UI，讓使用者可以嘗試重試
 *  3. 自動將錯誤上報到 /api/errors 端點（非同步，不阻塞 UI）
 *  4. 開發環境顯示完整 stack trace
 *
 * 使用方式：
 *   <ErrorBoundary fallback={<p>出錯了</p>}>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 * 注意：
 *  - ErrorBoundary 必須是 Class Component（React 僅支援 class-based error boundary）
 *  - 不捕獲：事件處理器錯誤、非同步程式碼（use useEffect 中的 async）、SSR 錯誤
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children:  ReactNode;
  fallback?: ReactNode;          // 自訂 fallback UI
  onError?:  (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError:   boolean;
  error:      Error | null;
  errorInfo:  ErrorInfo | null;
  reported:   boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, reported: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ errorInfo: info });
    this.props.onError?.(error, info);

    // 非同步上報錯誤（fire-and-forget，不影響 UI）
    this.reportError(error, info).catch(() => {/* 靜默忽略上報失敗 */});
  }

  private async reportError(error: Error, info: ErrorInfo): Promise<void> {
    if (this.state.reported) return;
    this.setState({ reported: true });

    try {
      await fetch('/api/errors', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack:   error.stack,
          context: info.componentStack?.slice(0, 500),
          url:     typeof window !== 'undefined' ? window.location.pathname : '',
        }),
        keepalive: true,
      });
    } catch {
      // 上報失敗不影響使用者體驗，靜默忽略
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, reported: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // 自訂 fallback UI
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const isDev = process.env.NODE_ENV !== 'production';
    const { error, errorInfo } = this.state;

    // 預設錯誤 UI
    return (
      <div
        role="alert"
        className="min-h-[200px] flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-xl m-4 text-center"
      >
        {/* 錯誤圖示 */}
        <div className="text-5xl mb-4">⚠️</div>

        {/* 標題 */}
        <h2 className="text-xl font-bold text-red-800 mb-2">
          發生了一個錯誤
        </h2>
        <p className="text-red-600 mb-1 text-sm">
          Something went wrong
        </p>

        {/* 錯誤訊息（僅開發環境顯示） */}
        {isDev && error && (
          <div className="mt-4 mb-4 text-left w-full max-w-2xl">
            <p className="text-sm font-mono bg-red-100 text-red-900 p-3 rounded border border-red-300 break-all">
              {error.message}
            </p>
            {errorInfo?.componentStack && (
              <details className="mt-2">
                <summary className="text-xs text-red-700 cursor-pointer hover:underline">
                  Component Stack
                </summary>
                <pre className="mt-1 text-xs font-mono bg-red-100 text-red-800 p-3 rounded border border-red-300 overflow-auto max-h-48 whitespace-pre-wrap">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* 操作按鈕 */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            🔄 重試 / Retry
          </button>
          <button
            onClick={() => typeof window !== 'undefined' && window.location.reload()}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
          >
            🏠 重新整理 / Reload
          </button>
        </div>

        <p className="mt-4 text-xs text-red-500">
          此錯誤已自動回報，我們會盡快修復。
          <br />
          This error has been automatically reported.
        </p>
      </div>
    );
  }
}

/**
 * withErrorBoundary — HOC 包裝器，快速為任意元件加上 ErrorBoundary
 *
 * @example
 *   export default withErrorBoundary(MyComponent);
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
): React.ComponentType<P> {
  const Wrapped = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `withErrorBoundary(${Component.displayName ?? Component.name ?? 'Component'})`;
  return Wrapped;
}
