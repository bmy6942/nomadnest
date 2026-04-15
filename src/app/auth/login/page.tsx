'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginContent() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

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
        // 登入成功但 Email 尚未驗證 → 先跳驗證提示頁（已登入，頁面可自動填入 email）
        router.push('/auth/verify-email');
        router.refresh();
      } else {
        const redirect = searchParams.get('redirect') || '/dashboard';
        router.push(redirect);
        router.refresh();
      }
    } else {
      setError(data.error || '登入失敗');
    }
  };

  const quickLogin = (email: string, password: string) => {
    setForm({ email, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" aria-label="NomadNest Taiwan — 回首頁" className="text-4xl focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:rounded-md focus-visible:outline-none">🏡</Link>
          <h1 className="text-2xl font-bold text-nomad-navy mt-3">歡迎回來</h1>
          <p className="text-gray-500 text-sm mt-1">登入你的 NomadNest 帳號</p>
        </div>

        <div className="card p-8">
          {/* Quick Login (for testing) */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-xs font-bold text-amber-700 mb-2">🧪 測試帳號快速登入</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '管理員', email: 'admin@nomadnest.tw', pass: 'admin123' },
                { label: '房東（陳大明）', email: 'landlord1@test.com', pass: 'test123' },
                { label: '租客（Sarah）', email: 'sarah@test.com', pass: 'test123' },
                { label: '租客（Thomas）', email: 'thomas@test.com', pass: 'test123' },
              ].map(a => (
                <button key={a.email} onClick={() => quickLogin(a.email, a.pass)}
                  className="text-xs bg-white border border-amber-200 hover:bg-amber-50 text-amber-800 px-2 py-1.5 rounded-lg transition-colors text-left">
                  {a.label}
                </button>
              ))}
            </div>
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
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">密碼</label>
                <Link href="/auth/forgot-password" className="text-xs text-blue-600 hover:underline">忘記密碼？</Link>
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
              {loading ? '登入中...' : '登入'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            還沒有帳號？<Link href="/auth/register" className="text-blue-600 hover:underline font-medium">立即註冊</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">載入中...</div>}>
      <LoginContent />
    </Suspense>
  );
}
