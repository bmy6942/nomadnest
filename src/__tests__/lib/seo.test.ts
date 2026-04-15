import { describe, it, expect } from 'vitest';
import {
  BASE_URL,
  SITE_NAME,
  buildOgMetadata,
  buildListingMetadata,
  buildRentalPropertyJsonLd,
  buildBreadcrumbJsonLd,
  buildWebSiteJsonLd,
  buildOrganizationJsonLd,
  buildSearchMetadata,
} from '@/lib/seo';

// ─── buildOgMetadata ──────────────────────────────────────────────────────────
describe('buildOgMetadata', () => {
  const base = {
    title: '測試標題',
    description: '測試描述',
    url: 'https://nomadnest.tw/listings',
  };

  it('基本欄位皆存在', () => {
    const meta = buildOgMetadata(base);
    expect(meta.title).toBe(base.title);
    expect(meta.description).toBe(base.description);
    expect(meta.alternates?.canonical).toBe(base.url);
  });

  it('openGraph 欄位正確', () => {
    const meta = buildOgMetadata(base);
    const og = meta.openGraph as Record<string, unknown> | undefined;
    expect(og?.['type']).toBe('website');
    expect(meta.openGraph?.locale).toBe('zh_TW');
    expect(meta.openGraph?.siteName).toBe(SITE_NAME);
    expect(meta.openGraph?.url).toBe(base.url);
  });

  it('未提供 image → 使用預設 OG 圖片', () => {
    const meta = buildOgMetadata(base);
    const images = meta.openGraph?.images as { url: string }[];
    expect(images[0].url).toContain(BASE_URL);
    expect(images[0].url).toContain('opengraph-image');
  });

  it('提供自訂 image → 使用自訂圖片', () => {
    const meta = buildOgMetadata({ ...base, image: 'https://example.com/img.jpg' });
    const images = meta.openGraph?.images as { url: string }[];
    expect(images[0].url).toBe('https://example.com/img.jpg');
  });

  it('type=article → openGraph.type=article', () => {
    const meta = buildOgMetadata({ ...base, type: 'article' });
    const og = meta.openGraph as Record<string, unknown> | undefined;
    expect(og?.['type']).toBe('article');
  });

  it('twitter card 正確', () => {
    const meta = buildOgMetadata(base);
    const tw = meta.twitter as Record<string, unknown> | undefined;
    expect(tw?.['card']).toBe('summary_large_image');
    expect(meta.twitter?.title).toBe(base.title);
    expect(meta.twitter?.description).toBe(base.description);
  });
});

// ─── buildListingMetadata ─────────────────────────────────────────────────────
describe('buildListingMetadata', () => {
  const listing = {
    id: 'abc123',
    title: '台北市精品套房',
    description: '寬敞明亮，近捷運站',
    city: '台北市',
    district: '大安區',
    type: '套房',
    price: 25000,
    wifiSpeed: 300,
    images: JSON.stringify(['https://example.com/photo1.jpg']),
  };

  it('標題與 canonical URL 正確', () => {
    const meta = buildListingMetadata(listing);
    expect(meta.title).toBe(listing.title);
    expect(meta.alternates?.canonical).toBe(`${BASE_URL}/listings/${listing.id}`);
  });

  it('描述包含城市、類型、價格與 WiFi 速度', () => {
    const meta = buildListingMetadata(listing);
    expect(meta.description).toContain('台北市');
    expect(meta.description).toContain('套房');
    expect(meta.description).toContain('25,000');
    expect(meta.description).toContain('300');
  });

  it('openGraph title 包含 SITE_NAME', () => {
    const meta = buildListingMetadata(listing);
    expect(String(meta.openGraph?.title)).toContain(SITE_NAME);
  });

  it('images JSON 解析並使用第一張圖片', () => {
    const meta = buildListingMetadata(listing);
    const images = meta.openGraph?.images as { url: string }[];
    expect(images[0].url).toBe('https://example.com/photo1.jpg');
  });

  it('images JSON 無效時 → 使用預設 OG 圖', () => {
    const meta = buildListingMetadata({ ...listing, images: 'not-json' });
    const images = meta.openGraph?.images as { url: string }[];
    expect(images[0].url).toContain('opengraph-image');
  });

  it('images 陣列為空時 → 使用預設 OG 圖', () => {
    const meta = buildListingMetadata({ ...listing, images: '[]' });
    const images = meta.openGraph?.images as { url: string }[];
    expect(images[0].url).toContain('opengraph-image');
  });

  it('description 為 null 不會拋出', () => {
    expect(() => buildListingMetadata({ ...listing, description: null })).not.toThrow();
  });
});

// ─── buildRentalPropertyJsonLd ────────────────────────────────────────────────
describe('buildRentalPropertyJsonLd', () => {
  const listing = {
    id: 'abc123',
    title: '台北市套房',
    description: '舒適套房',
    city: '台北市',
    district: '大安區',
    price: 20000,
    images: ['https://example.com/img.jpg'],
    amenities: ['Wi-Fi', '空調', '洗衣機'],
    reviews: [
      { rating: 5, content: '很棒', reviewer: { name: '小明' } },
      { rating: 4, content: '不錯', reviewer: { name: '小花' } },
    ],
  };

  it('@context 和 @type 正確', () => {
    const ld = buildRentalPropertyJsonLd(listing);
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('RentalProperty');
  });

  it('名稱、描述、URL 正確', () => {
    const ld = buildRentalPropertyJsonLd(listing);
    expect(ld.name).toBe(listing.title);
    expect(ld.description).toBe(listing.description);
    expect(ld.url).toBe(`${BASE_URL}/listings/${listing.id}`);
  });

  it('地址欄位正確', () => {
    const ld = buildRentalPropertyJsonLd(listing);
    const addr = ld.address as Record<string, unknown>;
    expect(addr['@type']).toBe('PostalAddress');
    expect(addr.addressRegion).toBe('台北市');
    expect(addr.addressLocality).toBe('大安區');
    expect(addr.addressCountry).toBe('TW');
  });

  it('offers 欄位正確', () => {
    const ld = buildRentalPropertyJsonLd(listing);
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.price).toBe(20000);
    expect(offers.priceCurrency).toBe('TWD');
  });

  it('有評論時包含 aggregateRating', () => {
    const ld = buildRentalPropertyJsonLd(listing);
    const rating = ld.aggregateRating as Record<string, unknown>;
    expect(rating).toBeDefined();
    expect(rating['@type']).toBe('AggregateRating');
    expect(rating.reviewCount).toBe(2);
    expect(Number(rating.ratingValue)).toBe(4.5);
  });

  it('無評論時不包含 aggregateRating', () => {
    const ld = buildRentalPropertyJsonLd({ ...listing, reviews: [] });
    expect(ld.aggregateRating).toBeUndefined();
  });

  it('amenityFeature 正確映射', () => {
    const ld = buildRentalPropertyJsonLd(listing);
    const amenities = ld.amenityFeature as Array<Record<string, unknown>>;
    expect(amenities).toHaveLength(3);
    expect(amenities[0].name).toBe('Wi-Fi');
    expect(amenities[0].value).toBe(true);
  });
});

// ─── buildBreadcrumbJsonLd ────────────────────────────────────────────────────
describe('buildBreadcrumbJsonLd', () => {
  it('@type 為 BreadcrumbList', () => {
    const ld = buildBreadcrumbJsonLd([{ name: '首頁', url: '/' }]);
    expect(ld['@type']).toBe('BreadcrumbList');
  });

  it('各項目的 position, name, item 正確', () => {
    const items = [
      { name: '首頁', url: '/' },
      { name: '房源列表', url: '/listings' },
      { name: '台北市套房', url: '/listings/abc' },
    ];
    const ld = buildBreadcrumbJsonLd(items);
    const list = ld.itemListElement as Array<Record<string, unknown>>;
    expect(list).toHaveLength(3);
    expect(list[0].position).toBe(1);
    expect(list[0].name).toBe('首頁');
    expect(list[2].position).toBe(3);
    expect(list[2].name).toBe('台北市套房');
  });

  it('相對 URL 自動加上 BASE_URL', () => {
    const ld = buildBreadcrumbJsonLd([{ name: '房源', url: '/listings' }]);
    const list = ld.itemListElement as Array<Record<string, unknown>>;
    expect(list[0].item).toBe(`${BASE_URL}/listings`);
  });

  it('絕對 URL 不重複加上 BASE_URL', () => {
    const ld = buildBreadcrumbJsonLd([{ name: '房源', url: 'https://nomadnest.tw/listings' }]);
    const list = ld.itemListElement as Array<Record<string, unknown>>;
    expect(list[0].item).toBe('https://nomadnest.tw/listings');
  });
});

// ─── buildWebSiteJsonLd ───────────────────────────────────────────────────────
describe('buildWebSiteJsonLd', () => {
  it('型別和基本欄位正確', () => {
    const ld = buildWebSiteJsonLd();
    expect(ld['@type']).toBe('WebSite');
    expect(ld.name).toBe(SITE_NAME);
    expect(ld.url).toBe(BASE_URL);
  });

  it('包含 potentialAction（SearchAction）', () => {
    const ld = buildWebSiteJsonLd();
    const action = ld.potentialAction as Record<string, unknown>;
    expect(action['@type']).toBe('SearchAction');
  });
});

// ─── buildOrganizationJsonLd ──────────────────────────────────────────────────
describe('buildOrganizationJsonLd', () => {
  it('型別和名稱正確', () => {
    const ld = buildOrganizationJsonLd();
    expect(ld['@type']).toBe('Organization');
    expect(ld.name).toBe(SITE_NAME);
    expect(ld.url).toBe(BASE_URL);
  });

  it('包含 contactPoint', () => {
    const ld = buildOrganizationJsonLd();
    const contact = ld.contactPoint as Record<string, unknown>;
    expect(contact['@type']).toBe('ContactPoint');
    expect(contact.email).toBe('support@nomadnest.tw');
  });
});

// ─── buildSearchMetadata ──────────────────────────────────────────────────────
describe('buildSearchMetadata', () => {
  it('無參數 → 預設標題', () => {
    const meta = buildSearchMetadata({});
    expect(meta.title).toContain('游牧');
  });

  it('city + type → 組合標題', () => {
    const meta = buildSearchMetadata({ city: '台北市', type: '套房' });
    expect(meta.title).toContain('台北市');
    expect(meta.title).toContain('套房');
  });

  it('只有 city → 含城市標題', () => {
    const meta = buildSearchMetadata({ city: '高雄市' });
    expect(String(meta.title)).toContain('高雄市');
  });

  it('只有 type → 含類型標題', () => {
    const meta = buildSearchMetadata({ type: '雅房' });
    expect(String(meta.title)).toContain('雅房');
  });

  it('關鍵字搜尋 → 含 q 標題', () => {
    const meta = buildSearchMetadata({ q: '捷運旁' });
    expect(String(meta.title)).toContain('捷運旁');
  });

  it('foreignOk=true → 外籍友善標題', () => {
    const meta = buildSearchMetadata({ foreignOk: 'true' });
    expect(String(meta.title)).toContain('外籍');
  });

  it('hasDesk=true → 有工作桌標題', () => {
    const meta = buildSearchMetadata({ hasDesk: 'true' });
    expect(String(meta.title)).toContain('工作桌');
  });

  it('minWifi → 含速度標題', () => {
    const meta = buildSearchMetadata({ minWifi: '200' });
    expect(String(meta.title)).toContain('200');
  });

  it('canonical URL 包含查詢參數（中文會被 URL 編碼）', () => {
    const meta = buildSearchMetadata({ city: '台北市', type: '套房' });
    const canonical = String(meta.alternates?.canonical);
    const decoded = decodeURIComponent(canonical);
    expect(decoded).toContain('/listings');
    expect(decoded).toContain('city=台北市');
    expect(decoded).toContain('type=套房');
  });
});
