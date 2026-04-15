'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/i18n/provider';

function LoginContent() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      if (data.emailPending) {
        router.push('/auth/verify-email');
        router.refresh();
      } else {
        const redirect = searchParams.get('redirect') || '/dashboard';
        router.push(redirect);
        router.refresh();
      }
    } else {
      setError(data.error || t('loginFailed'));
    }
  };

  const quickLogin = (email: string, password: string) => {
    setForm({ email, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" aria-label="NomadNest Taiwan" className="text-4xl focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:rounded-md focus-visible:outline-none">🏡</Link>
          <h1 className="text-2xl font-bold text-nomad-navy mt-3">{t('welcomeBack')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('loginSubtitle')}</p>
        </div>

        <div className="card p-8">
          {/* Quick Login (for testing) */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-xs font-bold text-amber-700 mb-2">🧪 {t('testAccounts')}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: t('adminAccount'), email: 'admin@nomadnest.tw', pass: 'admin123' },
                { label: t('landlordAccount'), email: 'landlord1@test.com', pass: 'test123' },
                { label: t('tenantSarah'), email: 'sarah@test.com', pass: 'test123' },
                { label: t('tenantThomas'), email: 'thomas@test.com', pass: 'test123' },
              ].map(a => (
                <button key={a.email} onClick={() => quickLogin(a.email, a.pass)}
                  className="text-xs bg-white border border-amber-200 hover:bg-amber-50 text-amber-800 px-2 py-1.5 rounded-lg transition-colors text-left">
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Google 登入 */}
          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-3 w-full border border-gray-300 rounded-xl py-3 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('loginWithGoogle')}
          </a>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs text-gray-400 bg-white px-3">{t('orWithEmail')}</div>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {error && (
              <div role="alert" aria-live="assertive" className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="login-email"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="your@email.com"
                required
                autoComplete="email"
                aria-required="true"
                className="input" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">{t('password')}</label>
                <Link href="/auth/forgot-password" className="text-xs text-blue-600 hover:underline">{t('forgotPassword')}</Link>
              </div>
              <input
                id="login-password"
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                aria-required="true"
                className="input" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? t('loggingIn') : t('loginButton')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            {t('noAccount')}<Link href="/auth/register" className="text-blue-600 hover:underline font-medium ml-1">{t('registerNow')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <LoginContent />
    </Suspense>
  );
}
