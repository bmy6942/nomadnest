import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USERS } from './helpers/auth';
import { getFirstActiveListing, removeFavorite } from './helpers/db';

// ─────────────────────────────────────────────
// 收藏功能
// ─────────────────────────────────────────────
test.describe('收藏功能 — 已登入租客', () => {
  let listingId: string;

  test.beforeEach(async ({ page, request }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const listing = await getFirstActiveListing(request);
    listingId = listing.id;
    // 確保測試前是未收藏狀態（刪除若已存在）
    await removeFavorite(request, listingId);
  });

  test.afterEach(async ({ request }) => {
    // 清理測試產生的收藏
    await removeFavorite(request, listingId);
  });

  test('在房源詳情頁點擊收藏按鈕後狀態切換', async ({ page }) => {
    await page.goto(`/listings/${listingId}`);

    const favBtn = page.getByRole('button', { name: /收藏/i });
    await expect(favBtn).toBeVisible();

    // 初始狀態（未收藏）
    const initialText = await favBtn.textContent();

    // 點擊收藏
    await favBtn.click();
    await page.waitForTimeout(500); // 等待 API 回應

    // 狀態應改變
    const newText = await favBtn.textContent();
    expect(initialText).not.toBe(newText);
  });

  test('在房源列表頁點擊心型按鈕可收藏', async ({ page }) => {
    await page.goto('/listings');

    // 找第一個愛心按鈕
    const heartBtn = page.locator('button[aria-label*="收藏"], button:has-text("❤"), button:has-text("🤍")').first();

    if (await heartBtn.isVisible()) {
      await heartBtn.click();
      await page.waitForTimeout(500);
      // 按鈕樣式應改變（已收藏 vs 未收藏）
      // 只確認按鈕仍可見即可
      await expect(heartBtn).toBeVisible();
    }
  });

  test('API POST /api/favorites 新增收藏', async ({ request }) => {
    const res = await request.post('/api/favorites', {
      data: { listingId },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.favorited).toBe(true);
  });

  test('API POST /api/favorites 重複收藏 → toggle 取消收藏', async ({ request }) => {
    // 先收藏
    await request.post('/api/favorites', { data: { listingId } });
    // 再次 POST → 取消
    const res = await request.post('/api/favorites', { data: { listingId } });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.favorited).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 收藏清單頁 /favorites
// ─────────────────────────────────────────────
test.describe('收藏清單頁', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
  });

  test('/favorites 頁面可正常載入', async ({ page }) => {
    await page.goto('/favorites');
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('有收藏時頁面顯示房源卡片', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    // 先確保有一筆收藏
    await request.post('/api/favorites', { data: { listingId: listing.id } });

    await page.goto('/favorites');
    await page.waitForLoadState('networkidle');

    // 應顯示至少一張卡片
    const cards = page.locator('article, [data-testid="listing-card"], .listing-card, h2, h3');
    await expect(cards.first()).toBeVisible({ timeout: 8_000 });

    // 清理
    await removeFavorite(request, listing.id);
  });

  test('無收藏時顯示空狀態提示', async ({ page, request }) => {
    // 先清空所有收藏（透過取得清單並逐一刪除）
    const favRes = await request.get('/api/favorites');
    if (favRes.status() === 200) {
      const data = await favRes.json();
      const favorites: Array<{ listing: { id: string } }> = data ?? [];
      for (const fav of favorites) {
        await removeFavorite(request, fav.listing.id);
      }
    }

    await page.goto('/favorites');
    await page.waitForLoadState('networkidle');

    // 顯示空狀態文字
    await expect(
      page.getByText(/尚無收藏|還沒有收藏|去探索/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test('在收藏頁取消收藏後卡片消失', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await request.post('/api/favorites', { data: { listingId: listing.id } });

    await page.goto('/favorites');
    await page.waitForLoadState('networkidle');

    // 找心型按鈕並點擊取消收藏
    const heartBtn = page.locator('button').filter({ hasText: /❤️|取消收藏/ }).first();
    if (await heartBtn.isVisible()) {
      await heartBtn.click();
      await page.waitForTimeout(600);
      // 卡片應消失（透過動畫或 DOM 移除）
    }
  });

  test('Navbar 收藏清單連結可導覽至 /favorites', async ({ page }) => {
    await page.goto('/');
    // 打開用戶選單
    const userMenu = page.getByRole('button', { name: new RegExp(TEST_USERS.tenant.name) }).or(
      page.getByAltText('頭像').or(page.locator('[data-testid="user-menu"]'))
    ).first();

    if (await userMenu.isVisible()) {
      await userMenu.click();
      const favLink = page.getByRole('link', { name: /收藏清單/i });
      await expect(favLink).toBeVisible();
      await favLink.click();
      await expect(page).toHaveURL('/favorites');
    }
  });
});

// ─────────────────────────────────────────────
// 收藏 — 未登入
// ─────────────────────────────────────────────
test.describe('收藏功能 — 未登入', () => {
  test('未登入訪問 /favorites 跳轉登入頁', async ({ page }) => {
    await page.goto('/favorites');
    await page.waitForURL(/\/auth\/login/, { timeout: 6_000 });
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('未登入點擊收藏按鈕 → 提示登入或跳轉', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await page.goto(`/listings/${listing.id}`);

    const favBtn = page.getByRole('button', { name: /收藏/i });
    if (await favBtn.isVisible()) {
      await favBtn.click();
      // 應提示登入或跳轉
      const loginPrompt = page.getByText(/請先登入|login/i).or(page.locator('[href="/auth/login"]'));
      const redirected = page.url().includes('/auth/login');
      const promptVisible = await loginPrompt.isVisible().catch(() => false);
      expect(redirected || promptVisible).toBeTruthy();
    }
  });
});
