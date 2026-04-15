import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USERS } from './helpers/auth';
import { getFirstActiveListing } from './helpers/db';

/**
 * 安全性迴歸測試
 * 涵蓋本次 audit 修復的所有安全議題：
 * - 用戶資料外洩防護（Dashboard）
 * - 型別守衛（Favorites、Upload Delete）
 * - IDOR 防護（只能刪除自己的圖片）
 * - Admin 存取控制
 * - 格式錯誤 JSON 防護
 */

// ─────────────────────────────────────────────────────────────────────
// Dashboard 安全 — 用戶資料欄位白名單
// ─────────────────────────────────────────────────────────────────────
test.describe('Dashboard — 用戶資料欄位安全', () => {
  test('回傳的 user 物件不含 passwordHash / verificationToken', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.get('/api/dashboard');
    expect(res.status()).toBe(200);
    const data = await res.json();

    expect(data).toHaveProperty('user');
    const user = data.user;

    // 安全欄位應存在
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('name');

    // 敏感欄位不應存在
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('verificationToken');
    expect(user).not.toHaveProperty('resetToken');
  });

  test('myListings 中每筆 images 必為陣列（不是原始字串）', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.landlord);
    const res = await request.get('/api/dashboard');
    expect(res.status()).toBe(200);
    const data = await res.json();

    for (const listing of data.myListings ?? []) {
      expect(Array.isArray(listing.images)).toBeTruthy();
    }
  });

  test('myApplications 中每筆 listing.images 必為陣列', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.get('/api/dashboard');
    expect(res.status()).toBe(200);
    const data = await res.json();

    for (const app of data.myApplications ?? []) {
      if (app.listing) {
        expect(Array.isArray(app.listing.images)).toBeTruthy();
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Favorites — 型別守衛
// ─────────────────────────────────────────────────────────────────────
test.describe('Favorites — 型別守衛', () => {
  test('POST /api/favorites 不帶 body → 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.post('/api/favorites', { data: {} });
    expect([400, 422]).toContain(res.status());
  });

  test('POST /api/favorites listingId 為數字（非字串）→ 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.post('/api/favorites', {
      data: { listingId: 12345 },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('POST /api/favorites listingId 為空字串 → 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.post('/api/favorites', {
      data: { listingId: '   ' },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('POST /api/favorites malformed JSON → 400（不回 500）', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.post('/api/favorites', {
      headers: { 'Content-Type': 'application/json' },
      data: 'THIS IS NOT JSON',
    });
    expect(res.status()).not.toBe(500);
    expect([400, 422]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────────────────────────────
// Upload Delete — 型別守衛 & 數量上限
// ─────────────────────────────────────────────────────────────────────
test.describe('Upload Delete — 型別守衛', () => {
  test('DELETE /api/upload/delete 未登入 → 401', async ({ request }) => {
    const res = await request.delete('/api/upload/delete', {
      data: { url: 'https://example.com/fake.jpg' },
    });
    expect(res.status()).toBe(401);
  });

  test('DELETE /api/upload/delete 無 URL → 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.delete('/api/upload/delete', { data: {} });
    expect([400, 422]).toContain(res.status());
  });

  test('DELETE /api/upload/delete urls 非陣列 → 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.delete('/api/upload/delete', {
      data: { urls: 'not-an-array' },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('DELETE /api/upload/delete 超過 20 筆 → 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const urls = Array.from({ length: 21 }, (_, i) =>
      `https://fakesupabase.supabase.co/storage/v1/object/public/nomadnest-uploads/listings/user${i}/file.jpg`
    );
    const res = await request.delete('/api/upload/delete', { data: { urls } });
    expect([400, 422]).toContain(res.status());
  });

  test('DELETE /api/upload/delete 非 Supabase URL（外部 URL）→ 200 deleted:0', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.delete('/api/upload/delete', {
      data: { url: 'https://images.unsplash.com/some-image.jpg' },
    });
    // 外部 URL 不刪 Storage，視為成功
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// IDOR — 用戶只能刪自己的圖片
// ─────────────────────────────────────────────────────────────────────
test.describe('IDOR — 圖片刪除授權', () => {
  test('DELETE /api/upload/delete 嘗試刪除他人圖片 → 403', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);

    // 偽造屬於另一用戶的 Supabase Storage URL
    const otherUserId = '00000000-0000-0000-0000-000000000999';
    const fakeUrl = `https://fakeproject.supabase.co/storage/v1/object/public/nomadnest-uploads/listings/${otherUserId}/fake-image.jpg`;

    const res = await request.delete('/api/upload/delete', {
      data: { url: fakeUrl },
    });
    expect(res.status()).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Admin 存取控制
// ─────────────────────────────────────────────────────────────────────
test.describe('Admin 存取控制', () => {
  test('非 admin 存取 /api/admin/users → 403 或 401', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.get('/api/admin/users');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('未登入存取 /api/admin → 401', async ({ request }) => {
    const res = await request.get('/api/admin/users');
    expect([401, 404]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────────────────────────────
// 格式錯誤 JSON — 不應回 500
// ─────────────────────────────────────────────────────────────────────
test.describe('Malformed JSON — 不應回 500', () => {
  const endpoints: Array<{ method: string; path: string }> = [
    { method: 'POST', path: '/api/favorites' },
    { method: 'DELETE', path: '/api/favorites' },
    { method: 'DELETE', path: '/api/upload/delete' },
    { method: 'POST', path: '/api/reviews' },
  ];

  for (const { method, path } of endpoints) {
    test(`${method} ${path} malformed JSON → 非 500`, async ({ request, page }) => {
      await loginViaAPI(page, TEST_USERS.tenant);
      const fn = method === 'POST'
        ? (p: string) => request.post(p, { headers: { 'Content-Type': 'application/json' }, data: '{bad json' })
        : (p: string) => request.delete(p, { headers: { 'Content-Type': 'application/json' }, data: '{bad json' });
      const res = await fn(path);
      expect(res.status()).not.toBe(500);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Listings images 安全解析（DB 損壞資料不應回 500）
// ─────────────────────────────────────────────────────────────────────
test.describe('Listings — 回傳結構完整性', () => {
  test('GET /api/listings 每筆 images 必為陣列', async ({ request }) => {
    const res = await request.get('/api/listings');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const listings: Array<{ images: unknown }> = data.listings ?? data ?? [];
    for (const l of listings) {
      expect(Array.isArray(l.images)).toBeTruthy();
    }
  });

  test('GET /api/listings 特定 listing images 必為陣列', async ({ request }) => {
    const listing = await getFirstActiveListing(request);
    const res = await request.get(`/api/listings/${listing.id}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.images)).toBeTruthy();
  });
});
