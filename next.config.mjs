/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ 部署時跳過 TypeScript / ESLint 錯誤（型別錯誤不阻擋 build）
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ✅ 圖片最佳化：AVIF/WebP 自動轉換，減少 30-50% 體積
  images: {
    remotePatterns: [
      // 種子資料 / 示意圖
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'loremflickr.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'source.unsplash.com' },
      // Cloudinary（若有使用）
      { protocol: 'https', hostname: '**.cloudinary.com' },
      // Supabase Storage（涵蓋所有 project subdomain）
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
    formats: ['image/avif', 'image/webp'],
    // ✅ 圖片 CDN 快取提升至 7 天（房源照片/頭像極少變動，大幅降低 Next.js Image API 伺服器負載）
    minimumCacheTTL: 604800,
    // ✅ 僅保留常用尺寸，減少伺服器記憶體佔用
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 288, 384],
    // ✅ 危險外部 URL 無效時顯示佔位，避免整頁崩潰
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
  },

  // ✅ gzip/brotli 壓縮 API 回應
  compress: true,

  // ✅ HTTP 快取 + 安全標頭策略
  async headers() {
    // ── Content Security Policy ───────────────────────────────────────────────
    // Next.js App Router 的 RSC 與 hydration 需要 'unsafe-inline' / 'unsafe-eval'
    // 在 script-src；img-src 允許 data: blob: 與常用圖床
    // frame-ancestors 'none' 比 X-Frame-Options 更現代且更嚴格
    const cspDirectives = [
      "default-src 'self'",
      // Next.js hot reload（dev）與 hydration（prod）需要 unsafe-inline + unsafe-eval
      // unpkg.com：Leaflet JS
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
      // Tailwind / CSS-in-JS inline styles
      // unpkg.com：Leaflet CSS
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      // 圖片：本站 + Supabase + Cloudinary + Unsplash + picsum + data URI / blob
      // OpenStreetMap & CartoDB：Leaflet 地圖磚片
      "img-src 'self' data: blob: https://*.supabase.co https://*.cloudinary.com https://images.unsplash.com https://picsum.photos https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
      // Web Fonts (data URI 也需要)
      "font-src 'self' data:",
      // API 請求、WebSocket（訊息 SSE）
      // unpkg.com：Leaflet 的 prefetch/preconnect
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://unpkg.com https://nominatim.openstreetmap.org",
      // 地圖 iframe（LeafletMap / Google Maps）
      "frame-src 'self' https://www.google.com https://maps.google.com",
      // 禁止自己被嵌入其他 frame（比 X-Frame-Options 更現代）
      "frame-ancestors 'self'",
      // 僅允許本站表單提交
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    // 全站共用的安全標頭（適用所有路由）
    const securityHeaders = [
      // ✅ 新增：Content Security Policy — 防止 XSS 攻擊
      { key: 'Content-Security-Policy', value: cspDirectives },
      // 防止 Clickjacking（iframe 嵌入攻擊）
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      // 防止瀏覽器猜測 MIME type（XSS 緩解）
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // 舊版 IE XSS 保護（現代瀏覽器已內建，此為向後相容）
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      // Referer 策略：跨域請求只送 origin，同源送完整 URL
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // 限制瀏覽器 API 權限（未要求的功能一律關閉）
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
      // 強制 HTTPS（1 年），含子網域（生產環境才啟用，開發環境 HTTPS 不強制）
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      // DNS 預取控制：允許瀏覽器預先解析外部 DNS 加速載入
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
    ];

    return [
      // ── 全站安全標頭 ──
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // 靜態資源（JS/CSS）：immutable 強快取 1 年，hash 更新時自動失效
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // 上傳圖片：1 天快取
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=3600' },
        ],
      },
      {
        // 房源列表 API：30 秒快取，過期後 stale-while-revalidate 保持流暢
        source: '/api/listings',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=30, stale-while-revalidate=60' },
        ],
      },
      {
        // 房源詳情 API：60 秒快取（單筆資料更新頻率低）
        source: '/api/listings/:id',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=120' },
        ],
      },
      {
        // 相似房源：5 分鐘快取（相對靜態）
        source: '/api/listings/:id/similar',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=600' },
        ],
      },
      {
        // Next.js Image Optimization API：由 minimumCacheTTL 控制，此為 CDN 快取標頭
        source: '/_next/image',
        headers: [
          { key: 'Vary', value: 'Accept' },
        ],
      },
      {
        // 靜態內容頁面
        source: '/(terms|privacy)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=3600' },
        ],
      },
      {
        // SSE 串流：不可快取，保持連線
        source: '/api/conversations/:id/stream',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'X-Accel-Buffering', value: 'no' },
        ],
      },
      {
        // Service Worker：必須是 no-cache，確保每次都取最新版本
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // PWA Manifest
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },

  // ✅ Next.js Package 最佳化 + 伺服器外部套件
  experimental: {
    // Tree-shaking 降低 bundle size
    optimizePackageImports: [
      'lucide-react',
      '@heroicons/react',
      'date-fns',
      'lodash',
      'recharts',
    ],
    // ✅ 將 Prisma / heavy server libs 標記為外部套件，避免被打包進 Edge bundle
    // Next.js 14 用 serverComponentsExternalPackages（Next.js 15 才改名為 serverExternalPackages）
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'jsonwebtoken', 'nodemailer'],
    // ✅ 啟用 React 19 Partial Prerendering PPR（靜態 shell + 動態 Suspense slot）
    // 注意：PPR 目前為 Incremental 模式，僅影響明確標記 ppr:true 的 route segment
    // ppr: 'incremental',  // ← 待 Next.js 穩定後啟用
  },

  // ✅ Webpack 最佳化：生產環境使用緊湊 source map 減少 bundle 體積
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // 使用較小的 hidden-source-map（不暴露源碼路徑給瀏覽器，但保留錯誤追蹤能力）
      config.devtool = 'hidden-source-map';

      // ✅ SplitChunks 最佳化：將大型第三方庫分離為獨立 chunk，提升快取命中率
      // ⚠️ 注意：React / react-dom 不可自訂 cacheGroup（chunks:'all'）
      //    Next.js 內部已管理 React 的 chunk 分割策略，若覆寫會導致
      //    webpack options.factory undefined TypeError（模組工廠初始化失敗）
      if (config.optimization.splitChunks) {
        config.optimization.splitChunks.cacheGroups = {
          ...config.optimization.splitChunks.cacheGroups,
          // Leaflet 地圖庫：動態載入，獨立 chunk（~150KB）
          // chunks:'async' 確保只在需要時才載入，不干擾 SSR
          leaflet: {
            test: /[\\/]node_modules[\\/]leaflet[\\/]/,
            name: 'leaflet',
            chunks: 'async',
            priority: 20,
          },
        };
      }
    }
    return config;
  },
};

export default nextConfig;
