'use client';
import { useEffect } from 'react';

/** Service Worker 自動註冊（PWA） — Client Component */
export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(r => console.log('[SW] 已註冊:', r.scope))
        .catch(e => console.warn('[SW] 註冊失敗:', e));
    }
  }, []);
  return null;
}
