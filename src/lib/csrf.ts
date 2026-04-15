/**
 * CSRF 防護工具函式
 *
 * 策略：Origin / Referer 標頭驗證
 * ─────────────────────────────────────────────────────────────────────────────
 * 本站使用 Cookie-based 身份驗證（HttpOnly JWT），瀏覽器會在同域請求中自動
 * 帶上 Cookie，因此跨站請求（CSRF）攻擊理論上可透過惡意第三方網站發起。
 *
 * 防護層次：
 *  1. Cookie 設定 SameSite=Lax（middleware.ts 已設定）
 *     → 阻擋來自第三方的表單 POST、fetch 請求
 *  2. Origin / Referer 標頭驗證（本模組實作）
 *     → 雙重保護：即使瀏覽器不支援 SameSite，仍能偵測跨域請求
 *
 * 適用場景：
 *  - 所有 state-mutating 高風險端點（POST / PUT / PATCH / DELETE）
 *  - 特別是：profile 更新、申請提交、評價提交、訊息傳送
 *
 * 不適用：
 *  - 跨域 API 呼叫（如行動 App）→ 需改用 Bearer token 機制
 *  - GET / HEAD / OPTIONS（非 mutation，不需 CSRF 保護）
 *
 * 參考：
 *  OWASP CSRF Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

import type { NextRequest } from 'next/server';

/** 從環境變數取得可信任的 Origin 集合（生產部署時 NEXT_PUBLIC_BASE_URL 必須設定）*/
function getTrustedOrigins(): Set<string> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  const trusted = new Set<string>();

  // 本地開發環境
  trusted.add('http://localhost:3000');
  trusted.add('http://localhost:3001');
  trusted.add('http://127.0.0.1:3000');

  // 生產域名（由環境變數設定）
  if (base) {
    try {
      const url = new URL(base);
      trusted.add(url.origin);
    } catch { /* 忽略無效 URL */ }
  }

  return trusted;
}

/**
 * 驗證請求的 Origin 標頭是否來自可信任來源
 *
 * @returns `{ ok: true }` 驗證通過
 * @returns `{ ok: false, reason: string }` 驗證失敗，回傳原因
 *
 * @example
 * ```ts
 * const csrf = validateOrigin(req);
 * if (!csrf.ok) return NextResponse.json({ error: csrf.reason }, { status: 403 });
 * ```
 */
export function validateOrigin(req: NextRequest): { ok: true } | { ok: false; reason: string } {
  // 跳過 GET / HEAD / OPTIONS（非 mutation 請求）
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return { ok: true };

  // 開發環境寬鬆模式（CI / 單元測試環境不啟用 CSRF 驗證）
  if (process.env.NODE_ENV === 'development' || process.env.CSRF_SKIP === 'true') {
    return { ok: true };
  }

  const origin  = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const trusted = getTrustedOrigins();

  // 1. 優先使用 Origin 標頭（Fetch API 預設帶送）
  if (origin) {
    if (trusted.has(origin)) return { ok: true };
    return { ok: false, reason: `Origin not allowed: ${origin}` };
  }

  // 2. 回退到 Referer（部分舊版瀏覽器 / form submit 不帶 Origin）
  if (referer) {
    try {
      const refUrl  = new URL(referer);
      const refOrigin = refUrl.origin;
      if (trusted.has(refOrigin)) return { ok: true };
      return { ok: false, reason: `Referer origin not allowed: ${refOrigin}` };
    } catch {
      return { ok: false, reason: 'Invalid Referer header' };
    }
  }

  // 3. 沒有 Origin 也沒有 Referer → 允許通過
  // （server-to-server 呼叫、curl 等工具不帶這些標頭，阻擋會造成合法請求失敗）
  // 注意：SameSite=Lax Cookie 已提供第一道防線，此處寬鬆處理以確保可用性
  return { ok: true };
}

/**
 * 直接取得 403 CSRF 錯誤的 Response 物件（便利函式）
 * 使用 lazy import 避免在非 Route Handler 環境引入 Next.js server-only 模組
 */
export function csrfForbiddenResponse(reason = 'CSRF validation failed') {
  const { NextResponse } = require('next/server') as typeof import('next/server');
  return NextResponse.json({ error: reason }, { status: 403 });
}
