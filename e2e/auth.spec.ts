import { test, expect } from '@playwright/test';
import { loginViaUI, loginViaAPI, logout, TEST_USERS } from './helpers/auth';

// ─────────────────────────────────────────────
// 登入 / 登出
// ─────────────────────────────────────────────
test.describe('認證 — 登入 / 登出', () => {
  test('正確帳密登入後跳轉首頁，Navbar 顯示用戶名稱', async ({ page }) => {
    await loginViaUI(page, TEST_USERS.tenant);
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.getByText(TEST_USERS.tenant.name)).toBeVisible();
  });

  test('錯誤密碼顯示錯誤訊息，停留登入頁', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(TEST_USERS.tenant.email);
    await page.getByLabel(/密碼/i).fill('wrong-password');
    await page.getByRole('button', { name: /登入/i }).click();
    await expect(page.getByText(/email 或密碼錯誤/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('登入後訪問 /auth/login 應自動跳轉', async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    await page.goto('/auth/login');
    // 已登入時應跳轉走（通常是 / 或 /dashboard）
    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
      timeout: 6_000,
    });
  });

  test('登出後 Navbar 顯示登入按鈕', async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    await page.goto('/');
    await logout(page);
    await expect(page.getByRole('link', { name: /登入/i })).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 受保護路由
// ─────────────────────────────────────────────
test.describe('認證 — 受保護路由', () => {
  const protectedRoutes = [
    '/dashboard',
    '/favorites',
    '/notifications',
    '/profile',
    '/messages',
  ];

  for (const route of protectedRoutes) {
    test(`未登入訪問 ${route} 應跳轉至登入頁`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/auth\/login/, { timeout: 6_000 });
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  }
});

// ─────────────────────────────────────────────
// 角色權限
// ─────────────────────────────────────────────
test.describe('認證 — 角色權限', () => {
  test('租客無法訪問 /admin', async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    await page.goto('/admin');
    // 應該顯示 403 或跳轉走
    const status = page.url();
    const has403 = await page.getByText(/403|無權|forbidden/i).isVisible().catch(() => false);
    const redirectedAway = !status.includes('/admin');
    expect(has403 || redirectedAway).toBeTruthy();
  });

  test('房東可訪問 /submit 上架頁', async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.landlord);
    await page.goto('/submit');
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.getByText(/上架|刊登|房源資訊/i)).toBeVisible();
  });

  test('租客訪問 /submit 應被拒絕或跳轉', async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    await page.goto('/submit');
    const has403 = await page.getByText(/403|無權|僅房東/i).isVisible().catch(() => false);
    const redirected = !page.url().includes('/submit');
    expect(has403 || redirected).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// 忘記密碼流程（只測 UI 呈現，不實際寄信）
// ─────────────────────────────────────────────
test.describe('認證 — 忘記密碼', () => {
  test('填入 email 提交後顯示成功提示', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.getByLabel(/email/i).fill(TEST_USERS.tenant.email);
    await page.getByRole('button', { name: /送出|傳送/i }).click();
    await expect(page.getByText(/已傳送|請查收|check your email/i)).toBeVisible({
      timeout: 8_000,
    });
  });
});
