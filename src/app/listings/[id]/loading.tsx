/**
 * Loading UI for /listings/[id]
 *
 * Next.js App Router 在導航至房源詳情頁時自動顯示此骨架屏，
 * 取代空白等待畫面，改善感知速度與版面穩定性（CLS）。
 */
export default function ListingDetailLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
      {/* 麵包屑骨架 */}
      <div className="flex gap-2 mb-6">
        <div className="h-4 bg-gray-200 rounded w-12" />
        <div className="h-4 bg-gray-200 rounded w-4" />
        <div className="h-4 bg-gray-200 rounded w-20" />
        <div className="h-4 bg-gray-200 rounded w-4" />
        <div className="h-4 bg-gray-200 rounded w-40" />
      </div>

      {/* 圖片骨架（對應 PhotoGallery 高度） */}
      <div className="h-72 sm:h-96 bg-gray-200 rounded-2xl mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左欄：房源資訊 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 標題 */}
          <div className="space-y-2">
            <div className="h-7 bg-gray-200 rounded w-4/5" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
          {/* Badge 列 */}
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 bg-gray-200 rounded-full w-24" />
            ))}
          </div>
          {/* 說明文字 */}
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
          </div>
          {/* 設施列 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>

        {/* 右欄：申請/聯絡 */}
        <div>
          <div className="bg-gray-100 rounded-2xl p-6 space-y-4 sticky top-24">
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-12 bg-gray-200 rounded-xl w-full" />
            <div className="h-12 bg-gray-200 rounded-xl w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
