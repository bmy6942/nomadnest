/**
 * GET /api/search?q=...&limit=5
 *
 * 全站快速搜尋端點（供 Navbar 下拉列表使用）
 * 回傳: { listings: QuickListing[] }
 * 輕量 — 只取 Card 預覽所需的最少欄位
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export type QuickListing = {
  id: string;
  title: string;
  city: string;
  district: string;
  price: number;
  type: string;
  image: string | null;
  ownerVerified: boolean;
};

/** 關鍵字最大長度（防止超長字串觸發慢速全表 LIKE 掃描） */
const SEARCH_Q_MAX = 100;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qRaw  = searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(8, Math.max(1, parseInt(searchParams.get('limit') || '5')));

  // q 長度守衛：截斷超長輸入，防止慢速 LIKE 查詢
  const q = qRaw.length > SEARCH_Q_MAX ? qRaw.slice(0, SEARCH_Q_MAX) : qRaw;

  if (q.length < 1) {
    return NextResponse.json({ listings: [] });
  }

  const rows = await prisma.listing.findMany({
    where: {
      status: 'active',
      OR: [
        { title:       { contains: q } },
        { description: { contains: q } },
        { district:    { contains: q } },
        { city:        { contains: q } },
        { address:     { contains: q } },
      ],
    },
    select: {
      id: true, title: true, city: true, district: true,
      price: true, type: true, images: true,
      owner: { select: { verified: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const listings: QuickListing[] = rows.map(l => {
    let image: string | null = null;
    try { image = (JSON.parse(l.images || '[]') as string[])[0] ?? null; } catch { /* noop */ }
    return {
      id:            l.id,
      title:         l.title,
      city:          l.city,
      district:      l.district,
      price:         l.price,
      type:          l.type,
      image,
      ownerVerified: l.owner.verified,
    };
  });

  return NextResponse.json(
    { listings },
    { headers: { 'Cache-Control': 'private, max-age=10' } }
  );
}
