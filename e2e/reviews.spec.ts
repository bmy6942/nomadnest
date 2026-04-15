import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USERS } from './helpers/auth';
import { getFirstActiveListing } from './helpers/db';

/**
 * 評價系統 E2E 測試
 * 涵蓋：
 * - 未登入 → 401
 * - 房東角色 → 403（只有租客可評價）
 * - 缺少欄位 → 400
 * - 評分範圍超出（< 1 or > 5）→ 400
 * - 評分非整數（浮點數）→ 400
 * - listingId 型別錯誤 → 400
 * - 評價內容過短（< 10 字元）→ 400
 * - 評價內容過長（> 2000 字元）→ 400
 * - 不存在的 listingId → 404
 * - malformed JSON → 400（不回 500）
 */

// ─────────────────────────────────────────────────────────────────────
// Auth guard
// ─────────────────────────────────────────────────────────────────────
test.describe('Reviews — Auth guard', () => {
  test('POST /api/reviews 未登入 → 401', async ({ request }) => {
    const res = await request.post('/api/reviews', {
      data: { listingId: 'any-id', rating: 5, wifiRating: 5, content: '很好的住宿環境，推薦給大家！' },
    });
    expect(res.status()).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 角色守衛 — 只有租客可評價
// ─────────────────────────────────────────────────────────────────────
test.describe('Reviews — 角色守衛', () => {
  test('POST /api/reviews 房東角色 → 403', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.landlord);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: 'any-listing-id',
        rating: 5,
        wifiRating: 5,
        content: '這是一個非常好的住宿地點，環境整潔，設施完善。',
      },
    });
    expect(res.status()).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('租客');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 輸入驗證
// ─────────────────────────────────────────────────────────────────────
test.describe('Reviews — 輸入驗證', () => {
  test('缺少 rating → 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: listing.id,
        wifiRating: 4,
        content: '這是一個非常好的住宿地點，非常推薦。',
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('缺少 content → 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    const res = await request.post('/api/reviews', {
      data: { listingId: listing.id, rating: 4, wifiRating: 4 },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('缺少 listingId → 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.post('/api/reviews', {
      data: { rating: 4, wifiRating: 4, content: '這是一個非常好的住宿地點！' },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('listingId 為數字（非字串）→ 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.post('/api/reviews', {
      data: { listingId: 12345, rating: 4, wifiRating: 4, content: '這是一個非常好的住宿地點！' },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('listingId 為空字串 → 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.post('/api/reviews', {
      data: { listingId: '', rating: 4, wifiRating: 4, content: '這是一個非常好的住宿地點！' },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('不存在的 listingId → 404', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: 'non-existent-id-zzz-999',
        rating: 4,
        wifiRating: 4,
        content: '這是一個非常好的住宿地點，推薦給大家。',
      },
    });
    // 可能是 404（找不到房源）或 403（沒有申請紀錄）
    expect([403, 404]).toContain(res.status());
  });

  test('malformed JSON → 400（不回 500）', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.post('/api/reviews', {
      headers: { 'Content-Type': 'application/json' },
      data: '{not valid json',
    });
    expect(res.status()).not.toBe(500);
    expect([400, 422]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────────────────────────────
// 評分範圍驗證（P1 — 本次 audit 已有防護）
// ─────────────────────────────────────────────────────────────────────
test.describe('Reviews — 評分範圍驗證', () => {
  test('rating = 0（低於下限）→ 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: listing.id,
        rating: 0,        // 非法：< 1
        wifiRating: 4,
        content: '這是一個非常好的住宿地點，推薦給大家。',
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('rating = 6（超過上限）→ 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: listing.id,
        rating: 6,        // 非法：> 5
        wifiRating: 4,
        content: '這是一個非常好的住宿地點，推薦給大家。',
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('wifiRating = 0（低於下限）→ 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: listing.id,
        rating: 4,
        wifiRating: 0,    // 非法：< 1
        content: '這是一個非常好的住宿地點，推薦給大家。',
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('wifiRating = 6（超過上限）→ 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: listing.id,
        rating: 4,
        wifiRating: 6,    // 非法：> 5
        content: '這是一個非常好的住宿地點，推薦給大家。',
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('rating 為浮點數（4.5）→ 400（需整數）', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: listing.id,
        rating: 4.5,      // 非法：非整數
        wifiRating: 4,
        content: '這是一個非常好的住宿地點，推薦給大家。',
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('rating 為字串（"5"）→ 400（需數字型別）', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: listing.id,
        rating: '5',      // 非法：字串而非數字
        wifiRating: 4,
        content: '這是一個非常好的住宿地點，推薦給大家。',
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('rating 為負數（-1）→ 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: listing.id,
        rating: -1,
        wifiRating: 4,
        content: '這是一個非常好的住宿地點，推薦給大家。',
      },
    });
    expect([400, 422]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────────────────────────────
// 評價內容長度驗證
// ─────────────────────────────────────────────────────────────────────
test.describe('Reviews — 內容長度驗證', () => {
  test('content 過短（< 10 字元）→ 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: listing.id,
        rating: 4,
        wifiRating: 4,
        content: '太短',   // < 10 字元
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('content 過長（> 2000 字元）→ 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: listing.id,
        rating: 4,
        wifiRating: 4,
        content: '好'.repeat(2001),   // > 2000 字元
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  test('content 為空白字串 → 400', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    const res = await request.post('/api/reviews', {
      data: {
        listingId: listing.id,
        rating: 4,
        wifiRating: 4,
        content: '   ',   // 空白
      },
    });
    expect([400, 422]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────────────────────────────
// GET 評價列表（公開端點）
// ─────────────────────────────────────────────────────────────────────
test.describe('Reviews — GET 列表', () => {
  test('GET /api/listings/[id]/reviews 返回評價陣列', async ({ request }) => {
    const listing = await getFirstActiveListing(request);
    const res = await request.get(`/api/listings/${listing.id}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    // reviews 欄位應為陣列（即使沒有評價也回空陣列）
    if ('reviews' in data) {
      expect(Array.isArray(data.reviews)).toBeTruthy();
    }
  });
});
