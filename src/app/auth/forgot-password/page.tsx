'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || '發送失敗，請稍後再試');
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
          <h1 className="text-2xl font-bold text-nomad-navy mt-3">忘記密碼</h1>
          <p className="text-gray-500 text-sm mt-1">輸入您的電子郵件，我們將寄送重設連結</p>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">📬</div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">確認您的信箱</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                若 <span className="font-medium text-gray-700">{email}</span> 已在 NomadNest 註冊，
                您將會收到一封含有重設密碼連結的電子郵件。<br />
                連結有效期為 <strong>1 小時</strong>。
              </p>
              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                💡 若沒有收到信件，請檢查垃圾郵件資料夾，或確認輸入的電子郵件是否正確。
              </div>
              <Link href="/auth/login"
                className="mt-6 inline-block text-blue-600 hover:underline text-sm font-medium">
                ← 返回登入頁面
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">電子郵件</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="input"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? '寄送中...' : '寄送重設連結'}
              </button>

              <p className="text-center text-sm text-gray-500 mt-2">
                想起密碼了？
                <Link href="/auth/login" className="text-blue-600 hover:underline font-medium ml-1">返回登入</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
