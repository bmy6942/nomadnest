import { Page, expect } from '@playwright/test';

/**
 * 測試用帳號（與 prisma/seed.js 一致）
 * 密碼統一為 test123（admin 為 admin123）
 */
export const TEST_USERS = {
  tenant: {
    email: 'sarah@test.com',
    password: 'test123',
    name: 'Sarah Chen',
  },
  landlord: {
    email: 'landlord1@test.com',
    password: 'test123',
    name: '陳大明',
  },
  admin: {
    email: 'admin@nomadnest.tw',
    password: 'admin123',
    name: '系統管理員',
  },
} as const;

/**
 * 透過 UI 登入
 */
export async function loginViaUI(
  page: Page,
  user: { email: string; password: string }
) {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/密碼/i).fill(user.password);
  await page.getByRole('button', { name: /登入/i }).click();
  // 等待跳轉離開登入頁
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
    timeout: 8_000,
  });
}

/**
 * 透過 API cookie 快速登入（跳過 UI，加快測試速度）
 */
export async function loginViaAPI(
  page: Page,
  user: { email: string; password: string }
) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: user.email, password: user.password },
  });
  expect(response.status()).toBe(200);
  // cookie 已由 Set-Cookie header 自動帶入後續請求
}

/**
 * 登出
 */
export async function logout(page: Page) {
  await page.request.post('/api/auth/logout');
  await page.goto('/');
}

/**
 * 確認目前已登入（Navbar 有用戶名稱）
 */
export async function expectLoggedIn(page: Page, name: string) {
  await expect(page.getByText(name)).toBeVisible({ timeout: 5_000 });
}
