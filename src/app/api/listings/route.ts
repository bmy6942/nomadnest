import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { createListingLimiter } from '@/lib/rateLimit';

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

/** 安全解析整數：若非合法整數則回傳 null（防止 NaN 進入 Prisma where 條件） */
function safeInt(raw: string | null): number | null {
  if (!raw || !raw.trim()) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

/** 關鍵字最大長度（防止過長字串觸發慢速 LIKE 掃描） */
const Q_MAX_LENGTH = 100;
/** 篩選城市白名單（防止任意字串被當作 city 條件注入） */
const ALLOWED_CITIES = new Set(['台北市', '新北市', '台中市', '高雄市', '花蓮縣', '台南市', '桃園市', '其他']);
/** 篩選類型白名單 */
const ALLOWED_FILTER_TYPES = new Set(['套房', '雅房', '整層公寓', '共居空間']);
/** 排序白名單 */
const ALLOWED_SORTS = new Set(['newest', 'price_asc', 'price_desc', 'wifi', 'rating']);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city        = searchParams.get('city');
  const type        = searchParams.get('type');
  const minWifi     = searchParams.get('minWifi');
  const minPrice    = searchParams.get('minPrice');
  const maxPrice    = searchParams.get('maxPrice');
  const minRent     = searchParams.get('minRent');
  const foreignOk   = searchParams.get('foreignOk');
  const hasDesk     = searchParams.get('hasDesk');
  const qRaw        = searchParams.get('q')?.trim();
  const availableBy = searchParams.get('availableBy'); // 'YYYY-MM-DD'
  const nearMRT     = searchParams.get('nearMRT');     // 步行分鐘上限
  const nearCowork  = searchParams.get('nearCowork'); // 步行分鐘上限
  const sortByRaw   = searchParams.get('sortBy') || 'newest';
  const page        = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize    = 24; // 每頁 24 筆

  // ── q 長度守衛：超長字串會讓 SQLite LIKE 掃描極慢 ───────────────────────
  const q = qRaw && qRaw.length <= Q_MAX_LENGTH ? qRaw : (qRaw ? qRaw.slice(0, Q_MAX_LENGTH) : undefined);

  // ── sortBy 白名單（防止非預期值進入 orderBy）────────────────────────────
  const sortBy = ALLOWED_SORTS.has(sortByRaw) ? sortByRaw : 'newest';

  // ── 解析整數篩選條件（safeInt 防止 NaN 傳入 Prisma where）──────────────
  const minWifiInt   = safeInt(minWifi);
  const minPriceInt  = safeInt(minPrice);
  const maxPriceInt  = safeInt(maxPrice);
  const minRentInt   = safeInt(minRent);
  const nearMRTInt   = safeInt(nearMRT);
  const nearCoworkInt = safeInt(nearCowork);

  // ── 基本條件 ────────────────────────────────────────────────────────────
  const where: Record<string, unknown> = { status: 'active' };
  // 城市白名單過濾（防止任意字串成為查詢條件）
  if (city && ALLOWED_CITIES.has(city))           where.city     = city;
  // 類型白名單過濾
  if (type && ALLOWED_FILTER_TYPES.has(type))     where.type     = type;
  if (foreignOk === 'true')                        where.foreignOk = true;
  if (hasDesk   === 'true')                        where.hasDesk   = true;
  if (minWifiInt   !== null) where.wifiSpeed  = { gte: minWifiInt };
  if (nearMRTInt   !== null) where.nearMRT    = { lte: nearMRTInt };
  if (nearCoworkInt !== null) where.nearCowork = { lte: nearCoworkInt };
  if (minPriceInt !== null && maxPriceInt !== null) where.price = { gte: minPriceInt, lte: maxPriceInt };
  else if (minPriceInt !== null)                    where.price = { gte: minPriceInt };
  else if (maxPriceInt !== null)                    where.price = { lte: maxPriceInt };
  if (minRentInt !== null) where.minRent = { lte: minRentInt };

  // ── AND 條件（修正：q 與 availableBy 各自有 OR 子句，用 AND 並行不覆蓋）──
  const andConditions: unknown[] = [];

  if (q) {
    andConditions.push({
      OR: [
        { title:       { contains: q } },
        { description: { contains: q } },
        { district:    { contains: q } },
        { city:        { contains: q } },
        { address:     { contains: q } },
      ],
    });
  }

  if (availableBy) {
    andConditions.push({
      OR: [
        { availableFrom: null },
        { availableFrom: { lte: availableBy } },
      ],
    });
  }

  if (andConditions.length > 0) where.AND = andConditions;

  // ── 排序 ────────────────────────────────────────────────────────────────
  // rating 無法在 DB 層直接排序（需要聚合），仍在回傳後客戶端排序
  let orderBy: Record<string, string> = { createdAt: 'desc' };
  if (sortBy === 'price_asc')  orderBy = { price: 'asc' };
  if (sortBy === 'price_desc') orderBy = { price: 'desc' };
  if (sortBy === 'wifi')       orderBy = { wifiSpeed: 'desc' };

  // ── 查詢（select 只取 Card 需要的欄位，節省 IO）────────────────────────
  const [total, listings] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      select: {
        id: true, title: true, city: true, district: true, type: true,
        price: true, deposit: true, minRent: true, maxRent: true,
        wifiSpeed: true, wifiVerified: true, hasDesk: true,
        naturalLight: true, foreignOk: true, availableFrom: true,
        nearMRT: true, nearCowork: true,
        images: true, lat: true, lng: true, createdAt: true, status: true,
        owner: { select: { name: true, verified: true } },
        reviews: { select: { rating: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const data = listings.map(l => ({
    ...l,
    avgRating: l.reviews.length
      ? (l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length).toFixed(1)
      : null,
    reviewCount: l.reviews.length,
    // ✅ 安全解析 images（DB 資料損壞時防止 JSON.parse 拋出 500，改用空陣列 fallback）
    images: (() => { try { return JSON.parse(l.images || '[]') as string[]; } catch { return []; } })(),
    amenities: [],
    includedFees: [],
  }));

  return NextResponse.json(
    { listings: data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    {
      headers: {
        // 公開房源列表：30 秒快取，stale-while-revalidate 確保流暢
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      },
    }
  );
}

// ── 欄位長度 / 範圍限制 ────────────────────────────────────────────────────
const LISTING_LIMITS = {
  TITLE_MAX:       100,
  DESC_MAX:        3000,
  CITY_MAX:        30,
  DISTRICT_MAX:    30,
  ADDRESS_MAX:     200,
  DESK_SIZE_MAX:   50,
  PRICE_MIN:       1,
  PRICE_MAX:       1_000_000,
  WIFI_MIN:        0,
  WIFI_MAX:        10_000,
  IMAGES_MAX:      20,   // 最多 20 張圖
  AMENITIES_MAX:   50,
} as const;

const ALLOWED_TYPES   = ['套房', '雅房', '整層公寓', '共居空間'] as const;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
  if (user.role === 'tenant') return NextResponse.json({ error: '租客無法刊登房源' }, { status: 403 });

  // ── 速率限制：每用戶每天 10 次建立房源 ────────────────────────────────────
  const rateCheck = createListingLimiter.check(`create-listing:${user.id}`);
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: `建立房源次數過多，請在 ${rateCheck.retryAfter} 秒後再試` },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON 資料' }, { status: 400 });
  }

  // ── 必填欄位型別驗證 ────────────────────────────────────────────────────
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
  if (title.length       > LISTING_LIMITS.TITLE_MAX)
    return NextResponse.json({ error: `標題不得超過 ${LISTING_LIMITS.TITLE_MAX} 個字元` }, { status: 400 });
  if (description.length > LISTING_LIMITS.DESC_MAX)
    return NextResponse.json({ error: `描述不得超過 ${LISTING_LIMITS.DESC_MAX} 個字元` }, { status: 400 });
  if (city.length        > LISTING_LIMITS.CITY_MAX)
    return NextResponse.json({ error: `城市名稱不得超過 ${LISTING_LIMITS.CITY_MAX} 個字元` }, { status: 400 });
  if (district.length    > LISTING_LIMITS.DISTRICT_MAX)
    return NextResponse.json({ error: `地區名稱不得超過 ${LISTING_LIMITS.DISTRICT_MAX} 個字元` }, { status: 400 });
  if (address.length     > LISTING_LIMITS.ADDRESS_MAX)
    return NextResponse.json({ error: `地址不得超過 ${LISTING_LIMITS.ADDRESS_MAX} 個字元` }, { status: 400 });

  // ── 房源類型白名單 ──────────────────────────────────────────────────────
  if (!ALLOWED_TYPES.includes(type as typeof ALLOWED_TYPES[number])) {
    return NextResponse.json({ error: '無效的房源類型' }, { status: 400 });
  }

  // ── 數值範圍驗證 ────────────────────────────────────────────────────────
  const price     = parseInt(String(body.price));
  const deposit   = parseInt(String(body.deposit));
  const minRent   = parseInt(String(body.minRent));
  const maxRent   = parseInt(String(body.maxRent));
  const wifiSpeed = parseInt(String(body.wifiSpeed));

  if (isNaN(price)  || price  < LISTING_LIMITS.PRICE_MIN || price  > LISTING_LIMITS.PRICE_MAX)
    return NextResponse.json({ error: `租金須介於 ${LISTING_LIMITS.PRICE_MIN} 到 ${LISTING_LIMITS.PRICE_MAX} 元之間` }, { status: 400 });
  if (isNaN(deposit) || deposit < 0 || deposit > LISTING_LIMITS.PRICE_MAX)
    return NextResponse.json({ error: '押金數值無效' }, { status: 400 });
  if (isNaN(minRent) || minRent < 1 || isNaN(maxRent) || maxRent < minRent)
    return NextResponse.json({ error: '租期設定無效' }, { status: 400 });
  if (isNaN(wifiSpeed) || wifiSpeed < LISTING_LIMITS.WIFI_MIN || wifiSpeed > LISTING_LIMITS.WIFI_MAX)
    return NextResponse.json({ error: `Wi-Fi 速度須介於 ${LISTING_LIMITS.WIFI_MIN} 到 ${LISTING_LIMITS.WIFI_MAX} Mbps 之間` }, { status: 400 });

  // ── 陣列長度限制 ────────────────────────────────────────────────────────
  const images    = Array.isArray(body.images)    ? body.images    : [];
  const amenities = Array.isArray(body.amenities) ? body.amenities : [];
  if (images.length    > LISTING_LIMITS.IMAGES_MAX)
    return NextResponse.json({ error: `最多上傳 ${LISTING_LIMITS.IMAGES_MAX} 張圖片` }, { status: 400 });
  if (amenities.length > LISTING_LIMITS.AMENITIES_MAX)
    return NextResponse.json({ error: `設施項目不得超過 ${LISTING_LIMITS.AMENITIES_MAX} 項` }, { status: 400 });

  // ── 圖片 URL 安全驗證 ────────────────────────────────────────────────────
  if (images.length > 0 && !validateImageUrls(images))
    return NextResponse.json({ error: '圖片 URL 必須是有效的 HTTPS 連結' }, { status: 400 });

  // ── 座標合法性驗證 ───────────────────────────────────────────────────────
  const lat = body.lat ? parseFloat(String(body.lat)) : null;
  const lng = body.lng ? parseFloat(String(body.lng)) : null;
  if (lat !== null && lng !== null && !isValidCoordinate(lat, lng))
    return NextResponse.json({ error: '座標值超出合法範圍（緯度 -90~90，經度 -180~180）' }, { status: 400 });

  // ── deskSize 長度限制 ───────────────────────────────────────────────────
  const deskSize = typeof body.deskSize === 'string' ? body.deskSize.trim() : undefined;
  if (deskSize && deskSize.length > LISTING_LIMITS.DESK_SIZE_MAX)
    return NextResponse.json({ error: `桌子尺寸描述不得超過 ${LISTING_LIMITS.DESK_SIZE_MAX} 個字元` }, { status: 400 });

  try {
    const listing = await prisma.listing.create({
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
        status:       'pending',
        ownerId:      user.id,
      },
    });
    return NextResponse.json(listing, { status: 201 });
  } catch {
    return NextResponse.json({ error: '建立失敗' }, { status: 500 });
  }
}
