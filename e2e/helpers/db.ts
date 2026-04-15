/**
 * E2E 測試用資料庫 helpers
 *
 * 透過 API 端點操作，不直接 import Prisma（避免 Node/ESM 模組衝突）
 * 所有清理應在 afterEach / afterAll 執行，保持測試隔離
 */
import { APIRequestContext } from '@playwright/test';

/**
 * 取得第一個 active listing 的 ID（用於需要 listing 的測試）
 */
export async function getFirstActiveListing(request: APIRequestContext) {
  const res = await request.get('/api/listings?status=active&take=1');
  const data = await res.json();
  const listings: Array<{ id: string; title: string }> = data.listings ?? data ?? [];
  if (!listings.length) throw new Error('No active listing found in DB. Run seed first.');
  return listings[0];
}

/**
 * 透過 API 刪除當前用戶建立的最後一筆收藏（cleanup 用）
 */
export async function removeFavorite(
  request: APIRequestContext,
  listingId: string
) {
  await request.delete('/api/favorites', { data: { listingId } });
}
