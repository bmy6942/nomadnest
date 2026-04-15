/**
 * NomadNest Taiwan — 共用 SEO 工具函式
 * 統一管理 Open Graph、Twitter Card、Schema.org JSON-LD 生成邏輯
 */
import type { Metadata } from 'next';

export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nomadnest.tw';
export const SITE_NAME = 'NomadNest Taiwan';
export const TWITTER_HANDLE = '@NomadNestTW';
export const DEFAULT_OG_IMAGE = `${BASE_URL}/opengraph-image`;

// ── 通用 Open Graph 建構器 ────────────────────────────────────────────────────
export function buildOgMetadata({
  title,
  description,
  url,
  image,
  type = 'website',
}: {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: 'website' | 'article';
}): Metadata {
  const ogImage = image
    ? [{ url: image, width: 1200, height: 630, alt: title }]
    : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: title }];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      locale: 'zh_TW',
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: ogImage,
    },
    twitter: {
      card: 'summary_large_image',
      site: TWITTER_HANDLE,
      title,
      description,
      images: image ? [image] : [DEFAULT_OG_IMAGE],
    },
  };
}

// ── 房源詳情頁 metadata ────────────────────────────────────────────────────────
export function buildListingMetadata(listing: {
  id: string;
  title: string;
  description: string | null;
  city: string;
  district: string;
  type: string;
  price: number;
  wifiSpeed: number;
  images: string; // JSON string
}): Metadata {
  const images: string[] = (() => {
    try { return JSON.parse(listing.images) as string[]; } catch { return []; }
  })();
  const desc = `${listing.city}${listing.district} ${listing.type}，NT$${listing.price.toLocaleString()}/月，Wi-Fi ${listing.wifiSpeed} Mbps。${(listing.description || '').slice(0, 80)}`;
  const url = `${BASE_URL}/listings/${listing.id}`;

  return {
    title: listing.title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'zh_TW',
      url,
      siteName: SITE_NAME,
      title: `${listing.title} | ${SITE_NAME}`,
      description: desc,
      images: images[0]
        ? [{ url: images[0], width: 1200, height: 630, alt: listing.title }]
        : [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: listing.title }],
    },
    twitter: {
      card: 'summary_large_image',
      site: TWITTER_HANDLE,
      title: `${listing.title} | ${SITE_NAME}`,
      description: desc,
      images: images[0] ? [images[0]] : [DEFAULT_OG_IMAGE],
    },
  };
}

// ── 房源詳情頁 Schema.org JSON-LD（RentalProperty）─────────────────────────────
export function buildRentalPropertyJsonLd(listing: {
  id: string;
  title: string;
  description: string | null;
  city: string;
  district: string;
  price: number;
  images: string[];
  amenities: string[];
  reviews: Array<{
    rating: number;
    content: string;
    reviewer: { name: string };
  }>;
}): Record<string, unknown> {
  const avgRating =
    listing.reviews.length > 0
      ? listing.reviews.reduce((s, r) => s + r.rating, 0) / listing.reviews.length
      : null;

  return {
    '@context': 'https://schema.org',
    '@type': 'RentalProperty',
    name: listing.title,
    description: listing.description || '',
    url: `${BASE_URL}/listings/${listing.id}`,
    image: listing.images.length > 0 ? listing.images : undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: listing.district,
      addressRegion: listing.city,
      addressCountry: 'TW',
    },
    offers: {
      '@type': 'Offer',
      price: listing.price,
      priceCurrency: 'TWD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: listing.price,
        priceCurrency: 'TWD',
        unitText: 'MON',
      },
      availability: 'https://schema.org/InStock',
    },
    ...(avgRating && listing.reviews.length > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: avgRating.toFixed(1),
            reviewCount: listing.reviews.length,
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
    ...(listing.reviews.length > 0
      ? {
          review: listing.reviews.slice(0, 3).map(r => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: r.reviewer.name },
            reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
            reviewBody: r.content,
          })),
        }
      : {}),
    amenityFeature: listing.amenities.map(a => ({
      '@type': 'LocationFeatureSpecification',
      name: a,
      value: true,
    })),
  };
}

// ── 麵包屑 Schema.org JSON-LD ─────────────────────────────────────────────────
export function buildBreadcrumbJsonLd(
  items: { name: string; url: string }[]
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}

// ── WebSite + SearchAction Schema.org（首頁用）────────────────────────────────
export function buildWebSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: BASE_URL,
    description: '台灣第一個專為數位游牧工作者設計的中長租媒合平台',
    inLanguage: 'zh-TW',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/listings?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

// ── Organization Schema.org（首頁用）─────────────────────────────────────────
export function buildOrganizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: BASE_URL,
    logo: `${BASE_URL}/icons/icon-192x192.png`,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@nomadnest.tw',
      availableLanguage: ['Chinese', 'English'],
    },
    sameAs: [
      'https://twitter.com/NomadNestTW',
    ],
  };
}

// ── 搜尋頁 metadata 建構器（城市 + 類型動態標題）────────────────────────────
export function buildSearchMetadata(params: {
  city?: string;
  type?: string;
  q?: string;
  foreignOk?: string;
  hasDesk?: string;
  minWifi?: string;
}): Metadata {
  const { city, type, q, foreignOk, hasDesk, minWifi } = params;

  let title = '所有游牧友善房源';
  let description = '台灣各地游牧工作者首選租屋，Wi-Fi 速度保證、外籍友善、有工作桌。';

  if (city && type) {
    title = `${city}${type}出租`;
    description = `${city}${type}租屋，Wi-Fi 速度保證，適合數位游牧工作者長租。`;
  } else if (city) {
    title = `${city}租屋 — 游牧友善房源`;
    description = `${city}游牧工作者租屋精選，Wi-Fi 速度保證、外籍友善，中長租優先。`;
  } else if (type) {
    title = `台灣${type}租屋 — 游牧友善`;
    description = `台灣各地${type}租屋，Wi-Fi 驗證、線上合約，數位游牧工作者首選。`;
  } else if (q) {
    title = `「${q}」搜尋結果`;
    description = `NomadNest Taiwan 搜尋「${q}」的游牧友善租屋結果。`;
  } else if (foreignOk === 'true') {
    title = '外籍友善租屋 — 台灣游牧房源';
    description = '歡迎外籍租客，台灣各地外籍友善游牧租屋，提供英語溝通及合約。';
  } else if (hasDesk === 'true') {
    title = '有工作桌租屋 — 台灣游牧房源';
    description = '配備工作桌的台灣租屋，適合遠端工作者及數位游牧工作者。';
  } else if (minWifi) {
    title = `Wi-Fi ${minWifi}Mbps 以上租屋`;
    description = `台灣高速 Wi-Fi（${minWifi}Mbps+）游牧租屋，速度經第三方驗證，穩定可靠。`;
  }

  const searchParams = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][])
  );
  const url = `${BASE_URL}/listings${searchParams.size ? `?${searchParams}` : ''}`;

  return buildOgMetadata({ title, description, url });
}
