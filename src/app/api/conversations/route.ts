import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/conversations — 取得當前用戶所有對話
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const where = user.role === 'landlord'
    ? { landlordId: user.id }
    : user.role === 'tenant'
    ? { tenantId: user.id }
    : {}; // admin 看全部

  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      listing: { select: { id: true, title: true, city: true, images: true, price: true } },
      tenant:  { select: { id: true, name: true } },
      landlord:{ select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (conversations.length === 0) return NextResponse.json([]);

  // ✅ 一次 groupBy 取得所有對話的未讀數（取代 N+1 count 查詢）
  const convIds = conversations.map(c => c.id);
  const unreadGroups = await prisma.message.groupBy({
    by: ['conversationId'],
    where: {
      conversationId: { in: convIds },
      senderId: { not: user.id },
      read: false,
    },
    _count: { id: true },
  });
  const unreadMap = new Map(unreadGroups.map(g => [g.conversationId, g._count.id]));

  const withUnread = conversations.map(conv => ({
    ...conv,
    unreadCount: unreadMap.get(conv.id) ?? 0,
  }));

  return NextResponse.json(withUnread);
}

// POST /api/conversations — 建立或取得對話（開啟對話窗）
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ── JSON 解析（防止畸形請求觸發 500）──────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { listingId } = body;
  if (!listingId || typeof listingId !== 'string' || !listingId.trim()) {
    return NextResponse.json({ error: '請提供有效的房源 ID' }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return NextResponse.json({ error: '房源不存在' }, { status: 404 });

  // ✅ P1-A：僅允許對上架中的房源發起對話（防止對下架/待審房源騷擾房東）
  if (listing.status !== 'active') {
    return NextResponse.json({ error: '此房源目前不開放聯絡' }, { status: 403 });
  }

  // 確定 tenant 和 landlord
  let tenantId: string, landlordId: string;
  if (user.role === 'tenant') {
    tenantId = user.id;
    landlordId = listing.ownerId;
  } else {
    return NextResponse.json({ error: '房東不能主動建立對話，需由房客發起' }, { status: 403 });
  }

  // 找已存在的對話，否則建立新的
  const existing = await prisma.conversation.findUnique({
    where: { listingId_tenantId: { listingId, tenantId } },
  });

  if (existing) return NextResponse.json(existing);

  const conversation = await prisma.conversation.create({
    data: { listingId, tenantId, landlordId },
  });

  return NextResponse.json(conversation, { status: 201 });
}
