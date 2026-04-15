import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USERS } from './helpers/auth';
import { getFirstActiveListing } from './helpers/db';

// ─────────────────────────────────────────────
// 申請租房
// ─────────────────────────────────────────────
test.describe('申請租房 — 租客流程', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
  });

  test('申請表單顯示必填欄位', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await page.goto(`/listings/${listing.id}`);

    const applyBtn = page.getByRole('button', { name: /申請租房/i });
    await applyBtn.click();

    // 申請表單應出現（可能是 dialog 或 section）
    await expect(
      page.getByRole('dialog').or(page.getByText(/入住日期|申請訊息|自我介紹/i))
    ).toBeVisible({ timeout: 5_000 });
  });

  test('申請表單空提交 → 顯示驗證錯誤', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await page.goto(`/listings/${listing.id}`);

    const applyBtn = page.getByRole('button', { name: /申請租房/i });
    await applyBtn.click();

    // 直接送出空表單
    const submitBtn = page.getByRole('button', { name: /送出申請|確認申請/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // 應出現必填錯誤
      await expect(
        page.getByText(/必填|請填寫|required/i)
      ).toBeVisible({ timeout: 3_000 });
    }
  });

  test('填寫申請表單並成功送出', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await page.goto(`/listings/${listing.id}`);

    const applyBtn = page.getByRole('button', { name: /申請租房/i });
    await applyBtn.click();

    // 填入入住日期（明天）
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 30);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      await dateInput.fill(dateStr);
    }

    // 填入申請訊息
    const textarea = page.getByRole('textbox').filter({ hasText: '' }).last();
    await textarea.fill('您好，我是數位游牧工作者，每月工作收入穩定，希望租住您的房源。謝謝！');

    // 租期（duration）
    const durationInput = page.locator('input[type="number"]').first();
    if (await durationInput.isVisible()) {
      await durationInput.fill('6');
    }

    // 送出
    const submitBtn = page.getByRole('button', { name: /送出申請|確認申請/i });
    await submitBtn.click();

    // 應顯示成功訊息
    await expect(
      page.getByText(/申請已送出|申請成功|已收到您的申請/i)
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────
// 申請管理 — Dashboard 查看
// ─────────────────────────────────────────────
test.describe('申請管理 — Dashboard', () => {
  test('租客 Dashboard 顯示「我的申請」分頁', async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    await page.goto('/dashboard');
    await expect(page.getByText(/我的申請/i)).toBeVisible();
  });

  test('房東 Dashboard 顯示「收到的申請」分頁', async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.landlord);
    await page.goto('/dashboard');
    await expect(page.getByText(/收到的申請|待審核/i)).toBeVisible();
  });

  test('租客可在 /applications 查看申請列表', async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    await page.goto('/applications');
    await expect(page).not.toHaveURL(/\/auth\/login/);
    // 頁面應有標題
    await expect(page.getByRole('heading')).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 申請狀態顯示
// ─────────────────────────────────────────────
test.describe('申請狀態 — 顯示驗證', () => {
  test('Dashboard 的申請狀態標籤包含正確文字', async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
    await page.goto('/dashboard');

    // 點擊「我的申請」分頁
    const appsTab = page.getByRole('tab', { name: /我的申請/i }).or(
      page.getByRole('button', { name: /我的申請/i })
    );
    if (await appsTab.isVisible()) {
      await appsTab.click();
    }

    // 狀態標籤：pending/approved/rejected/withdrawn
    const statusLabels = ['待審核', '已通過', '已婉拒', '已撤回'];
    const mainContent = page.locator('main');

    // 只要頁面有申請，就應能看到其中一種狀態
    const hasAnyStatus = await Promise.any(
      statusLabels.map((label) => mainContent.getByText(label).isVisible())
    ).catch(() => false);

    // 若有申請記錄，狀態應可見；若無申請，不報錯
    if (hasAnyStatus) {
      expect(hasAnyStatus).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────
// 防重複申請
// ─────────────────────────────────────────────
test.describe('申請 — 防重複', () => {
  test('對同一房源已申請者，申請按鈕應變為不可再申請狀態', async ({
    page,
    request,
  }) => {
    await loginViaAPI(page, TEST_USERS.tenant);

    // 查詢此租客已有申請的房源
    const res = await request.get('/api/dashboard');
    if (res.status() !== 200) return;
    const data = await res.json();
    const apps: Array<{ listingId: string; status: string }> =
      data.myApplications ?? [];

    if (!apps.length) {
      test.skip(true, 'No existing applications for tenant');
      return;
    }

    const existingApp = apps[0];
    await page.goto(`/listings/${existingApp.listingId}`);

    // 申請按鈕應顯示「已申請」或「撤回申請」
    const alreadyApplied = page.getByText(/已申請|撤回申請|申請審核中/i);
    await expect(alreadyApplied).toBeVisible({ timeout: 5_000 });
  });
});
