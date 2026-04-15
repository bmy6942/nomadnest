'use client';

/**
 * PushNotificationManager
 *
 * 嵌入「帳號設定」或通知設定頁面的推播通知訂閱 UI
 * - 顯示當前訂閱狀態
 * - 提供「開啟通知」/ 「關閉通知」按鈕
 * - 處理 NotificationPermission 狀態（default / granted / denied）
 * - 訂閱/取消訂閱後同步至 /api/push/subscribe
 *
 * 使用方式：
 *   <PushNotificationManager />
 *
 * 必須在已登入的頁面使用（會呼叫 /api/push/subscribe）
 */

import { useEffect, useState, useCallback } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

// ── 工具函式 ──────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from(Array.from(raw).map(c => c.charCodeAt(0)));
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.find(r => r.active?.scriptURL.includes('sw.js')) ?? null;
  } catch {
    return null;
  }
}

async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const reg = await getServiceWorkerRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

// ── 狀態 icon ──────────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: 'on' | 'off' | 'denied' | 'loading' | 'unsupported' }) {
  if (status === 'loading') {
    return <span className="w-4 h-4 border-2 border-gray-300 border-t-nomad-navy rounded-full animate-spin inline-block" />;
  }
  if (status === 'on')          return <span className="text-green-500">🔔</span>;
  if (status === 'denied')      return <span className="text-red-400">🔕</span>;
  if (status === 'unsupported') return <span className="text-gray-400">💻</span>;
  return <span className="text-gray-400">🔕</span>;
}

// ── 主組件 ────────────────────────────────────────────────────────────────────
type PushStatus = 'loading' | 'unsupported' | 'denied' | 'on' | 'off';

interface Props {
  className?: string;
}

export default function PushNotificationManager({ className = '' }: Props) {
  const [status,    setStatus]    = useState<PushStatus>('loading');
  const [saving,    setSaving]    = useState(false);
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null);

  // ── 初始化：偵測支援程度 + 當前訂閱狀態 ───────────────────────────────────
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    getCurrentSubscription().then(sub => {
      setStatus(sub ? 'on' : 'off');
    }).catch(() => setStatus('off'));
  }, []);

  // ── 訂閱推播 ──────────────────────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    setErrorMsg(null);
    setSaving(true);
    try {
      // 1. 請求通知權限
      const permission = await Notification.requestPermission();
      if (permission === 'denied') { setStatus('denied'); return; }
      if (permission !== 'granted') { setSaving(false); return; }

      // 2. 取得 SW registration
      const reg = await getServiceWorkerRegistration();
      if (!reg) {
        setErrorMsg('請重新整理後再試（Service Worker 未就緒）');
        setSaving(false);
        return;
      }

      // 3. 向瀏覽器訂閱
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      // 4. 儲存至伺服器
      const res = await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? '伺服器儲存失敗');
      }

      setStatus('on');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知錯誤';
      setErrorMsg(msg);
      setStatus('off');
    } finally {
      setSaving(false);
    }
  }, []);

  // ── 取消訂閱 ──────────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    setErrorMsg(null);
    setSaving(true);
    try {
      const sub = await getCurrentSubscription();
      if (!sub) { setStatus('off'); return; }

      const endpoint = sub.endpoint;

      // 1. 瀏覽器端取消
      await sub.unsubscribe();

      // 2. 通知伺服器刪除
      await fetch('/api/push/subscribe', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ endpoint }),
      }).catch(() => {}); // 靜默處理

      setStatus('off');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '取消失敗';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }, []);

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-4 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon status={status} />
            <h3 className="font-semibold text-gray-900 text-sm">推播通知</h3>
            {status === 'on' && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">已開啟</span>
            )}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            {status === 'unsupported' && '你的瀏覽器不支援推播通知，請使用 Chrome 或 Firefox。'}
            {status === 'denied'      && '通知權限已被封鎖。請在瀏覽器設定中手動開啟本站通知。'}
            {status === 'on'          && '當有新訊息、申請狀態更新時，你將收到即時通知。'}
            {status === 'off'         && '開啟後，訊息、申請、合約更新將即時推送到你的裝置。'}
            {status === 'loading'     && '正在偵測通知狀態⋯'}
          </p>

          {errorMsg && (
            <p className="text-xs text-red-500 mt-1.5 bg-red-50 px-2 py-1 rounded-lg">
              ⚠️ {errorMsg}
            </p>
          )}
        </div>

        {/* 開關按鈕 */}
        {(status === 'on' || status === 'off') && (
          <button
            onClick={status === 'on' ? unsubscribe : subscribe}
            disabled={saving}
            className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-50
              ${status === 'on'
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'bg-nomad-navy text-white hover:bg-nomad-navy/90'
              }`}
          >
            {saving ? '處理中⋯' : status === 'on' ? '關閉通知' : '開啟通知'}
          </button>
        )}
      </div>

      {/* denied 的操作指引 */}
      {status === 'denied' && (
        <div className="mt-3 bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
          <p className="font-semibold mb-1">如何重新開啟通知：</p>
          <p>Chrome：網址列左側鎖頭圖示 → 通知 → 允許</p>
        </div>
      )}
    </div>
  );
}
