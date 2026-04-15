/**
 * /listings 路由段落 Layout
 * 因為 listings/page.tsx 是 'use client'，無法 export generateMetadata。
 * 改由此 layout.tsx 提供預設的搜尋頁 SEO metadata，
 * 動態篩選器變化由 URL 參數對應的 metadata 在 server component wrapper 中處理。
 */
import type { Metadata } from 'next';
import { buildOgMetadata, BASE_URL } from '@/lib/seo';

export const metadata: Metadata = buildOgMetadata({
  title: '所有游牧友善房源 | NomadNest Taiwan',
  description: '台灣各地游牧工作者首選租屋，Wi-Fi 速度保證、外籍友善、附工作桌，中長租優先。立即瀏覽台北、台中、高雄等熱門城市房源。',
  url: `${BASE_URL}/listings`,
});

export default function ListingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
