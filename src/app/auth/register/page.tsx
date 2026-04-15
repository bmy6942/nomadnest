'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/i18n/provider';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'tenant' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations('auth');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { setError(t('passwordMinError')); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      router.push('/onboarding');
    } else {
      setError(data.error || t('registerFailed'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-4xl">🏡</Link>
          <h1 className="text-2xl font-bold text-nomad-navy mt-3">{t('joinTitle')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('joinSubtitle')}</p>
        </div>

        <div className="card p-8">
          {/* Google 登入 */}
          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-3 w-full border border-gray-300 rounded-xl py-3 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-5"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('joinWithGoogle')}
          </a>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs text-gray-400 bg-white px-3">{t('orWithEmailReg')}</div>
          </div>

          <form onSubmit={submit} className="space-y-5" noValidate>
            {error && (
              <div role="alert" aria-live="assertive" className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">{t('yourIdentity')}</legend>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'tenant',   label: t('roleTenant') },
                  { value: 'landlord', label: t('roleLandlord') },
                ].map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, role: r.value }))}
                    aria-pressed={form.role === r.value}
                    className={`py-3 rounded-xl border-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                      form.role === r.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">
                {t('nameLabel')}
                <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                id="reg-name"
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('namePlaceholder')}
                required
                aria-required="true"
                autoComplete="name"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
                <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="your@email.com"
                required
                aria-required="true"
                autoComplete="email"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">
                {t('password')}
                <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                id="reg-password"
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={t('passwordPlaceholder')}
                required
                aria-required="true"
                aria-describedby="reg-password-hint"
                autoComplete="new-password"
                minLength={8}
                className="input"
              />
              <p id="reg-password-hint" className="text-xs text-gray-500 mt-1">
                {t('passwordHint')}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-disabled={loading}
              className="btn-primary w-full py-3 text-base"
            >
              {loading ? t('registering') : t('joinNow')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            {t('alreadyHaveAccount')}<Link href="/auth/login" className="text-blue-600 hover:underline font-medium ml-1">{t('login')}</Link>
          </p>
          <p className="text-center text-xs text-gray-400 mt-3">
            {t('byRegistering')}
            <Link href="/terms" className="text-blue-500 hover:underline mx-0.5">{t('termsOfService')}</Link>
            {t('andConjunction')}
            <Link href="/privacy" className="text-blue-500 hover:underline mx-0.5">{t('privacyPolicy')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
