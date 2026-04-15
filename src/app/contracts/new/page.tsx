'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

type Application = {
  id: string; status: string; moveInDate: string; duration: number;
  listing: { id: string; title: string; city: string; district: string; price: number; deposit: number };
  tenant:  { id: string; name: string; email: string };
};

function NewContractForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const appId        = searchParams.get('applicationId') || '';

  const [application, setApplication] = useState<Application | null>(null);
  const [loadingApp, setLoadingApp]    = useState(!!appId);

  const [form, setForm] = useState({
    rentAmount:    '',
    depositAmount: '',
    startDate:     '',
    endDate:       '',
    paymentDay:    '5',
    rules:         '',
    utilities:     '',
    otherTerms:    '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  /* 預填申請資料 */
  useEffect(() => {
    if (!appId) return;
    fetch('/api/dashboard').then(r => r.json()).then(d => {
      const apps: Application[] = d.incomingApplications ?? [];
      const app = apps.find((a: Application) => a.id === appId);
      if (app) {
        setApplication(app);
        // 計算結束日期
        const start = app.moveInDate;
        const endMs = start
          ? new Date(start).setMonth(new Date(start).getMonth() + app.duration)
          : null;
        setForm(f => ({
          ...f,
          rentAmount:    String(app.listing.price),
          depositAmount: String(app.listing.deposit),
          startDate:     start || '',
          endDate:       endMs ? new Date(endMs).toISOString().slice(0, 10) : '',
        }));
      }
      setLoadingApp(false);
    });
  }, [appId]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!appId) { setError('缺少申請 ID'); return; }

    // ── 客戶端快速驗證 ────────────────────────────────────────────────────────
    const rent    = Number(form.rentAmount);
    const deposit = Number(form.depositAmount);
    const payDay  = Number(form.paymentDay);
    if (!Number.isFinite(rent) || rent <= 0) { setError('請輸入有效的月租金'); return; }
    if (!Number.isFinite(deposit) || deposit < 0 || !Number.isInteger(deposit)) { setError('請輸入有效的押金金額（0 以上整數）'); return; }
    if (!Number.isInteger(payDay) || payDay < 1 || payDay > 28) { setError('繳租日需為 1~28 的整數'); return; }
    if (form.startDate && form.endDate && form.endDate <= form.startDate) {
      setError('結束日期必須晚於開始日期'); return;
    }
    if (form.rules.length > 2000)      { setError('居住規則不可超過 2000 字元'); return; }
    if (form.utilities.length > 2000)  { setError('水電費說明不可超過 2000 字元'); return; }
    if (form.otherTerms.length > 2000) { setError('其他條款不可超過 2000 字元'); return; }

    setSubmitting(true);
    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: appId, ...form }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      if (res.status === 409 && data.contractId) {
        // 合約已存在 → 直接跳轉
        router.push(`/contracts/${data.contractId}`);
      } else {
        setError(data.error || '建立失敗');
      }
      return;
    }
    router.push(`/contracts/${data.contract.id}`);
  };

  if (loadingApp) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">載入中...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← 返回</button>
        <h1 className="text-xl font-bold text-nomad-navy">建立租賃合約</h1>
      </div>

      {application && (
        <div className="card p-4 mb-6 bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-500 font-semibold mb-1">對應申請</p>
          <p className="font-semibold text-gray-800">{application.listing.title}</p>
          <p className="text-sm text-gray-600">{application.listing.city} {application.listing.district} ·
            租客：{application.tenant.name}</p>
        </div>
      )}

      <form onSubmit={submit} className="card p-6 space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">月租金（NT$）</label>
            <input type="number" value={form.rentAmount} onChange={set('rentAmount')} required min={1} className="input" placeholder="例：18000" />
          </div>
          <div>
            <label className="label">押金（NT$）</label>
            <input type="number" value={form.depositAmount} onChange={set('depositAmount')} required min={0} className="input" placeholder="例：36000" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">租期開始</label>
            <input type="date" value={form.startDate} onChange={set('startDate')} required className="input" />
          </div>
          <div>
            <label className="label">租期結束</label>
            <input type="date" value={form.endDate} onChange={set('endDate')} required className="input" />
          </div>
        </div>

        <div>
          <label className="label">每月繳租日（幾號）</label>
          <input type="number" value={form.paymentDay} onChange={set('paymentDay')} min={1} max={28} required className="input w-32" />
        </div>

        <div>
          <label className="label">居住規則 <span className="text-gray-400 font-normal">（可留空）</span></label>
          <textarea value={form.rules} onChange={set('rules')} rows={3} maxLength={2000} className="input resize-none"
            placeholder="例：禁止養寵物、禁止開伙、晚上11點後請保持安靜…" />
          {form.rules.length > 1800 && (
            <p className={`text-xs mt-1 text-right ${form.rules.length >= 2000 ? 'text-red-500 font-medium' : 'text-amber-500'}`}>
              {form.rules.length}/2000
            </p>
          )}
        </div>

        <div>
          <label className="label">水電費說明 <span className="text-gray-400 font-normal">（可留空）</span></label>
          <textarea value={form.utilities} onChange={set('utilities')} rows={2} maxLength={2000} className="input resize-none"
            placeholder="例：水費每度XX元，電費依台電計算，每月另收…" />
          {form.utilities.length > 1800 && (
            <p className={`text-xs mt-1 text-right ${form.utilities.length >= 2000 ? 'text-red-500 font-medium' : 'text-amber-500'}`}>
              {form.utilities.length}/2000
            </p>
          )}
        </div>

        <div>
          <label className="label">其他條款 <span className="text-gray-400 font-normal">（可留空）</span></label>
          <textarea value={form.otherTerms} onChange={set('otherTerms')} rows={3} maxLength={2000} className="input resize-none"
            placeholder="例：租客離開前需自行清潔，修繕費用超過XX元由租客負擔…" />
          {form.otherTerms.length > 1800 && (
            <p className={`text-xs mt-1 text-right ${form.otherTerms.length >= 2000 ? 'text-red-500 font-medium' : 'text-amber-500'}`}>
              {form.otherTerms.length}/2000
            </p>
          )}
        </div>

        <div className="pt-2 flex gap-3">
          <button type="submit" disabled={submitting} className="btn-primary flex-1 py-3 disabled:opacity-50">
            {submitting ? '建立中...' : '📋 建立合約並通知租客'}
          </button>
          <Link href="/dashboard" className="btn-secondary py-3 px-6">取消</Link>
        </div>
      </form>
    </div>
  );
}

export default function NewContractPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">載入中...</div>}>
      <NewContractForm />
    </Suspense>
  );
}
