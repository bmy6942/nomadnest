import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nomadnest.tw';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/listings', '/listings/', '/landlords/', '/privacy', '/terms', '/for-landlords', '/about', '/pricing'],
        disallow: [
          '/admin', '/dashboard', '/profile', '/messages',
          '/notifications', '/analytics', '/applications',
          '/api/', '/submit', '/auth/',
          '/contracts/', '/viewings/', '/tenants/', '/users/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
