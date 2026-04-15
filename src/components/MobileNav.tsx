'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useTranslations } from '@/i18n/provider';
import LanguageSwitcher from './LanguageSwitcher';

export default function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [unreadMessages, setUnreadMessages]         = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loggedIn, setLoggedIn]                     = useState(false);
  const [langOpen, setLangOpen]                     = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = () => {
    fetch('/api/status').then(r => r.ok ? r.json() : null).then(d => {
      if (d) {
        setLoggedIn(true);
        setUnreadMessages(d.unreadMessages ?? 0);
        setUnreadNotifications(d.unreadNotifications ?? 0);
      } else {
        setLoggedIn(false);
        setUnreadMessages(0);
        setUnreadNotifications(0);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // 未登入時：以「房東出租」取代對訪客無意義的通知頁，提升轉化機會
  const navItems = loggedIn
    ? [
        { href: '/',              icon: '🏠', labelKey: 'home',          badge: 0 },
        { href: '/listings',      icon: '🔍', labelKey: 'mobileSearch',  badge: 0 },
        { href: '/messages',      icon: '💬', labelKey: 'messages',      badge: unreadMessages },
        { href: '/notifications', icon: '🔔', labelKey: 'notifications', badge: unreadNotifications },
        { href: '/dashboard',     icon: '👤', labelKey: 'mobileDashboard', badge: 0 },
      ]
    : [
        { href: '/',              icon: '🏠', labelKey: 'home',          badge: 0 },
        { href: '/listings',      icon: '🔍', labelKey: 'mobileSearch',  badge: 0 },
        { href: '/for-landlords', icon: '🏡', labelKey: 'forLandlords',  badge: 0 },
        { href: '/auth/register', icon: '✍️', labelKey: 'register',      badge: 0 },
        { href: '/auth/login',    icon: '👤', labelKey: 'login',         badge: 0 },
      ];

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* 語言切換浮層（點擊遮罩關閉）*/}
      {langOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setLangOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 語言切換面板 */}
      {langOpen && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-xl border border-gray-200 px-6 py-4 flex flex-col items-center gap-3">
          <p className="text-xs text-gray-400 font-medium">Language / 語言</p>
          <LanguageSwitcher className="flex" />
        </div>
      )}

      {/* 底部導航列 */}
      <nav
        suppressHydrationWarning
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-gray-200 safe-area-pb"
      >
        <div className="flex">
          {navItems.map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative transition-colors ${
                  active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="text-xl leading-none relative">
                  {item.icon}
                  {item.badge > 0 && (
                    <span
                      suppressHydrationWarning
                      className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center leading-none"
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </span>
                <span
                  suppressHydrationWarning
                  className={`text-[10px] font-medium leading-tight ${active ? 'text-blue-600' : 'text-gray-500'}`}
                >
                  {t(item.labelKey)}
                </span>
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
                )}
              </Link>
            );
          })}

          {/* 語言切換按鈕（行動版專用）*/}
          <button
            onClick={() => setLangOpen(v => !v)}
            aria-label="Language / 語言"
            className="flex-none w-10 flex flex-col items-center justify-center py-2 gap-0.5 text-gray-400 hover:text-blue-600 transition-colors"
          >
            <span className="text-xl leading-none">🌐</span>
            <span className="text-[10px] font-medium leading-tight">Lang</span>
          </button>
        </div>
      </nav>
    </>
  );
}
