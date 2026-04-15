/**
 * SkeletonCard — 房源卡片骨架屏（Skeleton Loading）
 *
 * 用途：
 *  - 在 ListingCard 資料載入期間顯示佔位骨架，避免 CLS（累積版面偏移）
 *  - 符合 WCAG 2.1 — 提供 aria-hidden 避免螢幕閱讀器播報無意義內容
 *  - 尺寸與 ListingCard 完全一致（h-48 圖片 + p-4 內容區），確保版面穩定
 *
 * 使用方式：
 *   import SkeletonCard from '@/components/SkeletonCard';
 *   <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
 *     {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
 *   </div>
 */

export default function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="card overflow-hidden animate-pulse"
      role="presentation"
    >
      {/* 圖片佔位（h-48 對應 ListingCard 的 h-48） */}
      <div className="h-48 bg-gray-200" />

      {/* 內容區 */}
      <div className="p-4 space-y-3">
        {/* 地區 · 類型 */}
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        {/* 標題 */}
        <div className="space-y-1.5">
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </div>
        {/* Badge 列（Wi-Fi / 書桌） */}
        <div className="flex gap-2">
          <div className="h-5 bg-gray-200 rounded-full w-24" />
          <div className="h-5 bg-gray-200 rounded-full w-16" />
        </div>
        {/* 可入住狀態 */}
        <div className="h-3 bg-gray-200 rounded w-2/5" />
        {/* 價格列 */}
        <div className="flex items-end justify-between pt-1">
          <div>
            <div className="h-6 bg-gray-200 rounded w-28 mb-1" />
            <div className="h-3 bg-gray-200 rounded w-20" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

/** 骨架屏網格：預設顯示 6 張 */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-label="房源載入中…"
      role="status"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardSkeleton — 儀表板骨架屏（消除 1-3 秒空白等待）
// ─────────────────────────────────────────────────────────────────────────────

/** 文字行骨架 */
function SkLine({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} bg-gray-200 rounded animate-pulse`} />;
}

/** 儀表板右上角按鈕區骨架 */
function SkHeaderActions() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
      <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
      <div className="h-9 w-28 bg-gray-200 rounded-xl animate-pulse" />
    </div>
  );
}

/** 儀表板統計卡片骨架（4 格）*/
function SkStatCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 text-center animate-pulse">
          <div className="mx-auto mb-2 h-8 w-8 rounded-full bg-gray-200" />
          <div className="mx-auto mb-1 h-7 w-12 rounded bg-gray-200" />
          <div className="mx-auto h-3 w-16 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

/** 頁籤列骨架 */
function SkTabs({ count = 5 }: { count?: number }) {
  const widths = ['w-24', 'w-28', 'w-32', 'w-20', 'w-24', 'w-20'];
  return (
    <div className="flex gap-2 mb-6 border-b border-gray-200 pb-px overflow-x-auto">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`h-10 ${widths[i % widths.length]} bg-gray-200 rounded-t animate-pulse flex-shrink-0`} />
      ))}
    </div>
  );
}

/** 單一申請/房源列骨架 */
function SkListRow() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 flex gap-4 animate-pulse">
      <div className="w-24 h-20 rounded-xl bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="flex justify-between gap-2">
          <SkLine w="w-1/2" h="h-4" />
          <div className="h-5 w-16 rounded-full bg-gray-200" />
        </div>
        <SkLine w="w-1/3" h="h-3" />
        <div className="flex gap-2 mt-1">
          <div className="h-5 w-24 rounded-full bg-gray-200" />
          <div className="h-5 w-16 rounded-full bg-gray-200" />
        </div>
        <div className="flex gap-2 mt-2">
          <div className="h-8 w-20 rounded-xl bg-gray-200" />
          <div className="h-8 w-20 rounded-xl bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

/** 完整儀表板骨架屏 — 在等待 /api/dashboard 回應時顯示 */
export function DashboardSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8" aria-label="儀表板載入中…" role="status">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <SkLine w="w-36" h="h-7" />
          <SkLine w="w-44" h="h-4" />
        </div>
        <SkHeaderActions />
      </div>

      {/* Stats */}
      <SkStatCards />

      {/* Tabs */}
      <SkTabs count={5} />

      {/* Content rows */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkListRow key={i} />
        ))}
      </div>
    </div>
  );
}

/** 頁籤切換中的輕量骨架（僅 content 區域，不含 header/tabs）*/
export function SkeletonTabContent({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-label="載入中…" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <SkListRow key={i} />
      ))}
    </div>
  );
}

/** 統計分析頁籤骨架（Stats Tab）*/
export function SkeletonStats() {
  return (
    <div className="space-y-6" aria-label="統計載入中…" role="status">
      {/* 總覽卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 animate-pulse">
            <SkLine w="w-3/4" h="h-3" />
            <div className="h-8 w-16 rounded bg-gray-200 mt-2" />
          </div>
        ))}
      </div>
      {/* 房源列表骨架 */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 animate-pulse space-y-3">
          <div className="flex gap-3">
            <div className="w-16 h-12 rounded-lg bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <SkLine w="w-2/3" h="h-4" />
              <SkLine w="w-1/3" h="h-3" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-12 rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 收藏頁骨架屏 */
export function FavoritesSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8" role="status" aria-label="收藏清單載入中…">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <SkLine w="w-32" h="h-7" />
          <SkLine w="w-24" h="h-4" />
        </div>
        <div className="h-9 w-24 rounded-xl bg-gray-200 animate-pulse" />
      </div>
      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MessagesSkeleton — 訊息收件匣骨架屏
// ─────────────────────────────────────────────────────────────────────────────

/** 單一對話列骨架 */
function SkConvRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
      {/* Avatar circle */}
      <div className="w-12 h-12 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="h-4 bg-gray-200 rounded w-28" />
          <div className="h-3 bg-gray-200 rounded w-12 shrink-0" />
        </div>
        <div className="h-3 bg-gray-200 rounded w-44" />
        <div className="h-3 bg-gray-100 rounded w-3/5" />
      </div>
    </div>
  );
}

/** 訊息收件匣骨架屏 */
export function MessagesSkeleton() {
  return (
    <div className="max-w-3xl mx-auto" role="status" aria-label="Loading messages…">
      {/* Header bar */}
      <div className="px-4 pt-8 pb-4 flex items-center justify-between">
        <div className="h-8 w-36 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
      </div>
      {/* Search bar */}
      <div className="px-4 mb-4">
        <div className="h-10 w-full bg-gray-100 rounded-xl animate-pulse" />
      </div>
      {/* Conversation rows */}
      <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden bg-white mx-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkConvRow key={i} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatSkeleton — 聊天對話視窗骨架屏
// ─────────────────────────────────────────────────────────────────────────────

/** 聊天對話視窗骨架屏 */
export function ChatSkeleton() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-64px)]" role="status" aria-label="Loading conversation…">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 animate-pulse shrink-0">
        <div className="w-6 h-6 bg-gray-200 rounded" />
        <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-3 bg-gray-200 rounded w-48" />
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-xl shrink-0" />
      </div>
      {/* Listing bar */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 animate-pulse shrink-0">
        <div className="h-4 bg-gray-200 rounded w-56" />
      </div>
      {/* Messages area */}
      <div className="flex-1 overflow-hidden px-4 py-4 space-y-4">
        {[false, true, false, false, true].map((isMe, i) => (
          <div key={i} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} animate-pulse`}>
            {!isMe && <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0 mt-1" />}
            <div className={`h-10 bg-gray-200 rounded-2xl ${isMe ? 'w-48' : 'w-56'}`} />
          </div>
        ))}
      </div>
      {/* Input area */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 animate-pulse shrink-0">
        <div className="h-11 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

/** Analytics 頁骨架屏 */
export function AnalyticsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8" role="status" aria-label="數據分析載入中…">
      <SkLine w="w-48" h="h-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 animate-pulse">
            <SkLine w="w-2/3" h="h-3" />
            <div className="h-8 w-16 rounded bg-gray-200 mt-2" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 animate-pulse">
              <SkLine w="w-3/4" h="h-4" />
              <SkLine w="w-1/2 mt-2" h="h-3" />
            </div>
          ))}
        </div>
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 animate-pulse">
          <SkLine w="w-1/3" h="h-5" />
          <div className="h-40 rounded-xl bg-gray-100 mt-4" />
          <div className="grid grid-cols-3 gap-4 mt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
