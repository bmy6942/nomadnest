/**
 * Next.js 14 自動 OG 圖片生成器（首頁 / 預設）
 * 路徑：/opengraph-image  ← 自動被 layout.ts metadata.openGraph.images 使用
 * 尺寸：1200 × 630 px（標準 OG 規格）
 */
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'NomadNest Taiwan — 數位游牧租屋媒合平台';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0f2033 0%, #1a3a5c 60%, #0d2d4a 100%)',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'sans-serif',
        }}
      >
        {/* 背景裝飾圓圈 */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
          }}
        />

        {/* 主內容 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '72px 80px',
            height: '100%',
          }}
        >
          {/* Logo 行 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 48,
            }}
          >
            <div
              style={{
                fontSize: 48,
                lineHeight: 1,
              }}
            >
              🏡
            </div>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.5px',
              }}
            >
              NomadNest Taiwan
            </span>
          </div>

          {/* 主標題 */}
          <div
            style={{
              fontSize: 60,
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.15,
              letterSpacing: '-1px',
              marginBottom: 24,
              flex: 1,
            }}
          >
            數位游牧工作者的
            <br />
            台灣首選租屋平台
          </div>

          {/* 副標題 */}
          <div
            style={{
              fontSize: 26,
              color: 'rgba(255,255,255,0.75)',
              marginBottom: 48,
              lineHeight: 1.4,
            }}
          >
            Wi-Fi 速度保證 · 線上合約 · 押金信託 · 外籍友善
          </div>

          {/* 底部標籤 */}
          <div style={{ display: 'flex', gap: 16 }}>
            {['🌐 Wi-Fi 驗證', '📄 線上合約', '🌍 外籍友善', '🏙 全台灣'].map(tag => (
              <div
                key={tag}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 18,
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* 右下角 URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            right: 48,
            fontSize: 18,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          nomadnest.tw
        </div>
      </div>
    ),
    { ...size }
  );
}
