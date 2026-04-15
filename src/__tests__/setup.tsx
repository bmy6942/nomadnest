import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';

// ── Mock Next.js modules ──────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img src={src} alt={alt} {...props} />;
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ── Mock i18n provider ────────────────────────────────────────────────────────
// Uses importOriginal so that I18nProvider (and other exports) remain available.
// Only useTranslations and useLocale are replaced with lightweight stubs so that
// component tests don't need to mount a full I18nProvider wrapper.
vi.mock('@/i18n/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n/provider')>();
  return {
    ...actual,
    useTranslations: (namespace?: string) => (key: string, params?: Record<string, string | number>) => {
      // Return a readable string: "namespace.key(param=value)"
      const base = namespace ? `${namespace}.${key}` : key;
      if (params) {
        const paramStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(', ');
        return `${base}(${paramStr})`;
      }
      return base;
    },
    useLocale: () => 'zh-TW',
  };
});

// ── Suppress console noise in tests ──────────────────────────────────────────
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
