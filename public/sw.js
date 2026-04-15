/**
 * NomadNest Taiwan — Service Worker v3
 *
 * 快取策略：
 *   靜態資源（JS/CSS/fonts/icons/_next/image）→ Cache-First（長效快取）
 *   HTML 頁面                                  → Network-First（內容最新）
 *   API 呼叫                                   → Network-Only（動態資料不快取）
 *   離線時                                     → 顯示 /offline.html
 *   Push Notification                          → 系統推播通知
 *
 * v3 改善項目：
 *   - /_next/image 優化路由加入靜態快取白名單
 *   - 離線 API 錯誤回應改為中英雙語
 *   - 新增 SW 更新就緒後的 postMessage 通知（讓 UI 顯示「有新版本」）
 *   - 修正 activate 清除邏輯（同時清除舊版 STATIC 與 PAGE cache）
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE  = `nomadnest-static-${CACHE_VERSION}`;
const PAGE_CACHE    = `nomadnest-pages-${CACHE_VERSION}`;

// 預先快取的核心資源（install 時預載）
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/listings',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(() => {
        // 部分 URL 失敗（dev 環境可能 /offline.html 尚未存在）→ 不阻塞安裝
      }))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          // 刪除所有舊版 nomadnest cache（保留當前 STATIC_CACHE 與 PAGE_CACHE）
          .filter(k =>
            k.startsWith('nomadnest-') &&
            k !== STATIC_CACHE &&
            k !== PAGE_CACHE
          )
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      // 通知所有開啟的頁面：SW 已更新並接管
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => {
        clients.forEach(client =>
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION })
        );
      })
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只處理同源 + http/https 請求
  if (!['http:', 'https:'].includes(url.protocol)) return;
  if (url.origin !== location.origin) return;

  // ── 1. API 呼叫 → Network-Only（動態資料不快取）──────────────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({
            error: '目前離線，請稍後再試 / You are offline, please try again later',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }
        )
      )
    );
    return;
  }

  // ── 2. 靜態資源 → Cache-First ────────────────────────────────────────────
  //    涵蓋：_next/static、_next/image（圖片優化路由）、icons、images、字型、媒體
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image')   ||
    url.pathname.startsWith('/icons/')         ||
    url.pathname.startsWith('/images/')        ||
    /\.(png|jpg|jpeg|webp|avif|svg|woff2?|ttf|otf|ico|mp4|webm)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          // 只快取成功的回應（2xx）
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(c => c.put(request, clone));
          }
          return response;
        }).catch(() => {
          // 圖片/字型離線時返回 204（避免破圖）
          return new Response(null, { status: 204 });
        });
      })
    );
    return;
  }

  // ── 3. HTML 頁面 → Network-First，離線 fallback ─────────────────────────
  if (request.mode === 'navigate' ||
      request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            // 快取成功的頁面（避免佔用空間，只快取最近 50 頁）
            const clone = response.clone();
            caches.open(PAGE_CACHE).then(async c => {
              const keys = await c.keys();
              // 超過 50 筆時刪除最舊的
              if (keys.length >= 50) await c.delete(keys[0]);
              c.put(request, clone);
            });
          }
          return response;
        })
        .catch(() =>
          // 離線：先找快取，再 fallback 到 offline.html
          caches.match(request).then(cached =>
            cached ?? caches.match('/offline.html')
          )
        )
    );
    return;
  }
});

// ── Push Notification ─────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'NomadNest', body: event.data.text(), url: '/' };
  }

  const title   = payload.title ?? 'NomadNest Taiwan';
  const options = {
    body:    payload.body    ?? '你有一則新通知 / You have a new notification',
    icon:    payload.icon    ?? '/icons/icon-192x192.png',
    badge:   payload.badge   ?? '/icons/icon-96x96.png',
    image:   payload.image   ?? undefined,
    tag:     payload.tag     ?? 'nomadnest-notification',
    renotify: Boolean(payload.renotify),
    data: {
      url:     payload.url     ?? '/',
      notifId: payload.notifId ?? null,
    },
    actions:            payload.actions ?? [],
    vibrate:            [200, 100, 200],
    requireInteraction: Boolean(payload.requireInteraction),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/';
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Push Subscription Change ──────────────────────────────────────────────────
// 瀏覽器自動輪換訂閱金鑰時觸發，需重新訂閱並回報伺服器
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
    }).then(newSubscription =>
      fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: newSubscription,
          oldEndpoint:  event.oldSubscription?.endpoint,
        }),
      })
    ).catch(() => { /* 忽略重訂閱失敗 */ })
  );
});

// ── Message from client ───────────────────────────────────────────────────────
// 接收來自頁面的訊息（例如：強制跳過 waiting 立即更新）
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
