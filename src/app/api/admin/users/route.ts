import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notifyVerificationResult, notifyUserBanned, notifyUserUnbanned } from '@/lib/email';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

// GET /api/admin/users — 取得所有用戶（含統計數字）
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role') || 'all';
  const search = searchParams.get('q') || '';

  const where: Record<string, unknown> = {};
  if (role !== 'all') where.role = role;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, role: true, phone: true,
      verified: true, banned: true, createdAt: true, idDocUrl: true,
      _count: {
        select: {
          listings: true,
          applications: true,
          reviewsGiven: true,
          tenantConversations: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500, // 防止平台用戶過多時返回海量資料
  });

  return NextResponse.json(users);
}

// PATCH /api/admin/users — 更新用戶狀態
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // ── JSON 解析（防止畸形請求觸發 500）──────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { id, action } = body; // action: 'verify' | 'unverify' | 'ban' | 'unban' | 'setRole'

  // ✅ id / action 型別守衛（空陣列等非字串值會通過 falsy 檢查）
  if (!id || typeof id !== 'string' || !id.trim()) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  if (!action || typeof action !== 'string') {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  // 防止管理員誤操作自己
  if (id === admin.id && (action === 'ban' || action === 'setRole')) {
    return NextResponse.json({ error: 'Cannot modify yourself' }, { status: 400 });
  }

  let updateData: Record<string, unknown> = {};

  switch (action) {
    case 'verify':
      updateData = { verified: true, verificationStatus: 'approved' };
      break;
    case 'unverify':
      updateData = { verified: false, verificationStatus: 'rejected', verificationNote: body.note || null };
      break;
    case 'ban':      updateData = { banned: true };    break;
    case 'unban':    updateData = { banned: false };   break;
    case 'setRole':
      if (typeof body.role !== 'string' || !['tenant', 'landlord', 'admin'].includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      updateData = { role: body.role };
      break;
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  // ✅ 先確認目標用戶存在，避免 prisma.user.update 在用戶不存在時拋出 RecordNotFound → 500
  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { email: true, name: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: '找不到此用戶' }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, verified: true, banned: true, role: true, verificationStatus: true },
  });

  // 📧 身份驗證結果通知
  if (action === 'verify' || action === 'unverify') {
    notifyVerificationResult({
      userEmail: targetUser.email,
      userName: targetUser.name,
      status: action === 'verify' ? 'approved' : 'rejected',
      note: typeof body.note === 'string' ? body.note : null,
    }).catch(() => {});
  }
  // 📧 封禁 / 解封通知
  if (action === 'ban') {
    notifyUserBanned({
      userEmail: targetUser.email,
      userName: targetUser.name,
      reason: typeof body.reason === 'string' ? body.reason : null,
    }).catch(() => {});
  }
  if (action === 'unban') {
    notifyUserUnbanned({
      userEmail: targetUser.email,
      userName: targetUser.name,
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}
