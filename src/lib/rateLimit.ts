/**
 * 速率限制 (Rate Limiter)
 *
 * 提供 in-memory 速率限制，適用單機 / 開發環境。
 * 多實例部署建議改用 Redis 實作（替換 store）。
 *
 * 匯出內容：
 *   createRateLimiter(config)  — 建立獨立限制器（建議各 endpoint 各自建立）
 *   loginLimiter               — 登入：10 次 / 15 分鐘
 *   registerLimiter            — 註冊：5 次 / 60 分鐘（每 IP）
 *   forgotPasswordLimiter      — 忘記密碼：3 次 / 10 分鐘
 *   resetPasswordLimiter       — 重設密碼：5 次 / 30 分鐘
 *   verifyEmailLimiter         — 重寄驗證：3 次 / 60 分鐘
 *
 *   checkRateLimit / clearRateLimit — 向後相容 (login route 使用)
 */

interface AttemptRecord {
  count: number;
  resetAt: number; // unix ms
}

// ── Factory ────────────────────────────────────────────────────────────────────

export interface RateLimiter {
  check(key: string): { ok: boolean; retryAfter?: number };
  clear(key: string): void;
}

export function createRateLimiter(config: {
  maxAttempts: number;
  windowMs: number;
}): RateLimiter {
  const store = new Map<string, AttemptRecord>();

  // 定期清理過期記錄（每 5 分鐘）
  setInterval(() => {
    const now = Date.now();
    for (const [key, rec] of store) {
      if (now > rec.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);

  return {
    check(key: string): { ok: boolean; retryAfter?: number } {
      const now = Date.now();
      const rec = store.get(key);

      // 窗口已過期 → 重置
      if (!rec || now > rec.resetAt) {
        store.set(key, { count: 1, resetAt: now + config.windowMs });
        return { ok: true };
      }

      // 已超過限制
      if (rec.count >= config.maxAttempts) {
        const retryAfter = Math.ceil((rec.resetAt - now) / 1000);
        return { ok: false, retryAfter };
      }

      // 累加計數
      rec.count++;
      return { ok: true };
    },

    clear(key: string): void {
      store.delete(key);
    },
  };
}

// ── 預設限制器（各 endpoint 獨立計數） ────────────────────────────────────────

/** 登入：10 次失敗 / 15 分鐘 */
export const loginLimiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
});

/** 註冊：每 IP 5 次 / 60 分鐘 */
export const registerLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000,
});

/** 忘記密碼：3 次 / 10 分鐘（per email + per IP 分開計）*/
export const forgotPasswordLimiter = createRateLimiter({
  maxAttempts: 3,
  windowMs: 10 * 60 * 1000,
});

/** 重設密碼：5 次 / 30 分鐘 */
export const resetPasswordLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 30 * 60 * 1000,
});

/** 重寄 Email 驗證：3 次 / 60 分鐘 */
export const verifyEmailLimiter = createRateLimiter({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
});

/** 圖片上傳：每用戶每小時 30 次（最多 5 張/次 × 6 批）*/
export const uploadLimiter = createRateLimiter({
  maxAttempts: 30,
  windowMs: 60 * 60 * 1000,
});

/** 建立房源：每用戶每天 10 次（防止垃圾刊登）*/
export const createListingLimiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 24 * 60 * 60 * 1000,
});

/** 送出申請：每用戶每天 20 次（防止惡意申請洗版）*/
export const applicationLimiter = createRateLimiter({
  maxAttempts: 20,
  windowMs: 24 * 60 * 60 * 1000,
});

/** 提交評價：每用戶每天 10 次（防止評分刷榜）*/
export const reviewLimiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 24 * 60 * 60 * 1000,
});

/** 提交檢舉：每用戶每小時 10 次（防止檢舉轟炸）*/
export const reportLimiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000,
});

/** 傳送站內訊息：每用戶每小時 60 則（正常對話流量，防止洗版）*/
export const messageLimiter = createRateLimiter({
  maxAttempts: 60,
  windowMs: 60 * 60 * 1000,
});

/** 更新個人資料：每用戶每小時 10 次（防止暴力刷密碼重試）*/
export const profileUpdateLimiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000,
});

/** 儲存搜尋條件：每用戶每天 20 次（防止洗版 saved searches）*/
export const savedSearchLimiter = createRateLimiter({
  maxAttempts: 20,
  windowMs: 24 * 60 * 60 * 1000,
});

// ── 向後相容 (login/route.ts 使用) ────────────────────────────────────────────

export function checkRateLimit(key: string): { ok: boolean; retryAfter?: number } {
  return loginLimiter.check(key);
}

export function clearRateLimit(key: string): void {
  loginLimiter.clear(key);
}

/** 查詢目前嘗試次數（供日誌 / 測試用）— 向後相容 */
export function getRateLimitInfo(_key: string): null {
  return null; // 由各 limiter 內部維護，統一回傳 null 以避免暴露內部狀態
}
