import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// ── PATCH 白名單：僅允許修改這些欄位（防止 mass assignment）──────────────────
const PATCH_ALLOWED_FIELDS = new Set([
  'status',        // 房東下架 / 管理員審核
  'availableFrom', // 更新入住日期
]);

/** 驗證圖片 URL 陣列：每個元素必須是合法 HTTPS URL */
function validateImageUrls(images: unknown[]): boolean {
  return images.every(url => {
    if (typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  });
}

/** 驗證 WGS84 座標是否合法 */
function isValidCoordinate(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: {
      owner:        { select: { id: true, name: true, verified: true, bio: true, createdAt: true } },
      reviews:      { include: { reviewer: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
      applications: { select: { id: true } },
    },
  });
  if (!listing) return NextResponse.json({ error: '找不到此房源' }, { status: 404 });

  // ── 權限守衛：非 active 房源僅限房東本人或管理員存取 ────────────────────────
  // 防止任何人透過猜測 ID 取得 pending/rejected/inactive 房源的完整資訊（IDOR）
  if (listing.status !== 'active') {
    const user = await getCurrentUser();
    if (!user || (user.id !== listing.ownerId && user.role !== 'admin')) {
      return NextResponse.json({ error: '找不到此房源' }, { status: 404 });
    }
  }

  const body = {
    ...listing,
    images:       (() => { try { return JSON.parse(listing.images       || '[]'); } catch { return []; } })(),
    amenities:    (() => { try { return JSON.parse(listing.amenities    || '[]'); } catch { return []; } })(),
    includedFees: (() => { try { return JSON.parse(listing.includedFees || '[]'); } catch { return []; } })(),
    avgRating: listing.reviews.length
      ? (listing.reviews.reduce((s, r) => s + r.rating, 0) / listing.reviews.length).toFixed(1)
      : null,
  };

  // 非 active 不使用公開 CDN 快取（避免快取到審核中的房源被其他人取得）
  const cacheHeader = listing.status === 'active'
    ? 'public, max-age=60, stale-while-revalidate=120'
    : 'private, no-store';

  return NextResponse.json(body, {
    headers: { 'Cache-Control': cacheHeader },
  });
}

// PATCH — 更新部分欄位（e.g., status）
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const listing = await prisma.listing.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: '找不到此房源' }, { status: 404 });
  if (listing.ownerId !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: '無權限修改' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  // ⚠️ 安全：只允許白名單欄位進入 update，防止 mass assignment 攻擊
  const safeData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (PATCH_ALLOWED_FIELDS.has(key)) safeData[key] = value;
  }
  if (Object.keys(safeData).length === 0)
    return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 });

  // status 白名單驗證
  if (safeData.status !== undefined) {
    const validStatuses = ['active', 'inactive', 'pending', 'rejected'];
    if (!validStatuses.includes(String(safeData.status)))
      return NextResponse.json({ error: '無效的狀態值' }, { status: 400 });
    // 非管理員只能將自己的房源切換 active ↔ inactive（不能自行改 pending/rejected）
    if (user.role !== 'admin' && !['active', 'inactive'].includes(String(safeData.status)))
      return NextResponse.json({ error: '無權限設定此狀態' }, { status: 403 });
  }

  const updated = await prisma.listing.update({ where: { id: params.id }, data: safeData });
  return NextResponse.json(updated);
}

// ── PUT 使用與 POST 相同的欄位長度 / 範圍常數 ─────────────────────────────
const PUT_LIMITS = {
  TITLE_MAX:      100,
  DESC_MAX:       3000,
  CITY_MAX:       30,
  DISTRICT_MAX:   30,
  ADDRESS_MAX:    200,
  DESK_SIZE_MAX:  50,
  PRICE_MIN:      1,
  PRICE_MAX:      1_000_000,
  WIFI_MIN:       0,
  WIFI_MAX:       10_000,
  IMAGES_MAX:     20,
  AMENITIES_MAX:  50,
} as const;
const PUT_ALLOWED_TYPES = ['套房', '雅房', '整層公寓', '共居空間'] as const;

// PUT — 完整更新房源資料（房源編輯頁使用）
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  const listing = await prisma.listing.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: '找不到此房源' }, { status: 404 });
  if (listing.ownerId !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: '無權限修改' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  // ── 必填欄位型別驗證（與 POST 一致）────────────────────────────────────
  const title       = typeof body.title       === 'string' ? body.title.trim()       : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const city        = typeof body.city        === 'string' ? body.city.trim()        : '';
  const district    = typeof body.district    === 'string' ? body.district.trim()    : '';
  const address     = typeof body.address     === 'string' ? body.address.trim()     : '';
  const type        = typeof body.type        === 'string' ? body.type               : '';

  if (!title)       return NextResponse.json({ error: '請填寫標題' }, { status: 400 });
  if (!description) return NextResponse.json({ error: '請填寫描述' }, { status: 400 });
  if (!city)        return NextResponse.json({ error: '請填寫城市' }, { status: 400 });
  if (!district)    return NextResponse.json({ error: '請填寫地區' }, { status: 400 });
  if (!address)     return NextResponse.json({ error: '請填寫地址' }, { status: 400 });

  // ── 長度限制 ────────────────────────────────────────────────────────────
  if (title.length       > PUT_LIMITS.TITLE_MAX)
    return NextResponse.json({ error: `標題不得超過 ${PUT_LIMITS.TITLE_MAX} 個字元` }, { status: 400 });
  if (description.length > PUT_LIMITS.DESC_MAX)
    return NextResponse.json({ error: `描述不得超過 ${PUT_LIMITS.DESC_MAX} 個字元` }, { status: 400 });
  if (city.length        > PUT_LIMITS.CITY_MAX)
    return NextResponse.json({ error: `城市名稱不得超過 ${PUT_LIMITS.CITY_MAX} 個字元` }, { status: 400 });
  if (district.length    > PUT_LIMITS.DISTRICT_MAX)
    return NextResponse.json({ error: `地區名稱不得超過 ${PUT_LIMITS.DISTRICT_MAX} 個字元` }, { status: 400 });
  if (address.length     > PUT_LIMITS.ADDRESS_MAX)
    return NextResponse.json({ error: `地址不得超過 ${PUT_LIMITS.ADDRESS_MAX} 個字元` }, { status: 400 });

  // ── 房源類型白名單 ──────────────────────────────────────────────────────
  if (!PUT_ALLOWED_TYPES.includes(type as typeof PUT_ALLOWED_TYPES[number]))
    return NextResponse.json({ error: '無效的房源類型' }, { status: 400 });

  // ── 數值範圍驗證（NaN bypass 防護）──────────────────────────────────────
  const price     = parseInt(String(body.price));
  const deposit   = parseInt(String(body.deposit));
  const minRent   = parseInt(String(body.minRent));
  const maxRent   = parseInt(String(body.maxRent));
  const wifiSpeed = parseInt(String(body.wifiSpeed));

  if (isNaN(price)    || price    < PUT_LIMITS.PRICE_MIN || price    > PUT_LIMITS.PRICE_MAX)
    return NextResponse.json({ error: `租金須介於 ${PUT_LIMITS.PRICE_MIN} 到 ${PUT_LIMITS.PRICE_MAX} 元之間` }, { status: 400 });
  if (isNaN(deposit)  || deposit  < 0                   || deposit  > PUT_LIMITS.PRICE_MAX)
    return NextResponse.json({ error: '押金數值無效' }, { status: 400 });
  if (isNaN(minRent)  || minRent  < 1 || isNaN(maxRent) || maxRent  < minRent)
    return NextResponse.json({ error: '租期設定無效（最短租期不可大於最長租期）' }, { status: 400 });
  if (isNaN(wifiSpeed) || wifiSpeed < PUT_LIMITS.WIFI_MIN || wifiSpeed > PUT_LIMITS.WIFI_MAX)
    return NextResponse.json({ error: `Wi-Fi 速度須介於 ${PUT_LIMITS.WIFI_MIN} 到 ${PUT_LIMITS.WIFI_MAX} Mbps 之間` }, { status: 400 });

  // ── 陣列長度限制 ────────────────────────────────────────────────────────
  const images    = Array.isArray(body.images)    ? body.images    : [];
  const amenities = Array.isArray(body.amenities) ? body.amenities : [];
  if (images.length    > PUT_LIMITS.IMAGES_MAX)
    return NextResponse.json({ error: `最多上傳 ${PUT_LIMITS.IMAGES_MAX} 張圖片` }, { status: 400 });
  if (amenities.length > PUT_LIMITS.AMENITIES_MAX)
    return NextResponse.json({ error: `設施項目不得超過 ${PUT_LIMITS.AMENITIES_MAX} 項` }, { status: 400 });

  // ── 圖片 URL 安全驗證 ────────────────────────────────────────────────────
  if (images.length > 0 && !validateImageUrls(images))
    return NextResponse.json({ error: '圖片 URL 必須是有效的 HTTPS 連結' }, { status: 400 });

  // ── deskSize 長度限制 ───────────────────────────────────────────────────
  const deskSize = typeof body.deskSize === 'string' ? body.deskSize.trim() : undefined;
  if (deskSize && deskSize.length > PUT_LIMITS.DESK_SIZE_MAX)
    return NextResponse.json({ error: `桌子尺寸描述不得超過 ${PUT_LIMITS.DESK_SIZE_MAX} 個字元` }, { status: 400 });

  // ── 座標合法性驗證 ───────────────────────────────────────────────────────
  const lat = body.lat ? parseFloat(String(body.lat)) : null;
  const lng = body.lng ? parseFloat(String(body.lng)) : null;
  if (lat !== null && lng !== null && !isValidCoordinate(lat, lng))
    return NextResponse.json({ error: '座標值超出合法範圍（緯度 -90~90，經度 -180~180）' }, { status: 400 });

  const updated = await prisma.listing.update({
    where: { id: params.id },
    data: {
      title, description, city, district, address, type,
      price, deposit, minRent, maxRent, wifiSpeed,
      hasDesk:      body.hasDesk      !== false,
      deskSize:     deskSize || null,
      naturalLight: parseInt(String(body.naturalLight)) || 3,
      nearCowork:   body.nearCowork   ? parseInt(String(body.nearCowork))  : null,
      nearMRT:      body.nearMRT      ? parseInt(String(body.nearMRT))     : null,
      includedFees: JSON.stringify(Array.isArray(body.includedFees) ? body.includedFees : []),
      amenities:    JSON.stringify(amenities),
      images:       JSON.stringify(images),
      foreignOk:    body.foreignOk    === true,
      lat,
      lng,
      availableFrom: body.availableFrom ? String(body.availableFrom) : null,
      // 編輯後重新進入待審核（管理員除外）
      status: user.role === 'admin' ? listing.status : 'pending',
    },
  });
  return NextResponse.json(updated);
}
