/**
 * /listings 路由的 loading UI
 * Next.js App Router 在等待 Server Component 串流時自動顯示此元件。
 * 搭配 page.tsx 的 <Suspense> 提供雙層 loading 保護。
 */
import { SkeletonGrid } from '@/components/SkeletonCard';

export default function ListingsLoading() {
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
