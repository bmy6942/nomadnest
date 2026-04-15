'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const uid = params.get('uid') || '';

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [strength, setStrength] = useState(0); // 0-4

  useEffect(() => {
    if (!token || !uid) setError('重設連結無效，請重新申請。');
  }, [token, uid]);

  // 密碼強度檢查
  useEffect(() => {
    const p = form.password;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    setStrength(p.length === 0 ? 0 : score);
  }, [form.password]);

  const strengthLabel = ['', '弱', '普通', '良好', '強'][strength];
  const strengthColor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'][strength];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('兩次輸入的密碼不一致');
      return;
    }
    if (form.password.length < 8) {
      setError('密碼至少需要 8 個字元');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, uid, password: form.password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/auth/login'), 3000);
      } else {
        setError(data.error || '重設失敗，請重新申請');
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-4xl">🏡</Link>
          <h1 className="text-2xl font-bold text-nomad-navy mt-3">重設密碼</h1>
          <p className="text-gray-500 text-sm mt-1">請輸入您的新密碼</p>
        </div>

        <div className="card p-8">
          {success ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">密碼已重設成功！</h2>
              <p className="text-gray-500 text-sm">即將自動跳轉到登入頁面...</p>
              <Link href="/auth/login"
                className="mt-4 inline-block text-blue-600 hover:underline text-sm font-medium">
                立即前往登入 →
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
                  {error}
                  {(error.includes('無效') || error.includes('過期')) && (
                    <div className="mt-2">
                      <Link href="/auth/forgot-password" className="text-blue-600 hover:underline font-medium">
                        重新申請重設連結 →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {(!error || !error.includes('無效')) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="至少 8 個字元"
                      required
                      minLength={8}
                      className="input"
                    />
                    {form.password.length > 0 && (
                      <div className="mt-2">
                        <div className="flex gap-1 h-1.5">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i}
                              className={`flex-1 rounded-full transition-colors ${
                                i <= strength ? strengthColor : 'bg-gray-200'
                              }`} />
                          ))}
                        </div>
                        <p className={`text-xs mt-1 ${
                          strength <= 1 ? 'text-red-500' : strength === 2 ? 'text-yellow-600' :
                          strength === 3 ? 'text-blue-500' : 'text-green-600'
                        }`}>
                          密碼強度：{strengthLabel}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">確認新密碼</label>
                    <input
                      type="password"
                      value={form.confirm}
                      onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                      placeholder="再次輸入密碼"
                      required
                      className={`input ${
                        form.confirm && form.password !== form.confirm
                          ? 'border-red-300 focus:ring-red-200'
                          : ''
                      }`}
                    />
                    {form.confirm && form.password !== form.confirm && (
                      <p className="text-xs text-red-500 mt-1">密碼不一致</p>
                    )}
                  </div>

                  <button type="submit" disabled={loading || !token || !uid}
                    className="btn-primary w-full py-3 disabled:opacity-50">
                    {loading ? '重設中...' : '確認重設密碼'}
                  </button>
                </>
              )}

              <p className="text-center text-sm text-gray-500">
                <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">← 返回登入</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <p className="text-gray-500">載入中...</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
