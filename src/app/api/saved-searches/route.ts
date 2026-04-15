/**
 * /api/saved-searches
 *
 * 儲存搜尋條件，用於新房源到貨通知。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET — 取得目前用戶的所有儲存搜尋
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  try {
    const searches = await prisma.savedSearch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(searches);
  } catch {
    // 表格尚未建立（未執行 migration）
    return NextResponse.json([]);
  }
}

// POST — 新增一筆儲存搜尋
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const { name, city, type, maxPrice, minWifi, q } = await req.json();

  // 上限：每人最多 5 筆
  try {
    const count = await prisma.savedSearch.count({ where: { userId: user.id } });

    if (count >= 5) {
      return NextResponse.json({ error: '最多只能儲存 5 筆搜尋條件' }, { status: 400 });
    }

    const saved = await prisma.savedSearch.create({
      data: {
        userId: user.id,
        name: name || '我的搜尋',
        city:     city     || null,
        type:     type     || null,
        maxPrice: maxPrice ? parseInt(maxPrice) : null,
        minWifi:  minWifi  ? parseInt(minWifi)  : null,
        q:        q        || null,
      },
    });
    return NextResponse.json(saved, { status: 201 });
  } catch {
    return NextResponse.json({ error: '儲存失敗，請確認資料庫已完成更新 (npx prisma db push)' }, { status: 500 });
  }
}

// DELETE — 刪除一筆儲存搜尋
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: '請提供 id' }, { status: 400 });

  try {
    await prisma.savedSearch.deleteMany({
      where: { id, userId: user.id }, // 只能刪自己的
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
