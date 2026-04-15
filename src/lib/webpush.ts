/**
 * Web Push 工具函式
 * 伺服器端只在這裡 import web-push，前端不應引入此檔案
 */
import webpush from 'web-push';

const VAPID_PUBLIC_KEY  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT ?? 'mailto:support@nomadnest.tw';

// 只在伺服器端初始化（避免重複設定）
if (typeof window === 'undefined' && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  /** 通知標題 */
  title: string;
  /** 通知內文 */
  body: string;
  /** 點擊後導向的 URL（/messages/xxx, /dashboard ...） */
  url?: string;
  /** 通知 icon（預設用 App icon） */
  icon?: string;
  /** 通知 badge */
  badge?: string;
  /** 通知 image（大圖，可選） */
  image?: string;
  /** 通知 tag（相同 tag 會覆蓋舊的） */
  tag?: string;
  /** 是否強制重新提示（搭配 tag 使用） */
  renotify?: boolean;
  /** 是否在用戶操作前保持通知 */
  requireInteraction?: boolean;
  /** 關聯的 Notification DB id（可選，用於追蹤） */
  notifId?: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * 傳送推播通知給單一訂閱
 * @returns 'ok' | 'gone'（410 = 訂閱已失效，呼叫端應刪除 DB 紀錄）
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<'ok' | 'gone'> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 } // 24 小時後放棄
    );
    return 'ok';
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 410 || status === 404) {
      return 'gone'; // 訂閱已失效
    }
    console.error('[WebPush] sendNotification error:', err);
    return 'ok'; // 其他錯誤靜默處理，不刪訂閱
  }
}

/**
 * 傳送推播通知給多個訂閱（廣播）
 * 回傳失效的 endpoint 列表（呼叫端應刪除）
 */
export async function broadcastPushNotification(
  subscriptions: PushSubscriptionData[],
  payload: PushPayload
): Promise<string[]> {
  const goneEndpoints: string[] = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendPushNotification(sub, payload);
      if (result === 'gone') goneEndpoints.push(sub.endpoint);
    })
  );
  return goneEndpoints;
}
