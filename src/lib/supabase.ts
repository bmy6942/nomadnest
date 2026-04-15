/**
 * Supabase 伺服器端 Client
 *
 * ⚠️  只在 Server Component / API Route 使用（含 SUPABASE_SERVICE_ROLE_KEY）
 *    瀏覽器端請改用 NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Bucket 架構：
 *   nomadnest-uploads/
 *     listings/{userId}/{timestamp}-{random}.{ext}   ← 房源圖片（公開）
 *     avatars/{userId}/{filename}                     ← 用戶頭像（公開）
 *     docs/{userId}/{filename}                        ← 身份驗證文件（公開 bucket，URL 不公開宣傳）
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    '缺少 Supabase 環境變數：請在 .env.local 設定 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY'
  );
}

/**
 * 伺服器端 Admin Client（使用 Service Role Key，可繞過 RLS）
 * 僅用於 API Route，永遠不要暴露給前端
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// Bucket 名稱（需先在 Supabase Dashboard 建立）
export const STORAGE_BUCKET = 'nomadnest-uploads';

/**
 * 建構 Supabase Storage 公開 URL
 * 格式：https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
 */
export function getPublicUrl(path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

/**
 * 從完整 Supabase URL 提取 storage path（用於刪除操作）
 * 例：https://xxx.supabase.co/storage/v1/object/public/nomadnest-uploads/listings/u1/img.jpg
 *     → listings/u1/img.jpg
 */
export function extractStoragePath(url: string): string | null {
  const marker = `/${STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}
