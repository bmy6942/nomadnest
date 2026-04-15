'use client';
// ✅ 架構說明（工程師必讀）：
//
// ❌ 錯誤做法 1：Server Component 直接 import ListingsContent（'use client'）
//    → Next.js 在 RSC payload 裡產生 client module reference
//    → 客戶端 webpack 用模組 ID 查找 factory，ID 不一致時
//    → TypeError: Cannot read properties of undefined (reading 'call')
//
// ❌ 錯誤做法 2：'use client' + dynamic(()=>import(ListingsContent), { ssr:false })
//    → ListingsContent 內部又有 dynamic(ListingMap, { ssr:false })
//    → 雙層 ssr:false dynamic import 造成 webpack factory 初始化順序錯誤
//    → 同樣 TypeError: Cannot read properties of undefined (reading 'call')
//
// ✅ 正確做法：'use client' + 直接 import ListingsContent（都是 Client Component）
//    → 完全在 Client Component 樹內，不走 RSC client reference 路徑
//    → ListingsContent 內部的 dynamic(ListingMap, { ssr:false }) 仍正常運作（單層）
//    → useSearchParams() 由外層 <Suspense> 包裹，符合 Next.js App Router 規範
import { Suspense } from 'react';
import { SkeletonGrid } from '@/components/SkeletonCard';
import ListingsContent from './ListingsContent';

function ListingsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 篩選列骨架 */}
      <div className="mb-6 flex gap-3 flex-wrap">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 bg-gray-200 animate-pulse rounded-lg w-24" />
        ))}
      </div>
      <SkeletonGrid count={6} />
    </div>
  );
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<ListingsSkeleton />}>
      <ListingsContent />
    </Suspense>
  );
}
