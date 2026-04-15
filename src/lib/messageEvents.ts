/**
 * 全域 EventEmitter — 用於 SSE 即時訊息推送
 *
 * 以 conversationId 作為 event key。
 * 訊息送出時 emit；SSE 連線監聽 on/off。
 *
 * 注意：此方案僅適用於單一 Node.js 進程。
 * 多實例部署（如 Vercel Serverless）需改用 Redis Pub/Sub。
 */

import { EventEmitter } from 'events';

// 開發模式下使用全域變數避免 Hot-Reload 重複建立
declare global {
  // eslint-disable-next-line no-var
  var _nomadMessageEmitter: EventEmitter | undefined;
}

export const messageEmitter: EventEmitter =
  globalThis._nomadMessageEmitter ?? new EventEmitter();

globalThis._nomadMessageEmitter = messageEmitter;
messageEmitter.setMaxListeners(200); // 支援大量並發 SSE 連線
