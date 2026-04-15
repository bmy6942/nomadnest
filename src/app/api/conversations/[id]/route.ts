import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notifyNewMessage } from '@/lib/email';
import { messageEmitter } from '@/lib/messageEvents';
import { messageLimiter } from '@/lib/rateLimit';

// 跑單防止：偵測訊息是否包含聯絡方式
// ⚠️ 注意：規則需精確，避免誤判含價格、日期等一般訊息
function detectContact(text: string): boolean {
  const patterns = [
    /09\d{8}/,                                     // 台灣手機號 (09XXXXXXXX)
    /0\d{1,2}[- ]\d{6,8}/,                        // 市話 (02-XXXXXXXX / 04-XXXXXXXX)
    /\+886[\s-]?\d{7,10}/,                        // 國際撥號格式 (+886...)
    /line\s*id\s*[:：]?\s*\S+/i,                  // LINE ID（含標籤）
    /加\s*line\s*[:：]?\s*\S+/i,                   // 加LINE:xxx
    /line\.me\/ti\//i,                             // LINE 邀請連結
    /@[a-zA-Z0-9_.]{2,}/,                         // @帳號（至少 2 字元才算）
    /fb\.me|facebook\.com|instagram\.com|ig\.me/i,// 社群連結
    /t\.me\/\S+/i,                                 // Telegram 連結
    /wa\.me\/\d+/i,                                // WhatsApp 連結
  ];
  return patterns.some(p => p.test(text));
}

// GET /api/conversations/[id] — 取得對話訊息（含已讀標記）
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      listing: { select: { id: true, title: true, city: true, images: true, price: true, ownerId: true } },
      tenant:  { select: { id: true, name: true, verified: true } },
      landlord:{ select: { id: true, name: true, verified: true } },
      messages: { orderBy: { createdAt: 'asc' }, include: { sender: { select: { name: true } } } },
    },
  });

  if (!conversation) return NextResponse.json({ error: '對話不存在' }, { status: 404 });

  // 權限檢查
  if (conversation.tenantId !== user.id && conversation.landlordId !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: '無權限查看' }, { status: 403 });
  }

  // 將對方發送的訊息標記為已讀
  await prisma.message.updateMany({
    where: { conversationId: params.id, senderId: { not: user.id }, read: false },
    data: { read: true },
  });

  return NextResponse.json(conversation);
}

// POST /api/conversations/[id] — 傳送訊息
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ── 速率限制（移至最前端，快速失敗，減少不必要的 DB 查詢）──────────────
  const rateCheck = messageLimiter.check(`msg:${user.id}`);
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: `訊息發送過於頻繁，請於 ${rateCheck.retryAfter} 秒後再試` },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      listing: { select: { title: true } },
      tenant:  { select: { id: true, name: true, email: true } },
      landlord:{ select: { id: true, name: true, email: true } },
    },
  });
  if (!conversation) return NextResponse.json({ error: '對話不存在' }, { status: 404 });

  if (conversation.tenantId !== user.id && conversation.landlordId !== user.id) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  // ── JSON 解析（防止畸形請求觸發 500）──────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  const { content } = body;
  // ✅ 型別驗證：確保 content 是字串（避免傳入數字/陣列時 .trim() 拋出 TypeError → 500）
  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: '訊息不能為空' }, { status: 400 });
  }
  if (content.length > 1000) return NextResponse.json({ error: '訊息過長（上限 1000 字）' }, { status: 400 });

  const hasContact = detectContact(content);

  const message = await prisma.message.create({
    data: {
      conversationId: params.id,
      senderId: user.id,
      content: content.trim(),
      hasContact,
    },
    include: { sender: { select: { name: true } } },
  });

  // 更新對話的 updatedAt
  await prisma.conversation.update({ where: { id: params.id }, data: { updatedAt: new Date() } });

  // ✅ SSE 即時推送：通知所有訂閱此對話的客戶端
  messageEmitter.emit(params.id, message);

  // 📧 通知對方有新訊息（若對方有未讀訊息則發通知）
  const recipient = user.id === conversation.tenantId ? conversation.landlord : conversation.tenant;
  const unreadCount = await prisma.message.count({
    where: { conversationId: params.id, senderId: user.id, read: false },
  });
  // 只在第一則未讀時發通知（避免每則訊息都寄信）
  if (unreadCount === 1) {
    notifyNewMessage({
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      senderName: user.name,
      listingTitle: conversation.listing.title,
      preview: content.trim(),
      conversationId: params.id,
    }).catch(() => {});
  }

  return NextResponse.json(message, { status: 201 });
}

// PATCH /api/conversations/[id] — 標記該對話所有訊息為已讀（輕量端點供 SSE 使用）
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  // ✅ IDOR 防護：確認用戶是對話的實際參與者才能標記已讀
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    select: { tenantId: true, landlordId: true },
  });
  if (!conversation) return NextResponse.json({ error: '對話不存在' }, { status: 404 });
  if (conversation.tenantId !== user.id && conversation.landlordId !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  await prisma.message.updateMany({
    where: { conversationId: params.id, senderId: { not: user.id }, read: false },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
}
