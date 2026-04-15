'use client';
// ✅ 同 src/app/listings/page.tsx — 'use client' + 直接 import（不用 dynamic）
// 兩個 page 都是 Client Component，ListingsContent 也是 Client Component
// → 整棵樹都在 Client Component 範圍內，完全不走 RSC client reference 路徑
// → 避免 webpack options.factory undefined 錯誤
import { Suspense } from 'react';
import { SkeletonGrid } from '@/components/SkeletonCard';
import ListingsContent from '@/app/listings/ListingsContent';

function ListingsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-400">
      <div className="mb-6 flex gap-3 flex-wrap justify-center">
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
