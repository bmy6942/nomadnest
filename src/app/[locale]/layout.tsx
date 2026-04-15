/**
 * [locale] layout shim — transparent passthrough
 * 實際佈局（Navbar、Footer 等）由根 layout.tsx 處理。
 */
export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
