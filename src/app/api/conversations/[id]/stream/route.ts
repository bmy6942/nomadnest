import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { messageEmitter } from '@/lib/messageEvents';

/**
 * GET /api/conversations/[id]/stream
 * Server-Sent Events — 即時推送新訊息給聊天室雙方
 *
 * 客戶端使用 `new EventSource('/api/conversations/{id}/stream')`
 * 每當有新訊息送出，伺服器端透過 messageEmitter.emit(conversationId, message)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // 確認用戶有權訪問此對話
  const conv = await prisma.conversation.findUnique({
    where: { id: params.id },
    select: { tenantId: true, landlordId: true },
  });
  if (!conv) return new Response('Not Found', { status: 404 });
  if (conv.tenantId !== user.id && conv.landlordId !== user.id && user.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();
  const conversationId = params.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handler: ((msg: any) => void) | null = null;
  let heartbeatId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 初始確認連線（讓客戶端知道 SSE 已就緒）
      controller.enqueue(encoder.encode(': connected\n\n'));

      // 心跳：每 25 秒一次，防止代理/瀏覽器超時斷線
      heartbeatId = setInterval(() => {
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')); } catch {}
      }, 25_000);

      // 訊息監聽器
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler = (msg: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch {
          // 連線已關閉，忽略
        }
      };

      messageEmitter.on(conversationId, handler);

      // 客戶端斷線時清理
      req.signal.addEventListener('abort', () => {
        if (heartbeatId) clearInterval(heartbeatId);
        if (handler) messageEmitter.off(conversationId, handler);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      if (heartbeatId) clearInterval(heartbeatId);
      if (handler) messageEmitter.off(conversationId, handler);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // 停用 nginx 緩衝，確保即時推送
    },
  });
}
