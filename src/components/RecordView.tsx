'use client';
import { useEffect } from 'react';

/**
 * 在房源詳細頁掛載時，靜默記錄一次瀏覽
 * （fire-and-forget，不影響主渲染）
 */
export default function RecordView({ listingId }: { listingId: string }) {
  useEffect(() => {
    fetch('/api/listings/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId }),
    }).catch(() => {}); // 失敗靜默處理
  }, [listingId]);

  return null; // 不渲染任何元素
}
