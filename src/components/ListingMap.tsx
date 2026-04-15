'use client';

import { useEffect, useRef, useState } from 'react';

export type MapListing = {
  id: string;
  title: string;
  city: string;
  price: number;
  lat: number | null;
  lng: number | null;
  images: string[] | string;
  wifiSpeed?: number;
  type?: string;
};

type SingleProps = {
  lat: number;
  lng: number;
  title: string;
  address?: string;
  listings?: never;
  onSelect?: never;
  highlightId?: never;
};

type MultiProps = {
  listings: MapListing[];
  onSelect?: (id: string) => void;
  highlightId?: string | null; // ✅ 新增：高亮指定房源
  lat?: never;
  lng?: never;
  title?: never;
  address?: never;
};

type Props = SingleProps | MultiProps;

declare global {
  interface Window {
    L: typeof import('leaflet');
  }
}

// 依房型對應顏色與 emoji
function typeStyle(type?: string) {
  switch (type) {
    case '套房':     return { bg: '#3b82f6', emoji: '🏠' };
    case '雅房':     return { bg: '#8b5cf6', emoji: '🛏' };
    case '整層公寓': return { bg: '#059669', emoji: '🏢' };
    case '共居空間': return { bg: '#f59e0b', emoji: '👥' };
    default:         return { bg: '#2563eb', emoji: '🏡' };
  }
}

export default function ListingMap(props: Props) {
  const mapRef         = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef     = useRef<Map<string, any>>(new Map());
  const mapInitRef     = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState('');

  // ── Effect 1：載入 Leaflet CSS + JS ─────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) { setLoaded(true); return; }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id   = 'leaflet-css';
      link.rel  = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const script    = document.createElement('script');
    script.src      = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload   = () => setLoaded(true);
    script.onerror  = () => setError('地圖載入失敗');
    document.head.appendChild(script);
  }, []);

  // ── Effect 2（單點模式）：房源詳情頁 ──────────────────────────
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    if (!('lat' in props) || !props.lat || !props.lng) return;

    const L = window.L;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;

    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const map = L.map(mapRef.current).setView([props.lat, props.lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          <div style="background:#2563eb;color:#fff;padding:6px 12px;border-radius:20px;
            font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(37,99,235,0.4);
            border:2px solid #fff;white-space:nowrap;">📍 ${props.title}</div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
            border-top:8px solid #2563eb;margin-top:-1px;"></div>
        </div>`,
      iconAnchor: [60, 46],
      iconSize:   [120, 46],
    });
    L.marker([props.lat, props.lng], { icon: pinIcon }).addTo(map);
    mapInstanceRef.current = map;
  }, [loaded, props.lat, props.lng, props.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 3（多點模式）：初始化地圖 + 隨 listings 更新標記 ──
  useEffect(() => {
    if (!loaded || !mapRef.current || !('listings' in props)) return;

    const L = window.L;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;

    const valid = (props.listings || []).filter(l => l.lat && l.lng);

    // 初始化地圖實例（只做一次）
    if (!mapInitRef.current) {
      const centerLat = valid.length > 0
        ? valid.reduce((s, l) => s + (l.lat || 0), 0) / valid.length : 25.04;
      const centerLng = valid.length > 0
        ? valid.reduce((s, l) => s + (l.lng || 0), 0) / valid.length : 121.50;

      const map = L.map(mapRef.current, { zoomControl: false }).setView([centerLat, centerLng], 13);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: 'topright' }).addTo(map);
      mapInstanceRef.current = map;
      mapInitRef.current = true;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // 清除舊標記
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    // 注入 popup 樣式（只注入一次）
    if (!document.getElementById('nomad-popup-style')) {
      const style = document.createElement('style');
      style.id = 'nomad-popup-style';
      style.textContent = `
        .nomad-popup .leaflet-popup-content-wrapper {
          padding:0;border-radius:12px;
          box-shadow:0 8px 24px rgba(0,0,0,0.15);overflow:hidden;
        }
        .nomad-popup .leaflet-popup-content { margin:0; }
        .nomad-popup .leaflet-popup-tip-container { display:none; }
        @keyframes markerPulse {
          0%,100%{ transform:scale(1); }
          50%{ transform:scale(1.15); }
        }
        .marker-highlight { animation:markerPulse 1s ease-in-out infinite; }
      `;
      document.head.appendChild(style);
    }

    // 建立新標記
    valid.forEach(listing => {
      if (!listing.lat || !listing.lng) return;
      const { bg, emoji } = typeStyle(listing.type);
      const isHighlighted  = listing.id === (props as MultiProps).highlightId;
      const priceLabel     = listing.price >= 10000
        ? `${(listing.price / 10000).toFixed(1)}萬`
        : `${listing.price.toLocaleString()}`;

      const icon = L.divIcon({
        className: '',
        html: `
          <div class="${isHighlighted ? 'marker-highlight' : ''}" style="
            display:flex;flex-direction:column;align-items:center;
            cursor:pointer;filter:drop-shadow(0 ${isHighlighted ? '6px 12px' : '3px 6px'} rgba(0,0,0,${isHighlighted ? '0.35' : '0.2'}));
          ">
            <div style="
              background:${isHighlighted ? '#fff' : bg};
              color:${isHighlighted ? bg : '#fff'};
              padding:${isHighlighted ? '6px 12px' : '5px 10px'};
              border-radius:20px;font-size:${isHighlighted ? '13px' : '12px'};font-weight:700;
              border:${isHighlighted ? `3px solid ${bg}` : '2.5px solid #fff'};
              display:flex;align-items:center;gap:4px;white-space:nowrap;
            ">
              <span style="font-size:${isHighlighted ? '14px' : '13px'};">${emoji}</span>
              <span>NT$${priceLabel}</span>
            </div>
            <div style="width:0;height:0;border-left:5px solid transparent;
              border-right:5px solid transparent;
              border-top:7px solid ${isHighlighted ? bg : bg};margin-top:-1px;"></div>
          </div>`,
        iconAnchor: [isHighlighted ? 48 : 40, isHighlighted ? 44 : 40],
        iconSize:   [isHighlighted ? 96 : 80, isHighlighted ? 44 : 40],
      });

      const imgs: string[] = Array.isArray(listing.images)
        ? listing.images
        : (() => { try { return JSON.parse(listing.images as string); } catch { return []; } })();

      const imgHtml  = imgs[0]
        ? `<img src="${imgs[0]}" style="width:100%;height:100px;object-fit:cover;border-radius:8px 8px 0 0;" />`
        : `<div style="width:100%;height:60px;background:linear-gradient(135deg,${bg}22,${bg}44);border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;font-size:28px;">${emoji}</div>`;
      const wifiHtml = listing.wifiSpeed
        ? `<span style="background:#f0fdf4;color:#16a34a;padding:2px 7px;border-radius:10px;font-size:11px;">⚡ ${listing.wifiSpeed}Mbps</span>`
        : '';
      const typeHtml = listing.type
        ? `<span style="background:#eff6ff;color:#2563eb;padding:2px 7px;border-radius:10px;font-size:11px;">${listing.type}</span>`
        : '';

      const marker = L.marker([listing.lat!, listing.lng!], { icon }).addTo(map);
      marker.bindPopup(`
        <div style="width:190px;font-family:system-ui,sans-serif;overflow:hidden;border-radius:10px;">
          ${imgHtml}
          <div style="padding:10px 12px 12px;">
            <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:3px;line-height:1.3;">
              ${listing.title}
            </div>
            <div style="color:#64748b;font-size:11px;margin-bottom:7px;">📍 ${listing.city}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
              ${typeHtml}${wifiHtml}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="font-size:16px;font-weight:800;color:${bg};">
                NT$${listing.price.toLocaleString()}
                <span style="font-size:11px;color:#94a3b8;font-weight:400;">/月</span>
              </div>
              <a href="/listings/${listing.id}"
                style="background:${bg};color:#fff;padding:5px 12px;border-radius:8px;font-size:11px;font-weight:600;text-decoration:none;">
                查看 →
              </a>
            </div>
          </div>
        </div>
      `, { maxWidth: 200, className: 'nomad-popup' });

      if ((props as MultiProps).onSelect) {
        marker.on('click', () => (props as MultiProps).onSelect!(listing.id));
      }

      markersRef.current.set(listing.id, marker);
    });

    // 自動縮放到所有標記的範圍
    if (valid.length > 0) {
      try {
        const bounds = L.latLngBounds(valid.map(l => [l.lat!, l.lng!] as [number, number]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: false });
      } catch {/* 邊界計算失敗時忽略 */}
    }
  }, [loaded, props.listings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 4（多點模式）：高亮變化時飛到指定房源並開 Popup ──
  useEffect(() => {
    if (!loaded || !mapInstanceRef.current || !('listings' in props)) return;
    const highlightId = (props as MultiProps).highlightId;
    if (!highlightId) return;

    const listing = ((props as MultiProps).listings || []).find(l => l.id === highlightId);
    if (listing?.lat && listing?.lng) {
      mapInstanceRef.current.flyTo([listing.lat, listing.lng], 15, { animate: true, duration: 0.6 });
      const marker = markersRef.current.get(highlightId);
      if (marker) setTimeout(() => marker.openPopup(), 650); // 等飛行動畫結束再開 popup
    }
  }, [(props as MultiProps).highlightId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 5：組件卸載時清理 ─────────────────────────────────
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        mapInitRef.current = false;
      }
    };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-xl h-full text-gray-400 text-sm">
        🗺️ {error}
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-xl h-full">
        <div className="text-center text-gray-400">
          <div className="text-3xl mb-2 animate-pulse">🗺️</div>
          <div className="text-sm">地圖載入中…</div>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: '12px' }} />;
}
