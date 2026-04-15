import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRateLimiter, checkRateLimit, clearRateLimit } from '@/lib/rateLimit';

// ─── createRateLimiter ────────────────────────────────────────────────────────
describe('createRateLimiter', () => {
  it('第一次請求應通過', () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 });
    const result = limiter.check('test-key');
    expect(result.ok).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('在限制內的多次請求皆通過', () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 });
    expect(limiter.check('key').ok).toBe(true);
    expect(limiter.check('key').ok).toBe(true);
    expect(limiter.check('key').ok).toBe(true);
  });

  it('超過限制後回傳 ok=false 及 retryAfter', () => {
    const limiter = createRateLimiter({ maxAttempts: 2, windowMs: 60_000 });
    limiter.check('key'); // 1
    limiter.check('key'); // 2 → 達到上限
    const result = limiter.check('key'); // 3 → 超過
    expect(result.ok).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(60);
  });

  it('retryAfter 以秒為單位，不超過視窗大小', () => {
    const windowMs = 30_000; // 30 秒
    const limiter = createRateLimiter({ maxAttempts: 1, windowMs });
    limiter.check('key'); // 達到上限
    const result = limiter.check('key');
    expect(result.ok).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(30);
  });

  it('clear() 清除後可重新請求', () => {
    const limiter = createRateLimiter({ maxAttempts: 1, windowMs: 60_000 });
    limiter.check('key'); // 達到上限
    const blocked = limiter.check('key');
    expect(blocked.ok).toBe(false);

    limiter.clear('key');
    const afterClear = limiter.check('key');
    expect(afterClear.ok).toBe(true);
  });

  it('不同 key 互不影響', () => {
    const limiter = createRateLimiter({ maxAttempts: 1, windowMs: 60_000 });
    limiter.check('key-a'); // key-a 達到上限
    limiter.check('key-a'); // key-a blocked

    const result = limiter.check('key-b'); // key-b 獨立計數
    expect(result.ok).toBe(true);
  });

  it('視窗過期後重置計數', () => {
    vi.useFakeTimers();
    const windowMs = 10_000; // 10 秒
    const limiter = createRateLimiter({ maxAttempts: 1, windowMs });

    limiter.check('key'); // 達到上限
    const blocked = limiter.check('key');
    expect(blocked.ok).toBe(false);

    // 快轉超過視窗時間
    vi.advanceTimersByTime(windowMs + 100);

    const afterExpiry = limiter.check('key');
    expect(afterExpiry.ok).toBe(true);

    vi.useRealTimers();
  });

  it('maxAttempts=1 代表只有第一次通過', () => {
    const limiter = createRateLimiter({ maxAttempts: 1, windowMs: 60_000 });
    expect(limiter.check('k').ok).toBe(true);
    expect(limiter.check('k').ok).toBe(false);
    expect(limiter.check('k').ok).toBe(false);
  });
});

// ─── 向後相容 API：checkRateLimit / clearRateLimit ───────────────────────────
describe('checkRateLimit / clearRateLimit (向後相容)', () => {
  it('checkRateLimit 使用 loginLimiter（10 次 / 15 分鐘）', () => {
    // 前幾次應該通過
    const r1 = checkRateLimit('compat-test-1');
    expect(r1.ok).toBe(true);
  });

  it('clearRateLimit 不會拋出錯誤', () => {
    expect(() => clearRateLimit('compat-test-clear')).not.toThrow();
  });

  it('checkRateLimit 然後 clearRateLimit 可重置', () => {
    const key = 'compat-reset-key';
    // 暴力檢查 10 次（loginLimiter 上限）
    for (let i = 0; i < 10; i++) checkRateLimit(key);
    const blocked = checkRateLimit(key);
    expect(blocked.ok).toBe(false);

    clearRateLimit(key);
    const afterClear = checkRateLimit(key);
    expect(afterClear.ok).toBe(true);
  });
});
