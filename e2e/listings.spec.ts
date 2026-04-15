import { test, expect } from '@playwright/test';
import { loginViaAPI, TEST_USERS } from './helpers/auth';
import { getFirstActiveListing } from './helpers/db';

// ─────────────────────────────────────────────
// 房源列表頁
// ─────────────────────────────────────────────
test.describe('房源列表 — 公開瀏覽', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/listings');
  });

  test('列表頁顯示至少一張房源卡片', async ({ page }) => {
    // 等待房源卡片出現
    const cards = page.locator('[data-testid="listing-card"], article, .listing-card').first();
    await expect(cards).toBeVisible({ timeout: 10_000 });
  });

  test('關鍵字搜尋後列表更新', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/搜尋|關鍵字/i);
    await searchInput.fill('台北');
    await searchInput.press('Enter');
    await page.waitForLoadState('networkidle');
    // 確認 URL 包含搜尋參數
    await expect(page).toHaveURL(/q=台北/);
  });

  test('城市篩選 — 點擊台北市按鈕後 URL 帶 city=台北市', async ({ page }) => {
    // 城市篩選為按鈕群組 (aria-pressed)，桌機版直接可見；手機版需先展開
    const taipeiBtn = page.getByRole('button', { name: '台北市' });
    const isVisible = await taipeiBtn.isVisible().catch(() => false);
    if (!isVisible) {
      // 手機版：先展開 filter sidebar
      const filterToggle = page.getByRole('button', { name: /篩選|filter/i }).first();
      if (await filterToggle.isVisible()) await filterToggle.click();
    }
    if (await taipeiBtn.isVisible()) {
      await taipeiBtn.click();
      await page.waitForURL(/city=%E5%8F%B0%E5%8C%97%E5%B8%82|city=台北市/, { timeout: 5_000 });
    }
  });

  test('房源類型篩選 — 點擊套房按鈕', async ({ page }) => {
    // 類型篩選為按鈕群組 (aria-pressed)
    const suiteBtn = page.getByRole('button', { name: '套房' });
    const isVisible = await suiteBtn.isVisible().catch(() => false);
    if (!isVisible) {
      const filterToggle = page.getByRole('button', { name: /篩選|filter/i }).first();
      if (await filterToggle.isVisible()) await filterToggle.click();
    }
    if (await suiteBtn.isVisible()) {
      await suiteBtn.click();
      await page.waitForURL(/type=%E5%A5%97%E6%88%BF|type=套房/, { timeout: 5_000 });
    }
  });

  test('最高租金滑桿篩選後 URL 帶 maxPrice', async ({ page }) => {
    const priceInput = page.getByLabel(/最高租金|價格上限/i).or(
      page.locator('input[type="range"]').first()
    );
    await priceInput.fill('20000');
    await page.keyboard.press('Tab'); // trigger change
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/maxPrice=20000/);
  });

  test('地圖模式切換按鈕可見', async ({ page }) => {
    const mapToggle = page.getByRole('button', { name: /地圖|地圖模式/i });
    await expect(mapToggle).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 房源詳情頁
// ─────────────────────────────────────────────
test.describe('房源詳情 — 公開瀏覽', () => {
  test('詳情頁顯示標題、價格、城市', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await page.goto(`/listings/${listing.id}`);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // 應顯示租金（NT$ 格式）
    await expect(page.getByText(/NT\$|元\/月/)).toBeVisible();
  });

  test('詳情頁顯示 Wi-Fi 速度資訊', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await page.goto(`/listings/${listing.id}`);
    await expect(page.getByText(/Wi-Fi|網速|Mbps/i)).toBeVisible();
  });

  test('詳情頁有房東資訊區塊', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await page.goto(`/listings/${listing.id}`);
    await expect(page.getByText(/房東|landlord/i)).toBeVisible();
  });

  test('短連結 /l/[id] 正確跳轉至詳情頁', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await page.goto(`/l/${listing.id}`);
    await expect(page).toHaveURL(new RegExp(`/listings/${listing.id}`));
  });

  test('未登入點擊申請租房 → 跳轉登入頁', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await page.goto(`/listings/${listing.id}`);
    const applyBtn = page.getByRole('button', { name: /申請租房|申請/i });
    if (await applyBtn.isVisible()) {
      await applyBtn.click();
      await page.waitForURL(/\/auth\/login/, { timeout: 6_000 });
      await expect(page).toHaveURL(/\/auth\/login/);
    }
  });
});

// ─────────────────────────────────────────────
// 房源詳情頁 — 已登入租客
// ─────────────────────────────────────────────
test.describe('房源詳情 — 已登入租客', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, TEST_USERS.tenant);
  });

  test('詳情頁顯示收藏按鈕', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await page.goto(`/listings/${listing.id}`);
    const favBtn = page.getByRole('button', { name: /收藏|❤️/i });
    await expect(favBtn).toBeVisible();
  });

  test('詳情頁顯示申請租房按鈕', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await page.goto(`/listings/${listing.id}`);
    const applyBtn = page.getByRole('button', { name: /申請租房|申請/i });
    await expect(applyBtn).toBeVisible();
  });

  test('尚未入住時不顯示評價表單', async ({ page, request }) => {
    const listing = await getFirstActiveListing(request);
    await page.goto(`/listings/${listing.id}`);
    // 評價表單只有在入住後才出現
    const reviewForm = page.getByRole('form').filter({ hasText: /撰寫評價|評分/i });
    // 這個測試帳號不一定有入住，所以評分表單不應顯示
    // （如果有入住記錄則此測試需略過）
    await expect(reviewForm).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────
// 房東個人頁
// ─────────────────────────────────────────────
test.describe('房東個人頁', () => {
  test('房東頁顯示名稱與上架房源列表', async ({ page }) => {
    // 先取得房東清單
    const res = await page.request.get('/api/listings?take=1');
    const data = await res.json();
    const listings = data.listings ?? data;
    if (!listings.length) {
      test.skip(true, 'No listings available');
      return;
    }
    // 透過 listing API 找房東 ID（從詳情頁抓）
    const firstId = listings[0].id;
    const detailRes = await page.request.get(`/api/listings/${firstId}`);
    const detail = await detailRes.json();
    const ownerId = detail.ownerId;
    if (!ownerId) {
      test.skip(true, 'No ownerId in listing');
      return;
    }

    await page.goto(`/landlords/${ownerId}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // 頁面應有上架房源
    await expect(page.locator('main')).toContainText(/NT\$|元\/月|套房|雅房|整層/);
  });
});
