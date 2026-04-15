/**
 * 房源詳情頁 OG 圖片生成器（動態，依房源資料）
 * 路徑：/listings/[id]/opengraph-image
 * 自動被 generateMetadata() 的 openGraph.images 引用
 */
import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs'; // 需要存取 Prisma DB
export const alt = 'NomadNest Taiwan 房源';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { id: string } }) {
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    select: {
      title: true, city: true, district: true, type: true,
      price: true, wifiSpeed: true, foreignOk: true, hasDesk: true,
    },
  }).catch(() => null);

  const title    = listing?.title    ?? 'NomadNest 游牧友善房源';
  const city     = listing?.city     ?? '台灣';
  const district = listing?.district ?? '';
  const type     = listing?.type     ?? '房源';
  const price    = listing?.price    ?? 0;
  const wifi     = listing?.wifiSpeed ?? 0;

  const tags = [
    `📍 ${city}${district}`,
    `🏠 ${type}`,
    `💰 NT$${price.toLocaleString()}/月`,
    wifi > 0 ? `🌐 Wi-Fi ${wifi}Mbps` : null,
    listing?.foreignOk ? '🌍 外籍友善' : null,
    listing?.hasDesk   ? '💻 工作桌'   : null,
  ].filter(Boolean) as string[];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0f2033 0%, #1a3a5c 60%, #0d2d4a 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 裝飾背景 */}
        <div
          style={{
            position: 'absolute', top: -100, right: -100,
            width: 400, height: 400, borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '60px 80px',
            height: '100%',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <span style={{ fontSize: 36 }}>🏡</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
              NomadNest Taiwan
            </span>
          </div>

          {/* 房源標題 */}
          <div
            style={{
              fontSize: title.length > 20 ? 44 : 54,
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.2,
              letterSpacing: '-0.5px',
              marginBottom: 24,
              flex: 1,
            }}
          >
            {title}
          </div>

          {/* 標籤列 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 40 }}>
            {tags.map(tag => (
              <div
                key={tag}
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  borderRadius: 8,
                  padding: '8px 18px',
                  fontSize: 20,
                  color: '#ffffff',
                }}
              >
                {tag}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                background: '#3b82f6',
                borderRadius: 10,
                padding: '12px 28px',
                fontSize: 22,
                fontWeight: 700,
                color: '#ffffff',
              }}
            >
              立即查看房源
            </div>
            <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>nomadnest.tw</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
