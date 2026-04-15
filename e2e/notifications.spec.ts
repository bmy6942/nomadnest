import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USERS } from './helpers/auth';

// ─────────────────────────────────────────────
// 通知頁面
// ─────────────────────────────────────────────
test.describe('通知頁面 — 已登入租客', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
  });

  test('/notifications 頁面正常載入', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: /通知/i })).toBeVisible();
  });

  test('通知頁面顯示分類 Tab', async ({ page }) => {
    await page.goto('/notifications');
    // 應有「全部」分類 tab
    await expect(page.getByRole('tab', { name: /全部/i }).or(
      page.getByRole('button', { name: /全部/i })
    )).toBeVisible();
  });

  test('全部標記已讀按鈕可見', async ({ page }) => {
    await page.goto('/notifications');
    const markAllBtn = page.getByRole('button', { name: /全部標記已讀|全部已讀/i });
    await expect(markAllBtn).toBeVisible();
  });

  test('點擊「全部標記已讀」後未讀角標消失或變為 0', async ({ page }) => {
    await page.goto('/notifications');

    const markAllBtn = page.getByRole('button', { name: /全部標記已讀|全部已讀/i });
    await markAllBtn.click();
    await page.waitForTimeout(500);

    // Navbar 通知角標應消失（紅點/數字）
    const badge = page.locator('[data-testid="notification-badge"], .notification-badge, .badge').first();
    // 角標不存在，或數字為 0
    const isBadgeVisible = await badge.isVisible().catch(() => false);
    if (isBadgeVisible) {
      const badgeText = await badge.textContent();
      expect(badgeText?.trim()).toBe('0');
    }
    // 若角標已隱藏，測試通過
  });
});

// ─────────────────────────────────────────────
// 通知 API
// ─────────────────────────────────────────────
test.describe('通知 API', () => {
  test('GET /api/notifications 返回陣列', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.get('/api/notifications');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('GET /api/notifications 未登入返回 401', async ({ request }) => {
    const res = await request.get('/api/notifications');
    expect(res.status()).toBe(401);
  });

  test('通知物件包含必要欄位', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.get('/api/notifications');
    const notifications: Array<Record<string, unknown>> = await res.json();

    if (notifications.length > 0) {
      const first = notifications[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('type');
      expect(first).toHaveProperty('title');
      expect(first).toHaveProperty('createdAt');
    }
  });

  test('GET /api/status 返回數字（通知未讀數）', async ({ request, page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    const res = await request.get('/api/status');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(typeof data.notificationCount).toBe('number');
  });
});

// ─────────────────────────────────────────────
// Navbar 通知角標
// ─────────────────────────────────────────────
test.describe('Navbar 通知角標', () => {
  test('已登入用戶 Navbar 有通知鈴鐺圖示', async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    await page.goto('/');
    // 通知連結或按鈕
    const notifLink = page.getByRole('link', { name: /通知/i }).or(
      page.locator('[href="/notifications"]')
    ).first();
    await expect(notifLink).toBeVisible();
  });

  test('點擊通知圖示導覽至 /notifications', async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    await page.goto('/');
    const notifLink = page.locator('[href="/notifications"]').first();
    if (await notifLink.isVisible()) {
      await notifLink.click();
      await expect(page).toHaveURL('/notifications');
    }
  });
});

// ─────────────────────────────────────────────
// 房東通知
// ─────────────────────────────────────────────
test.describe('通知 — 房東端', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.landlord);
  });

  test('房東通知頁面正常載入', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: /通知/i })).toBeVisible();
  });

  test('房東 GET /api/notifications 返回陣列', async ({ request, page }) => {
    const res = await request.get('/api/notifications');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
  });
});
