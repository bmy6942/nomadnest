import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  // ✅ 未登入回 401（而非 200 + null）
  // 前端呼叫端均以 r.ok 判斷，改為 401 不影響現有邏輯
  // 同時符合 E2E 測試 protectedEndpoints 對 /api/auth/me 的 401 預期
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
  return NextResponse.json({ user });
}
