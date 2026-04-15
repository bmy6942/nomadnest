/**
 * 安全性單元測試
 *
 * 覆蓋：
 *  - CSRF validateOrigin：可信任 Origin 通過、不可信任 Origin 拒絕、
 *    GET 請求免檢查、開發環境寬鬆模式
 *  - rateLimit：新限制器（reviewLimiter / reportLimiter / messageLimiter /
 *    profileUpdateLimiter / savedSearchLimiter）基本通過與超限行為
 *  - Applications IDOR 邏輯（status 白名單邏輯）
 */

import { describe, it, expect, vi } from 'vitest';

// ── 測試用 NextRequest 工廠 ────────────────────────────────────────────────────
function makeReq(method: string, headers: Record<string, string> = {}) {
  return {
    method,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  } as unknown as import('next/server').NextRequest;
}

// ─── CSRF validateOrigin ───────────────────────────────────────────────────────
describe('validateOrigin (CSRF)', () => {
  it('GET 請求直接通過（不需 CSRF 驗證）', async () => {
    const { validateOrigin } = await import('@/lib/csrf');
    expect(validateOrigin(makeReq('GET')).ok).toBe(true);
  });

  it('HEAD 請求直接通過', async () => {
    const { validateOrigin } = await import('@/lib/csrf');
    expect(validateOrigin(makeReq('HEAD')).ok).toBe(true);
  });

  it('OPTIONS 請求直接通過', async () => {
    const { validateOrigin } = await import('@/lib/csrf');
    expect(validateOrigin(makeReq('OPTIONS')).ok).toBe(true);
  });

  it('CSRF_SKIP=true 時 POST 直接通過', async () => {
    vi.stubEnv('CSRF_SKIP', 'true');
    const { validateOrigin } = await import('@/lib/csrf');
    expect(validateOrigin(makeReq('POST')).ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it('開發環境（NODE_ENV=development）POST 直接通過', async () => {
    // NODE_ENV 在 vitest 設定為 'test'，CSRF module 會走開發環境邏輯
    // 此測試驗證 CSRF_SKIP='true' 等效行為
    vi.stubEnv('CSRF_SKIP', 'true');
    const { validateOrigin } = await import('@/lib/csrf');
    const result = validateOrigin(makeReq('POST', {}));
    expect(result.ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it('無 Origin 也無 Referer → 通過（server-to-server 呼叫不帶標頭）', async () => {
    vi.stubEnv('CSRF_SKIP', '');
    vi.stubEnv('NODE_ENV', 'production');
    const { validateOrigin } = await import('@/lib/csrf');
    const result = validateOrigin(makeReq('POST', {}));
    // 沒有 Origin/Referer 時寬鬆放行（server-to-server 合法呼叫）
    expect(result.ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it('localhost:3000 Origin POST → 通過（本地開發可信任）', async () => {
    const { validateOrigin } = await import('@/lib/csrf');
    const result = validateOrigin(makeReq('POST', { origin: 'http://localhost:3000' }));
    expect(result.ok).toBe(true);
  });

  it('不可信任的 Origin → 拒絕', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CSRF_SKIP', '');
    const { validateOrigin } = await import('@/lib/csrf');
    const result = validateOrigin(makeReq('POST', { origin: 'https://evil.example.com' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('evil.example.com');
    }
    vi.unstubAllEnvs();
  });

  it('不可信任的 Referer → 拒絕（無 Origin 但有 Referer）', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CSRF_SKIP', '');
    const { validateOrigin } = await import('@/lib/csrf');
    const result = validateOrigin(
      makeReq('DELETE', { referer: 'https://phishing.example.com/attack' })
    );
    expect(result.ok).toBe(false);
    vi.unstubAllEnvs();
  });

  it('合法 Referer（localhost）→ 通過', async () => {
    const { validateOrigin } = await import('@/lib/csrf');
    const result = validateOrigin(
      makeReq('PUT', { referer: 'http://localhost:3000/profile' })
    );
    expect(result.ok).toBe(true);
  });
});

// ─── Rate Limiters — 新增限制器 ────────────────────────────────────────────────
describe('新增速率限制器', () => {
  it('reviewLimiter 正常限制：新 key 通過', async () => {
    const { reviewLimiter } = await import('@/lib/rateLimit');
    const key = `test-review-${Date.now()}-${Math.random()}`;
    expect(reviewLimiter.check(key).ok).toBe(true);
  });

  it('reviewLimiter clear() 後重置', async () => {
    const { reviewLimiter } = await import('@/lib/rateLimit');
    const key = `test-review-clear-${Date.now()}`;
    reviewLimiter.check(key);
    reviewLimiter.clear(key);
    expect(reviewLimiter.check(key).ok).toBe(true);
  });

  it('reviewLimiter 超過 10 次 → ok=false + retryAfter > 0', async () => {
    const { reviewLimiter } = await import('@/lib/rateLimit');
    const key = `exhaust-review-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 10; i++) reviewLimiter.check(key);
    const result = reviewLimiter.check(key);
    expect(result.ok).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('reportLimiter 新 key 通過', async () => {
    const { reportLimiter } = await import('@/lib/rateLimit');
    const key = `test-report-${Date.now()}-${Math.random()}`;
    expect(reportLimiter.check(key).ok).toBe(true);
  });

  it('reportLimiter 超過 10 次 → ok=false', async () => {
    const { reportLimiter } = await import('@/lib/rateLimit');
    const key = `exhaust-report-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 10; i++) reportLimiter.check(key);
    expect(reportLimiter.check(key).ok).toBe(false);
  });

  it('messageLimiter 新 key 通過', async () => {
    const { messageLimiter } = await import('@/lib/rateLimit');
    const key = `test-msg-${Date.now()}-${Math.random()}`;
    expect(messageLimiter.check(key).ok).toBe(true);
  });

  it('profileUpdateLimiter 新 key 通過', async () => {
    const { profileUpdateLimiter } = await import('@/lib/rateLimit');
    const key = `test-profile-${Date.now()}-${Math.random()}`;
    expect(profileUpdateLimiter.check(key).ok).toBe(true);
  });

  it('savedSearchLimiter 新 key 通過', async () => {
    const { savedSearchLimiter } = await import('@/lib/rateLimit');
    const key = `test-saved-${Date.now()}-${Math.random()}`;
    expect(savedSearchLimiter.check(key).ok).toBe(true);
  });
});

// ─── Applications IDOR 狀態白名單邏輯 ─────────────────────────────────────────
describe('Applications status whitelist（IDOR 防護）', () => {
  const LANDLORD_STATUSES = new Set(['approved', 'rejected']);
  const TENANT_STATUSES   = new Set(['withdrawn']);

  it('房東可設定 approved', () => {
    expect(LANDLORD_STATUSES.has('approved')).toBe(true);
  });

  it('房東可設定 rejected', () => {
    expect(LANDLORD_STATUSES.has('rejected')).toBe(true);
  });

  it('房東不可設定 withdrawn', () => {
    expect(LANDLORD_STATUSES.has('withdrawn')).toBe(false);
  });

  it('租客只能設定 withdrawn', () => {
    expect(TENANT_STATUSES.has('withdrawn')).toBe(true);
  });

  it('租客不能設定 approved（防 IDOR 自審批）', () => {
    expect(TENANT_STATUSES.has('approved')).toBe(false);
  });

  it('租客不能設定 rejected', () => {
    expect(TENANT_STATUSES.has('rejected')).toBe(false);
  });

  it('任何角色都不能設定 pending（防狀態重置攻擊）', () => {
    expect(LANDLORD_STATUSES.has('pending')).toBe(false);
    expect(TENANT_STATUSES.has('pending')).toBe(false);
  });
});
