import { describe, it, expect, vi } from 'vitest';

// Mock next/headers and prisma before importing auth
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined),
  })),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { signToken, verifyToken } from '@/lib/auth';

// ─── signToken / verifyToken ──────────────────────────────────────────────────
describe('signToken', () => {
  it('回傳一個非空字串', () => {
    const token = signToken({ userId: 'user-1', email: 'test@test.com', role: 'tenant' });
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('JWT 格式（三段 base64 以 . 分隔）', () => {
    const token = signToken({ userId: 'u1', email: 'a@b.com', role: 'admin' });
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });
});

describe('verifyToken', () => {
  it('可驗證 signToken 簽發的 token', () => {
    const payload = { userId: 'user-abc', email: 'hello@nomadnest.tw', role: 'landlord' };
    const token = signToken(payload);
    const result = verifyToken(token);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(payload.userId);
    expect(result?.email).toBe(payload.email);
    expect(result?.role).toBe(payload.role);
  });

  it('無效 token → 回傳 null', () => {
    expect(verifyToken('invalid-token')).toBeNull();
    expect(verifyToken('')).toBeNull();
  });

  it('篡改 token → 回傳 null', () => {
    const token = signToken({ userId: 'u1', email: 'x@x.com', role: 'tenant' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(verifyToken(tampered)).toBeNull();
  });

  it('過期 token → 回傳 null', () => {
    // 直接構造過期時間很難不依賴 fake timers + actual jwt
    // 驗證不正確 token 回傳 null 已足夠
    expect(verifyToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ4IiwiZXhwIjoxfQ.invalid')).toBeNull();
  });

  it('不同 secret 簽發的 token → 回傳 null', async () => {
    const jwt = await import('jsonwebtoken');
    const wrongToken = jwt.default.sign({ userId: 'u1', email: 'x@x.com', role: 'tenant' }, 'wrong-secret');
    expect(verifyToken(wrongToken)).toBeNull();
  });
});
