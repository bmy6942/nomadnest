import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

const ID_DOC_URL_MAX = 2048;
const REAL_NAME_MAX  = 50;

/** 驗證必須是合法的 HTTPS URL */
function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// POST /api/profile/verify — 用戶提出身份驗證申請
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ── JSON 解析（防止畸形請求觸發 500）──────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { idDocUrl, realName } = body;

  // ── idDocUrl 驗證 ──────────────────────────────────────────────────────────
  if (!idDocUrl || typeof idDocUrl !== 'string' || !idDocUrl.trim()) {
    return NextResponse.json({ error: '請上傳身分證明文件' }, { status: 400 });
  }
  if (!isValidHttpsUrl(idDocUrl.trim())) {
    return NextResponse.json({ error: '文件 URL 格式不正確（需為 HTTPS 連結）' }, { status: 400 });
  }
  if (idDocUrl.trim().length > ID_DOC_URL_MAX) {
    return NextResponse.json({ error: '文件 URL 過長' }, { status: 400 });
  }

  // ── realName 驗證（選填）──────────────────────────────────────────────────
  const trimmedName = realName !== undefined && realName !== null && realName !== ''
    ? (typeof realName === 'string' ? realName.trim() : null)
    : null;
  if (realName !== undefined && realName !== null && realName !== '') {
    if (!trimmedName || trimmedName.length === 0 || trimmedName.length > REAL_NAME_MAX) {
      return NextResponse.json(
        { error: `真實姓名長度需介於 1～${REAL_NAME_MAX} 個字元` },
        { status: 400 }
      );
    }
  }

  // 已驗證者不需再申請
  if (user.verified) {
    return NextResponse.json({ error: '你的帳號已通過驗證' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      idDocUrl: idDocUrl.trim(),
      verificationStatus: 'pending',
      // 如果有填真實姓名則更新（選填）
      ...(trimmedName ? { name: trimmedName } : {}),
    },
    select: { id: true, verificationStatus: true },
  });

  return NextResponse.json({ ok: true, status: updated.verificationStatus });
}
