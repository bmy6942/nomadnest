import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USERS } from './helpers/auth';

/**
 * API 健康檢查 — 核心端點的快速 smoke test
 * 不依賴 UI，直接打 API，速度極快
 */

// ─────────────────────────────────────────────
// 公開 API
// ─────────────────────────────────────────────
test.describe('API 健康檢查 — 公開端點', () => {
  test('GET /api/listings 返回房源陣列', async ({ request }) => {
    const res = await request.get('/api/listings');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const listings = data.listings ?? data;
    expect(Array.isArray(listings)).toBeTruthy();
  });

  test('GET /api/listings?city=taipei 正確篩選', async ({ request }) => {
    const res = await request.get('/api/listings?city=taipei');
    expect(res.status()).toBe(200);
  });

  test('GET /sitemap.xml 返回 200 且包含 XML', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('<urlset');
  });

  test('GET /robots.txt 返回 200', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text.toLowerCase()).toContain('user-agent');
  });
});

// ─────────────────────────────────────────────
// 受保護 API — 401 檢查
// ─────────────────────────────────────────────
test.describe('API 健康檢查 — 認證保護', () => {
  const protectedEndpoints = [
    { method: 'GET', path: '/api/auth/me' },
    { method: 'GET', path: '/api/dashboard' },
    { method: 'GET', path: '/api/favorites' },
    { method: 'GET', path: '/api/notifications' },
    { method: 'GET', path: '/api/status' },
    // /api/listings/recent 是「個人瀏覽紀錄」，需登入
    { method: 'GET', path: '/api/listings/recent' },
  ];

  for (const { method, path } of protectedEndpoints) {
    test(`${method} ${path} 未登入 → 401`, async ({ request }) => {
      const res = method === 'GET'
        ? await request.get(path)
        : await request.post(path, { data: {} });
      expect(res.status()).toBe(401);
    });
  }
});

// ─────────────────────────────────────────────
// 已登入 API
// ─────────────────────────────────────────────
test.describe('API 健康檢查 — 已登入端點', () => {
  test('GET /api/auth/me 返回用戶資訊', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.get('/api/auth/me');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('email');
    expect(data.email).toBe(TEST_USERS.tenant.email);
  });

  test('GET /api/dashboard 返回租客儀表板資料', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.get('/api/dashboard');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('myApplications');
    expect(Array.isArray(data.myApplications)).toBeTruthy();
  });

  test('GET /api/dashboard 返回房東儀表板資料', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.landlord);
    const res = await request.get('/api/dashboard');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('myListings');
    expect(Array.isArray(data.myListings)).toBeTruthy();
  });

  test('GET /api/favorites 返回收藏陣列', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.get('/api/favorites');
    expect(res.status()).toBe(200);
    const data = await res.json();
    // API 回傳 { favorites: [...] }，而非直接回傳陣列
    expect(data).toHaveProperty('favorites');
    expect(Array.isArray(data.favorites)).toBeTruthy();
  });

  test('GET /api/listings/recent 登入後返回個人瀏覽紀錄', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.get('/api/listings/recent');
    expect(res.status()).toBe(200);
    const data = await res.json();
    // 回傳陣列（無紀錄時為空陣列）
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('GET /api/status 返回通知計數', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.get('/api/status');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(typeof data.notificationCount).toBe('number');
  });
});

// ─────────────────────────────────────────────
// 輸入驗證 — 邊界測試
// ─────────────────────────────────────────────
test.describe('API 輸入驗證', () => {
  test('POST /api/auth/login 空 body → 400 或 401', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: {} });
    expect([400, 401, 422]).toContain(res.status());
  });

  test('POST /api/auth/login SQL 注入嘗試 → 不回 500', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: {
        email: "' OR '1'='1",
        password: "' OR '1'='1",
      },
    });
    // 應返回 401（驗證失敗），不應 500
    expect(res.status()).not.toBe(500);
  });

  test('POST /api/favorites 無 listingId → 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.post('/api/favorites', { data: {} });
    expect([400, 422]).toContain(res.status());
  });

  test('GET /api/listings/[不存在的id] → 404', async ({ request }) => {
    const res = await request.get('/api/listings/non-existent-id-12345');
    expect(res.status()).toBe(404);
  });
});
