/**
 * Next.js 14 自動 OG 圖片生成器（首頁 / 預設）
 * 尺寸：1200 × 630 px（LINE / Twitter / Facebook 標準規格）
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
          background: 'linear-gradient(135deg, #0a1628 0%, #0f2033 45%, #0d2848 100%)',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'sans-serif',
        }}
      >
        {/* ── 背景裝飾：大圓 ── */}
        <div style={{ position: 'absolute', top: -180, right: -180, width: 600, height: 600, borderRadius: '50%', background: 'rgba(37,99,235,0.08)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -100, width: 380, height: 380, borderRadius: '50%', background: 'rgba(255,200,60,0.05)', display: 'flex' }} />

        {/* ── 左側：LOGO + 文案 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '72px 80px', flex: 1 }}>

          {/* Logo 行 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 52 }}>
            {/* Icon mark (SVG inline) */}
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'linear-gradient(160deg, #1a3a5c, #0f2033)',
              border: '1.5px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32,
            }}>
              🏡
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px', lineHeight: 1 }}>
                NomadNest
              </span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', letterSpacing: '3px', marginTop: 4 }}>
                TAIWAN
              </span>
            </div>
          </div>

          {/* 主標題 */}
          <div style={{ fontSize: 58, fontWeight: 800, color: '#ffffff', lineHeight: 1.15, letterSpacing: '-1px', marginBottom: 20 }}>
            找到你的<span style={{ color: '#FFC83C' }}>游牧基地</span>
          </div>
          <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.65)', marginBottom: 52, lineHeight: 1.5 }}>
            台灣最懂游牧工作者的租屋媒合平台
          </div>

          {/* 標籤列 */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {['⚡ Wi-Fi 速度實測', '📄 線上合約', '🌍 外籍友善', '🏙 全台 25 城市'].map(tag => (
              <div key={tag} style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: 8, padding: '10px 18px',
                fontSize: 17, color: 'rgba(255,255,255,0.85)',
              }}>
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* ── 右側：數據卡片 ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 16, padding: '72px 80px 72px 0', width: 280,
        }}>
          {[
            { num: '41+', label: '上架房源' },
            { num: '25', label: '覆蓋城市' },
            { num: '5.0', label: '平均評分' },
          ].map(item => (
            <div key={item.label} style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16, padding: '22px 28px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <span style={{ fontSize: 44, fontWeight: 800, color: '#FFC83C', lineHeight: 1 }}>{item.num}</span>
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* ── 底部金色線條 ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
          background: 'linear-gradient(90deg, #FFC83C, #FF9F1C, #FFC83C)',
          display: 'flex',
        }} />

        {/* URL */}
        <div style={{ position: 'absolute', bottom: 18, right: 48, fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>
          nomadnest-sigma.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
