import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

// ─── PATCH /api/onboarding ─────────────────────────────────────────────────
// 儲存 Onboarding 資料並標記完成
// Body: { bio?: string; preferences?: string[]; role?: 'tenant' | 'landlord' }
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '無效的請求格式' }, { status: 400 });
  }

  const { bio, preferences, role } = body as {
    bio?: unknown;
    preferences?: unknown;
    role?: unknown;
  };

  // ── 驗證 bio ──────────────────────────────────────────────────────────────
  const safeBio =
    typeof bio === 'string' ? bio.trim().slice(0, 300) : undefined;

  // ── 驗證 preferences（字串陣列，每項最長 50 字）──────────────────────────
  const safePrefs: string[] = [];
  if (Array.isArray(preferences)) {
    for (const p of preferences) {
      if (typeof p === 'string' && p.trim().length > 0) {
        safePrefs.push(p.trim().slice(0, 50));
      }
    }
  }

  // ── 驗證 role（只允許 tenant/landlord，且只能與現有 role 相同，防止越權升級）──
  const allowedRoles = ['tenant', 'landlord'] as const;
  const safeRole =
    typeof role === 'string' && allowedRoles.includes(role as typeof allowedRoles[number])
      ? (role as typeof allowedRoles[number])
      : undefined;

  // ── 更新資料庫 ────────────────────────────────────────────────────────────
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      onboardingCompleted: true,
      ...(safeBio !== undefined && { bio: safeBio }),
      ...(safePrefs.length > 0 && { preferences: JSON.stringify(safePrefs) }),
      ...(safeRole && { role: safeRole }),
    },
    select: {
      id: true, name: true, role: true,
      onboardingCompleted: true, bio: true, preferences: true,
    },
  });

  return NextResponse.json({ success: true, user: updated });
}

// ─── GET /api/onboarding ───────────────────────────────────────────────────
// 取得目前用戶的 onboarding 狀態
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { onboardingCompleted: true, bio: true, preferences: true, role: true },
  });

  return NextResponse.json({ onboardingCompleted: dbUser?.onboardingCompleted ?? false });
}
