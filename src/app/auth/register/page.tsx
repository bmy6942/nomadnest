'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'tenant' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // 註冊成功後等待驗證信
  const [pendingVerify, setPendingVerify] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { setError('密碼至少需要 8 個字元'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      // ✅ 無論是否 emailPending，一律導向 Onboarding 引導流程
      // Onboarding 頁面內部會顯示 Email 驗證提醒橫幅
      router.push('/onboarding');
    } else {
      setError(data.error || '註冊失敗');
    }
  };

  const resendVerification = async () => {
    setResending(true);
    await fetch('/api/auth/verify-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registeredEmail }),
    });
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  };

  // ── 註冊成功等待驗證畫面 ──
  if (pendingVerify) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="text-6xl mb-4">📬</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">歡迎加入！請驗證你的 Email</h1>
          <p className="text-gray-500 text-sm mb-1">
            我們已將驗證連結寄送至：
          </p>
          <p className="text-blue-600 font-semibold mb-6">{registeredEmail}</p>

          <div className="card p-6 text-left mb-4">
            <ol className="space-y-3 text-sm text-gray-600">
              <li className="flex gap-2"><span className="font-bold text-blue-600 shrink-0">1.</span>前往你的信箱（包含垃圾郵件匣）</li>
              <li className="flex gap-2"><span className="font-bold text-blue-600 shrink-0">2.</span>找到「NomadNest — 請驗證你的 Email 地址」</li>
              <li className="flex gap-2"><span className="font-bold text-blue-600 shrink-0">3.</span>點擊信中的「立即驗證 Email」按鈕</li>
              <li className="flex gap-2"><span className="font-bold text-blue-600 shrink-0">4.</span>驗證後即可使用所有功能 🎉</li>
            </ol>
          </div>

          <div className="space-y-3">
            {resent ? (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-xl">
                ✅ 驗證信已重新寄出！請查看信箱。
              </div>
            ) : (
              <button
                onClick={resendVerification}
                disabled={resending}
                className="btn-secondary w-full disabled:opacity-50">
                {resending ? '寄送中...' : '📧 重新寄送驗證信'}
              </button>
            )}
            <button
              onClick={() => { router.push('/dashboard'); router.refresh(); }}
              className="text-sm text-gray-400 hover:text-gray-600 w-full text-center py-2">
              先跳過，前往控制台 →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-4xl">🏡</Link>
          <h1 className="text-2xl font-bold text-nomad-navy mt-3">加入 NomadNest</h1>
          <p className="text-gray-500 text-sm mt-1">開始你的游牧旅程</p>
        </div>

        <div className="card p-8">
          {/* noValidate：停用瀏覽器原生驗證泡泡，改用 role="alert" 集中顯示 */}
          <form onSubmit={submit} className="space-y-5" noValidate>
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg"
              >
                {error}
              </div>
            )}

            {/* 身份選擇 — fieldset/legend 賦予語意 */}
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">你的身份</legend>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'tenant',   label: '🧳 我是租客（游牧者）' },
                  { value: 'landlord', label: '🏠 我是房東' },
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
                姓名 / 暱稱
                <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                id="reg-name"
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="你的名字"
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
                密碼
                <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                id="reg-password"
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="至少 8 個字元"
                required
                aria-required="true"
                aria-describedby="reg-password-hint"
                autoComplete="new-password"
                minLength={8}
                className="input"
              />
              <p id="reg-password-hint" className="text-xs text-gray-500 mt-1">
                密碼長度至少需要 8 個字元
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-disabled={loading}
              aria-label={loading ? '正在處理註冊，請稍候' : '立即加入 NomadNest'}
              className="btn-primary w-full py-3 text-base"
            >
              {loading ? '註冊中…' : '🚀 立即加入'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            已有帳號？<Link href="/auth/login" className="text-blue-600 hover:underline font-medium">登入</Link>
          </p>
          <p className="text-center text-xs text-gray-400 mt-3">
            註冊即表示您同意我們的
            <Link href="/terms" className="text-blue-500 hover:underline mx-0.5">服務條款</Link>
            與
            <Link href="/privacy" className="text-blue-500 hover:underline mx-0.5">隱私政策</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
