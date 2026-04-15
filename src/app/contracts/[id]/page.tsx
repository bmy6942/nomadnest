'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

/* ───────────────────────────────── types ── */
type ContractData = {
  id: string;
  status: string;
  rentAmount: number;
  depositAmount: number;
  startDate: string;
  endDate: string;
  paymentDay: number;
  rules: string | null;
  utilities: string | null;
  otherTerms: string | null;
  landlordId: string;
  tenantId: string;
  landlordSignedAt: string | null;
  landlordSignature: string | null;
  tenantSignedAt: string | null;
  tenantSignature: string | null;
  createdAt: string;
  application: {
    listing: {
      id: string; title: string; city: string; district: string;
      address: string; price: number; images: string[];
      owner: { id: string; name: string; email: string; phone: string | null; lineId: string | null };
    };
    tenant: { id: string; name: string; email: string; phone: string | null };
  };
};

type Me = { id: string; name: string; role: string };

/* ────────────────────────────── helpers ── */
const STATUS_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  draft:           { label: '草稿',       color: 'bg-gray-100 text-gray-600',   icon: '📝' },
  pending_tenant:  { label: '等待租客簽名', color: 'bg-amber-100 text-amber-700',  icon: '⏳' },
  pending_landlord:{ label: '等待房東簽名', color: 'bg-blue-100 text-blue-700',    icon: '🖊' },
  completed:       { label: '已完成',      color: 'bg-green-100 text-green-700',  icon: '✅' },
  cancelled:       { label: '已取消',      color: 'bg-red-100 text-red-600',      icon: '❌' },
};
function fmt(d: string) {
  return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ─────────────────────────── SignaturePad ── */
function SignaturePad({ onSave }: { onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const src  = 'touches' in e ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (canvas.width  / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    drawing.current = true;
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setIsEmpty(false);
  }, []);

  const endDraw = useCallback(() => { drawing.current = false; }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.addEventListener('mousedown',  startDraw);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove',  draw,      { passive: false });
    canvas.addEventListener('touchend',   endDraw);
    return () => {
      canvas.removeEventListener('mousedown',  startDraw);
      canvas.removeEventListener('mousemove',  draw);
      canvas.removeEventListener('mouseup',    endDraw);
      canvas.removeEventListener('mouseleave', endDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove',  draw);
      canvas.removeEventListener('touchend',   endDraw);
    };
  }, [startDraw, draw, endDraw]);

  const clear = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const save = () => {
    if (isEmpty) return;
    onSave(canvasRef.current!.toDataURL('image/png'));
  };

  return (
    <div>
      <p className="text-sm text-gray-600 mb-2">請在下方空白處手寫簽名：</p>
      <div className="border-2 border-dashed border-blue-300 rounded-xl bg-blue-50/40 overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          width={480} height={140}
          className="w-full cursor-crosshair"
          style={{ touchAction: 'none' }}
        />
      </div>
      <div className="flex gap-3 mt-3">
        <button onClick={clear} className="btn-secondary text-sm py-1.5 px-4">清除</button>
        <button
          onClick={save}
          disabled={isEmpty}
          className="btn-primary text-sm py-1.5 px-6 disabled:opacity-40">
          ✍️ 確認簽名
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────── main page ── */
export default function ContractPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [me, setMe]             = useState<Me | null>(null);
  const [loading, setLoading]   = useState(true);
  const [signing, setSigning]   = useState(false);
  const [showPad, setShowPad]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/contracts/${params.id}`).then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json()),
    ]).then(([cd, md]) => {
      if (cd.contract) setContract(cd.contract);
      if (md.user)     setMe(md.user);
      setLoading(false);
    });
  }, [params.id]);

  const reload = async () => {
    const r = await fetch(`/api/contracts/${params.id}`);
    const d = await r.json();
    if (d.contract) setContract(d.contract);
  };

  const handleSign = async (signature: string) => {
    setSigning(true); setError('');
    const res = await fetch(`/api/contracts/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sign', signature }),
    });
    const d = await res.json();
    setSigning(false);
    if (!res.ok) { setError(d.error || '簽名失敗'); return; }
    setShowPad(false);
    await reload();
  };

  const handleCancel = async () => {
    if (!confirm('確定要取消此合約？此操作無法復原。')) return;
    const res = await fetch(`/api/contracts/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    if (res.ok) await reload();
  };

  const printPDF = () => window.print();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">載入合約中...</div>;
  }
  if (!contract) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><p className="text-gray-500 mb-4">找不到此合約</p><Link href="/dashboard" className="btn-primary">返回控制台</Link></div></div>;
  }

  const { listing, tenant } = contract.application;
  const landlord = listing.owner;
  const s = STATUS_LABEL[contract.status] ?? STATUS_LABEL.draft;
  const isLandlord   = me?.id === contract.landlordId;
  const isTenant     = me?.id === contract.tenantId;
  const mySignedAt   = isLandlord ? contract.landlordSignedAt : contract.tenantSignedAt;
  const canSign      = !mySignedAt && contract.status !== 'cancelled' && contract.status !== 'completed';
  const canCancel    = (isLandlord || isTenant) && !['completed','cancelled'].includes(contract.status);

  return (
    <>
      {/* ── 列印樣式 ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-area { max-width: 100% !important; padding: 0 !important; }
          .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          .contract-brand-bar { background: #0f2033 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .contract-seal { border: 2px solid #0f2033 !important; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 py-8 print-area">
        {/* 返回按鈕 */}
        <div className="no-print mb-6 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            ← 返回
          </button>
          <div className="flex gap-2">
            {canCancel && (
              <button onClick={handleCancel} className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50">
                取消合約
              </button>
            )}
            <button onClick={printPDF} className="btn-secondary text-sm py-1.5 px-4">
              🖨️ 列印 / 儲存 PDF
            </button>
          </div>
        </div>

        {/* ── 合約主體 ── */}
        <div className="card p-8">
          {/* ── 品牌標頭 ── */}
          <div className="contract-brand-bar -mx-8 -mt-8 mb-8 px-8 py-5 bg-[#0f2033] rounded-t-xl flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-xs font-medium tracking-widest uppercase mb-0.5">NomadNest Taiwan</p>
              <p className="text-white text-[10px] opacity-60">數位游牧租屋媒合平台・nomadnest.tw</p>
            </div>
            {/* 平台印章樣式徽章 */}
            <div className="contract-seal border-2 border-blue-400/60 rounded-full px-4 py-1.5 text-center opacity-90">
              <p className="text-blue-300 text-[9px] font-bold tracking-widest">OFFICIAL</p>
              <p className="text-white text-[9px] tracking-wider">CONTRACT</p>
            </div>
          </div>

          {/* 標題 */}
          <div className="text-center mb-8 border-b border-gray-200 pb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 mb-3 text-2xl">📋</div>
            <h1 className="text-2xl font-bold text-gray-900">房屋租賃合約書</h1>
            <p className="text-gray-400 text-xs mt-1.5 font-mono tracking-widest">
              合約編號 #{contract.id.slice(-10).toUpperCase()}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">
              建立日期：{fmt(contract.createdAt)}
            </p>
            <div className="mt-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${s.color}`}>
                {s.icon} {s.label}
              </span>
            </div>
          </div>

          {/* 甲乙方 */}
          <section className="mb-6">
            <h2 className="font-bold text-gray-800 mb-3 text-base border-l-4 border-blue-500 pl-3">一、當事人資訊</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs text-blue-500 font-semibold mb-2">甲方（出租人 / 房東）</p>
                <p className="font-semibold text-gray-800">{landlord.name}</p>
                <p className="text-sm text-gray-500">{landlord.email}</p>
                {landlord.phone && <p className="text-sm text-gray-500">{landlord.phone}</p>}
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-xs text-green-600 font-semibold mb-2">乙方（承租人 / 租客）</p>
                <p className="font-semibold text-gray-800">{tenant.name}</p>
                <p className="text-sm text-gray-500">{tenant.email}</p>
                {tenant.phone && <p className="text-sm text-gray-500">{tenant.phone}</p>}
              </div>
            </div>
          </section>

          {/* 房源 */}
          <section className="mb-6">
            <h2 className="font-bold text-gray-800 mb-3 text-base border-l-4 border-blue-500 pl-3">二、租賃標的</h2>
            <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
              <p><span className="text-gray-500 w-24 inline-block">房源名稱</span><span className="font-medium">{listing.title}</span></p>
              <p><span className="text-gray-500 w-24 inline-block">地址</span><span className="font-medium">{listing.city} {listing.district} {listing.address}</span></p>
            </div>
          </section>

          {/* 租賃條件 */}
          <section className="mb-6">
            <h2 className="font-bold text-gray-800 mb-3 text-base border-l-4 border-blue-500 pl-3">三、租賃條件</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '月租金', value: `NT$${contract.rentAmount.toLocaleString()}` },
                { label: '押金',   value: `NT$${contract.depositAmount.toLocaleString()}` },
                { label: '繳租日', value: `每月 ${contract.paymentDay} 日` },
                { label: '租期',   value: `${fmt(contract.startDate)} ～ ${fmt(contract.endDate)}` },
              ].map(r => (
                <div key={r.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">{r.label}</p>
                  <p className="font-bold text-gray-800 text-sm">{r.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 規則與條款 */}
          {(contract.rules || contract.utilities || contract.otherTerms) && (
            <section className="mb-6 space-y-4">
              <h2 className="font-bold text-gray-800 mb-3 text-base border-l-4 border-blue-500 pl-3">四、特別約定</h2>
              {contract.rules && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">居住規則</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">{contract.rules}</p>
                </div>
              )}
              {contract.utilities && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">水電費說明</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">{contract.utilities}</p>
                </div>
              )}
              {contract.otherTerms && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">其他條款</p>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3 whitespace-pre-wrap">{contract.otherTerms}</p>
                </div>
              )}
            </section>
          )}

          {/* 簽名區 */}
          <section className="mb-4">
            <h2 className="font-bold text-gray-800 mb-4 text-base border-l-4 border-blue-500 pl-3">五、簽名確認</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* 房東簽名 */}
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-600 mb-3">甲方（房東）簽名</p>
                {contract.landlordSignature ? (
                  <div>
                    <img src={contract.landlordSignature} alt="房東簽名" className="max-h-20 border border-gray-100 rounded-lg bg-white" />
                    <p className="text-xs text-gray-400 mt-2">
                      簽署時間：{contract.landlordSignedAt ? fmt(contract.landlordSignedAt) : '—'}
                    </p>
                  </div>
                ) : (
                  <div className="h-20 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-xs text-gray-400">尚未簽名</p>
                  </div>
                )}
              </div>
              {/* 租客簽名 */}
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-green-600 mb-3">乙方（租客）簽名</p>
                {contract.tenantSignature ? (
                  <div>
                    <img src={contract.tenantSignature} alt="租客簽名" className="max-h-20 border border-gray-100 rounded-lg bg-white" />
                    <p className="text-xs text-gray-400 mt-2">
                      簽署時間：{contract.tenantSignedAt ? fmt(contract.tenantSignedAt) : '—'}
                    </p>
                  </div>
                ) : (
                  <div className="h-20 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-xs text-gray-400">尚未簽名</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── 平台見證條款 ── */}
          <div className="mt-6 pt-5 border-t border-dashed border-gray-200 text-center space-y-1">
            <p className="text-xs text-gray-500 font-medium">
              本合約由 <span className="text-blue-600 font-semibold">NomadNest Taiwan</span> 平台電子見證
            </p>
            <p className="text-[11px] text-gray-400">
              雙方於平台完成電子簽名後，本合約即具備法律效力。如有爭議，以本平台存檔記錄為準。
            </p>
            <p className="text-[10px] text-gray-300 font-mono pt-1 tracking-widest">
              nomadnest.tw · {new Date().getFullYear()} · All Rights Reserved
            </p>
          </div>
        </div>

        {/* ── 簽名操作區（非列印）── */}
        {canSign && (isLandlord || isTenant) && (
          <div className="no-print mt-6 card p-6">
            <h3 className="font-bold text-gray-800 mb-1">
              {isLandlord ? '🖊 房東簽名' : '✍️ 租客簽名'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              請仔細閱讀上方合約內容，確認無誤後於下方簽名。
            </p>
            {error && <p className="text-red-600 text-sm mb-3 bg-red-50 p-2 rounded-lg">{error}</p>}
            {!showPad ? (
              <button onClick={() => setShowPad(true)} className="btn-primary">
                ✍️ 開始簽名
              </button>
            ) : (
              <SignaturePad onSave={handleSign} />
            )}
            {signing && <p className="text-sm text-blue-600 mt-2">送出簽名中...</p>}
          </div>
        )}

        {/* ── 完成提示 ── */}
        {contract.status === 'completed' && (
          <div className="no-print mt-6 bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <p className="font-bold text-green-800">合約已完成！雙方均已簽署。</p>
            <p className="text-sm text-green-600 mt-1">你可以點擊「列印 / 儲存 PDF」留存合約副本。</p>
          </div>
        )}

        {/* ── 等待對方 ── */}
        {mySignedAt && contract.status !== 'completed' && contract.status !== 'cancelled' && (
          <div className="no-print mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
            <div className="text-2xl mb-2">⏳</div>
            <p className="font-medium text-blue-800">你已完成簽名，等待對方簽署中…</p>
          </div>
        )}
      </div>
    </>
  );
}
