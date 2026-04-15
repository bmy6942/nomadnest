import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* 大數字 */}
        <div className="relative mb-6">
          <div className="text-[120px] font-black text-gray-100 leading-none select-none">404</div>
          <div className="absolute inset-0 flex items-center justify-center text-6xl">🏠</div>
        </div>

        <h1 className="text-2xl font-bold text-nomad-navy mb-3">找不到這個頁面</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          這個房源可能已下架、網址有誤，或者頁面已搬家。<br />
          試試回到首頁重新搜尋？
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-primary px-8 py-3">🏡 回到首頁</Link>
          <Link href="/listings" className="btn-secondary px-8 py-3">🔍 瀏覽全部房源</Link>
        </div>

        {/* 快速城市連結 */}
        <div className="mt-10">
          <p className="text-xs text-gray-400 mb-3">熱門城市</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { city: '台北市', emoji: '🏙' },
              { city: '台中市', emoji: '🏞' },
              { city: '高雄市', emoji: '🌊' },
              { city: '花蓮縣', emoji: '⛰' },
            ].map(c => (
              <Link key={c.city}
                href={`/listings?city=${encodeURIComponent(c.city)}`}
                className="text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-full border border-gray-200 transition-colors">
                {c.emoji} {c.city}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
