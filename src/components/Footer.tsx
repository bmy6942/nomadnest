'use client';
/**
 * Footer — 全站頁尾（i18n 支援）
 * 使用 useTranslations 自動切換中英文文案
 */
import { useTranslations } from '@/i18n/provider';
import Link from 'next/link';
import LanguageSwitcher from './LanguageSwitcher';

export default function Footer({ locale }: { locale: string }) {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="bg-nomad-navy text-white mt-16 py-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <h3 className="font-bold text-lg mb-3">🏡 NomadNest Taiwan</h3>
            <p className="text-gray-300 text-sm leading-relaxed">{t('tagline')}</p>
            {/* 語系切換 */}
            <div className="mt-4">
              <LanguageSwitcher className="border-gray-600 bg-nomad-navy/50" />
            </div>
          </div>

          {/* For Tenants */}
          <div>
            <h4 className="font-semibold mb-3 text-blue-300">{t('forTenants')}</h4>
            <ul className="space-y-1.5 text-gray-300 text-sm">
              <li>
                <Link href="/listings" className="hover:text-white transition-colors">
                  {t('browsListings')}
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="hover:text-white transition-colors">
                  {t('howItWorks')}
                </Link>
              </li>
            </ul>
          </div>

          {/* For Landlords */}
          <div>
            <h4 className="font-semibold mb-3 text-blue-300">{t('forLandlords')}</h4>
            <ul className="space-y-1.5 text-gray-300 text-sm">
              <li>
                <Link href="/for-landlords" className="hover:text-white transition-colors">
                  {t('landlordInfo')}
                </Link>
              </li>
              <li>
                <Link href="/submit" className="hover:text-white transition-colors">
                  {t('listYourPlace')}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  {t('pricing')}
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  {t('landlordGuide')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-3 text-blue-300">{t('company')}</h4>
            <ul className="space-y-1.5 text-gray-300 text-sm">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  {t('aboutUs')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  {t('terms')}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <a href="mailto:support@nomadnest.tw" className="hover:text-white transition-colors">
                  {t('contact')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-700 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-400 text-xs">
            {t('copyright', { year })}
          </p>
          <p className="text-gray-500 text-xs">{t('madeWith')}</p>
        </div>
      </div>
    </footer>
  );
}
