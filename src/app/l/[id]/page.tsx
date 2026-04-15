import { redirect } from 'next/navigation';

/**
 * /l/[id] — 短網址重定向到房源詳情頁 /listings/[id]
 * 用途：分享時網址更短更友善，例如 nomadnest.tw/l/abc123
 */
export default function ShortUrlRedirect({ params }: { params: { id: string } }) {
  redirect(`/listings/${params.id}`);
}
