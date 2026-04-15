'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';

// ✅ 驗證成功後：檢查 onboardingCompleted → 導向 /onboarding 或 /dashboard
function VerifySuccessRedirect({ alreadyDone }: { alreadyDone: boolean }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.user?.onboardingCompleted === false) {
          router.replace('/onboarding');
        } else {
          router.replace('/dashboard');
        }
      })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setChecking(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="text-6xl mb-4">{alreadyDone ? '✅' : '🎉'}</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {alreadyDone ? 'Email 已驗證' : 'Email 驗證成功！'}
        </h1>
        <p className="text-gray-500 text-sm mb-4">
          {alreadyDone ? '您的 Email 已經通過驗證。' : '帳號驗證完成，正在為您導向…'}
        </p>
        {checking && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin" />
            正在載入…
          </div>
        )}
      </div>
    </div>
  );
}

function VerifyEmailContent() {
  const params  = useSearchParams();
  const success = params.get('success');
  const error   = params.get('error');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [email, setEmail] = useState('');

  // 若已登入且 emailPending，自動填入 Email
  useEffect(() => {
    if (success) return; // 驗證成功頁面不需要
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(me => {
      if (me?.user?.email && me.user.verificationStatus === 'emailPending') {
        setEmail(me.user.email);
      }
    }).catch(() => {});
  }, [success]);

  const resend = async () => {
    if (!email) return;
    setResending(true);
    await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setResending(false);
    setResent(true);
  };

  // ✅ Email 驗證成功 → 檢查是否完成 Onboarding，導向對應頁面
  if (success) {
    const alreadyDone = success === 'already';
    return (
      <VerifySuccessRedirect alreadyDone={alreadyDone} />
    );
  }

  const errorMessages: Record<string, string> = {
    expired: '驗證連結已過期（有效期 7 天），請重新發送驗證信。',
    invalid:  '無效的驗證連結，請確認連結是否完整，或重新發送。',
    missing:  '缺少驗證 token，請點擊信件中的按鈕。',
    notfound: '找不到對應帳號，請確認信件中的連結。',
    mismatch: 'Email 不符，請使用最新一封驗證信中的連結。',
  };

  const isError = !!error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{isError ? '❌' : '📬'}</div>
          <h1 className="text-xl font-bold text-gray-800">
            {isError ? '驗證失敗' : '驗證你的 Email'}
          </h1>
          {isError && (
            <p className="text-sm text-red-600 mt-2 bg-red-50 border border-red-200 rounded-xl p-3">
              {errorMessages[error || ''] || '發生未知錯誤，請重試。'}
            </p>
          )}
          {!isError && (
            <p className="text-gray-500 text-sm mt-2">
              我們已向您的信箱寄出驗證連結，請查看並點擊按鈕完成驗證。
            </p>
          )}
        </div>

        <div className="card p-6">
          {resent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✉️</div>
              <p className="text-green-700 font-medium">驗證信已重新寄出！</p>
              <p className="text-gray-500 text-sm mt-1">請查看您的信箱（包含垃圾郵件）</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                {isError ? '輸入您的 Email 重新發送驗證連結：' : '沒有收到信？輸入 Email 重新發送：'}
              </p>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="input mb-3"
              />
              <button
                onClick={resend}
                disabled={!email || resending}
                className="btn-primary w-full disabled:opacity-50">
                {resending ? '發送中...' : '📧 重新發送驗證信'}
              </button>
            </>
          )}
          <p className="text-center text-sm text-gray-500 mt-4">
            <Link href="/dashboard" className="text-blue-600 hover:underline">← 先跳過，前往控制台</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">載入中...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
