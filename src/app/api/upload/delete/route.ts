import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin, STORAGE_BUCKET, extractStoragePath } from '@/lib/supabase';

/**
 * DELETE /api/upload/delete
 * 從 Supabase Storage 刪除指定圖片
 *
 * Body（JSON）：
 *   url  — 要刪除的完整 Supabase 公開 URL
 *   urls — 批次刪除（陣列）
 *
 * 安全性：
 *   - 只能刪除路徑以 /{userId}/ 開頭的檔案（用戶只能刪自己的）
 *   - Admin 可刪除任何檔案
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: '無效的請求內容' }, { status: 400 });
  }

  // ✅ 執行期型別守衛 — TypeScript 型別僅在編譯期有效，需在 runtime 驗證
  const urlField  = body.url;
  const urlsField = body.urls;

  // urls 若存在必須是字串陣列
  if (urlsField !== undefined && !Array.isArray(urlsField)) {
    return NextResponse.json({ error: 'urls 必須為陣列' }, { status: 400 });
  }

  const rawUrls: string[] = Array.isArray(urlsField)
    ? urlsField
    : (typeof urlField === 'string' && urlField.trim() ? [urlField] : []);

  if (!rawUrls.length) {
    return NextResponse.json({ error: '請提供要刪除的圖片 URL' }, { status: 400 });
  }

  // ✅ 數量上限 — 防止惡意提交大量 URL 耗盡 Supabase Storage I/O
  if (rawUrls.length > 20) {
    return NextResponse.json({ error: '一次最多刪除 20 張圖片' }, { status: 400 });
  }

  const pathsToDelete: string[] = [];

  for (const url of rawUrls) {
    // ✅ 逐項型別守衛 — 確保每個 URL 都是字串
    if (typeof url !== 'string' || !url.trim()) continue;
    const path = extractStoragePath(url);
    if (!path) {
      // 可能是 Unsplash 種子圖片或本地路徑，跳過
      continue;
    }

    // 安全性：一般用戶只能刪自己的檔案（路徑包含 userId）
    if (user.role !== 'admin' && !path.includes(`/${user.id}/`)) {
      return NextResponse.json(
        { error: '無權刪除他人的圖片' },
        { status: 403 }
      );
    }

    pathsToDelete.push(path);
  }

  if (!pathsToDelete.length) {
    // 全部是外部 URL，視為成功（無需刪除）
    return NextResponse.json({ deleted: 0 });
  }

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .remove(pathsToDelete);

  if (error) {
    console.error('[upload/delete] Supabase error:', error);
    return NextResponse.json({ error: `刪除失敗：${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ deleted: pathsToDelete.length });
}
