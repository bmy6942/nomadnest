import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { profileUpdateLimiter } from '@/lib/rateLimit';

// ── 欄位長度限制 ────────────────────────────────────────────────────────────────
const PROFILE_LIMITS = {
  NAME_MAX:   50,
  PHONE_MAX:  20,
  LINE_MAX:   50,
  BIO_MAX:   500,
  PWD_MIN:    8,
  PWD_MAX:  128,
} as const;

/** 驗證 avatar URL：必須是合法的 https:// URL（或 null 清除）*/
function isValidAvatarUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// GET /api/profile — 取得當前用戶的完整資料
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // 從資料庫取完整欄位（auth 快取可能缺少新欄位）
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, name: true, email: true, role: true, phone: true,
      lineId: true, bio: true, avatar: true, verified: true,
      verificationStatus: true, idDocUrl: true, createdAt: true,
    },
  });

  return NextResponse.json(full);
}

// PUT /api/profile — 更新個人資料或修改密碼
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ── 速率限制：每用戶每小時 10 次（防暴力刷改密碼）──────────────────────
  const rateCheck = profileUpdateLimiter.check(`profile:${user.id}`);
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: `操作過於頻繁，請於 ${rateCheck.retryAfter} 秒後再試` },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { name, phone, lineId, bio, avatar, currentPassword, newPassword } = body as Record<string, unknown>;

  // ── 欄位型別與長度驗證 ──────────────────────────────────────────────────────
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > PROFILE_LIMITS.NAME_MAX)
      return NextResponse.json({ error: `姓名長度需介於 1～${PROFILE_LIMITS.NAME_MAX} 個字元` }, { status: 400 });
  }
  if (phone !== undefined && phone !== null) {
    if (typeof phone !== 'string' || phone.trim().length > PROFILE_LIMITS.PHONE_MAX)
      return NextResponse.json({ error: `電話號碼不得超過 ${PROFILE_LIMITS.PHONE_MAX} 個字元` }, { status: 400 });
  }
  if (lineId !== undefined && lineId !== null) {
    if (typeof lineId !== 'string' || lineId.trim().length > PROFILE_LIMITS.LINE_MAX)
      return NextResponse.json({ error: `LINE ID 不得超過 ${PROFILE_LIMITS.LINE_MAX} 個字元` }, { status: 400 });
  }
  if (bio !== undefined && bio !== null) {
    if (typeof bio !== 'string' || bio.trim().length > PROFILE_LIMITS.BIO_MAX)
      return NextResponse.json({ error: `自我介紹不得超過 ${PROFILE_LIMITS.BIO_MAX} 個字元` }, { status: 400 });
  }
  if (avatar !== undefined && avatar !== null && avatar !== '') {
    if (typeof avatar !== 'string' || !isValidAvatarUrl(avatar))
      return NextResponse.json({ error: '頭像必須是有效的 HTTPS URL' }, { status: 400 });
  }

  // ── 密碼修改驗證 ────────────────────────────────────────────────────────────
  if (newPassword !== undefined) {
    if (!currentPassword)
      return NextResponse.json({ error: '請輸入目前的密碼' }, { status: 400 });
    if (typeof newPassword !== 'string' || newPassword.length < PROFILE_LIMITS.PWD_MIN || newPassword.length > PROFILE_LIMITS.PWD_MAX)
      return NextResponse.json({ error: `新密碼長度需介於 ${PROFILE_LIMITS.PWD_MIN}～${PROFILE_LIMITS.PWD_MAX} 個字元` }, { status: 400 });

    // ⚠️ 關鍵修正：getCurrentUser() 不含 password 欄位，必須從 DB 另行查詢
    const userWithPwd = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    });
    if (!userWithPwd?.password)
      return NextResponse.json({ error: '此帳號不支援密碼修改（請使用第三方登入）' }, { status: 400 });

    const valid = await bcrypt.compare(String(currentPassword), userWithPwd.password);
    if (!valid)
      return NextResponse.json({ error: '目前密碼不正確' }, { status: 400 });
  }

  // ── 組合更新資料（僅更新有傳入的欄位）──────────────────────────────────────
  const updateData: Record<string, unknown> = {};
  if (name    !== undefined) updateData.name   = String(name).trim();
  if (phone   !== undefined) updateData.phone  = phone   ? String(phone).trim()  : null;
  if (lineId  !== undefined) updateData.lineId = lineId  ? String(lineId).trim() : null;
  if (bio     !== undefined) updateData.bio    = bio     ? String(bio).trim()    : null;
  if (avatar  !== undefined) updateData.avatar = (avatar && avatar !== '') ? String(avatar) : null;
  if (newPassword) updateData.password = await bcrypt.hash(String(newPassword), 12);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: {
      id: true, name: true, email: true, role: true,
      phone: true, lineId: true, bio: true, avatar: true, verified: true,
    },
  });

  return NextResponse.json(updated);
}
