import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';
import { uploadLimiter } from '@/lib/rateLimit';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * 魔術位元組驗證 — 防止攻擊者偽造 Content-Type
 * 只信任檔案本身的二進位簽章，而非用戶端宣告的 MIME type
 *
 * 簽章參考：
 *   JPEG  : FF D8 FF
 *   PNG   : 89 50 4E 47 (‰PNG)
 *   GIF   : 47 49 46 38 (GIF8)
 *   WebP  : 52 49 46 46 ??×4 57 45 42 50 (RIFF????WEBP)
 */
function validateMagicBytes(buf: Uint8Array, mimeType: string): boolean {
  if (buf.length < 12) return false; // 檔案過小，可能已損壞
  switch (mimeType) {
    case 'image/jpeg':
      return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    case 'image/png':
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    case 'image/gif':
      return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
    case 'image/webp':
      // RIFF header + WEBP at offset 8
      return buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
             buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
    default:
      return false;
  }
}

/**
 * POST /api/upload
 * 上傳圖片至 Supabase Storage，回傳公開 URL 陣列
 *
 * Body（multipart/form-data）：
 *   files  — 一或多個圖片檔（最多 5 張）
 *   folder — 儲存資料夾：'listings' | 'avatars' | 'docs'（預設 'listings'）
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ── 速率限制：每用戶每小時 30 次上傳 ──────────────────────────────────────
  const rateCheck = uploadLimiter.check(`upload:${user.id}`);
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: `上傳次數過多，請在 ${rateCheck.retryAfter} 秒後再試` },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: '無法解析表單資料' }, { status: 400 });
  }

  const files = formData.getAll('files') as File[];
  const folder = (formData.get('folder') as string) || 'listings';

  // 驗證 folder 白名單
  if (!['listings', 'avatars', 'docs'].includes(folder)) {
    return NextResponse.json({ error: '不合法的上傳資料夾' }, { status: 400 });
  }

  if (!files || files.length === 0) {
    return NextResponse.json({ error: '請選擇至少一張圖片' }, { status: 400 });
  }
  if (files.length > 5) {
    return NextResponse.json({ error: '一次最多上傳 5 張' }, { status: 400 });
  }

  const urls: string[] = [];

  for (const file of files) {
    // ── 型態驗證 ────────────────────────────────
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: `不支援的檔案格式：${file.type}（僅限 JPG / PNG / WebP / GIF）` },
        { status: 400 }
      );
    }

    // ── 大小驗證 ────────────────────────────────
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `「${file.name}」超過 5MB 上限（實際：${(file.size / 1024 / 1024).toFixed(1)}MB）` },
        { status: 400 }
      );
    }

    // ── 產生唯一檔名，避免覆蓋 ─────────────────
    const random = Math.random().toString(36).slice(2, 10);
    const filename = `${folder}/${user.id}/${Date.now()}-${random}${ext}`;

    // ── 讀取檔案並驗證魔術位元組 ────────────────
    const bytes = await file.arrayBuffer();
    // ✅ 魔術位元組驗證 — file.type 完全由用戶端控制，必須以檔案本身的二進位簽章為準
    if (!validateMagicBytes(new Uint8Array(bytes), file.type)) {
      return NextResponse.json(
        { error: `「${file.name}」的實際格式與宣告的格式不符，請重新選擇圖片` },
        { status: 400 }
      );
    }

    // ── 上傳至 Supabase Storage ─────────────────
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(filename, Buffer.from(bytes), {
        contentType: file.type,
        upsert: false,             // 不覆蓋同名檔（由唯一 filename 保證）
        cacheControl: '31536000',  // 1 年快取（immutable）
      });

    if (uploadError) {
      console.error('[upload] Supabase error:', uploadError);
      return NextResponse.json(
        { error: `上傳失敗：${uploadError.message}` },
        { status: 500 }
      );
    }

    // ── 取得公開 URL ────────────────────────────
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filename);

    urls.push(publicUrlData.publicUrl);
  }

  return NextResponse.json({ urls });
}
