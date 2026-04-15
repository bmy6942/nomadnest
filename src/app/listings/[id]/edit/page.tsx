'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import ImageUploader from '@/components/ImageUploader';
import { geocodeAddress } from '@/lib/geocode';

// ✅ 與 submit/page.tsx 保持完全一致，避免 label 不同導致已存資料無法對應勾選
const CITIES = ['台北市', '新北市', '台中市', '高雄市', '花蓮縣', '台南市', '桃園市', '其他'];
const TYPES = ['套房', '雅房', '整層公寓', '共居空間'];
const FEE_OPTIONS = ['水費', '電費', '網路費', '管理費', '第四台', '瓦斯費'];
const AMENITY_OPTIONS = [
  '冷氣', '洗衣機', '烘衣機', '冰箱', '微波爐', '熱水器',
  '電磁爐', '洗碗機', '電視', '第四台', '白板', '投影機',
  '電梯', '停車位', '腳踏車', '烤箱', '衣櫃', '書桌椅', '床架', '對講機', '機車位',
];

type ListingForm = {
  title: string; description: string; city: string; district: string; address: string;
  lat: string; lng: string;
  type: string; price: string; deposit: string; minRent: string; maxRent: string;
  wifiSpeed: string; hasDesk: boolean; deskSize: string; naturalLight: string;
  nearCowork: string; nearMRT: string; includedFees: string[]; amenities: string[];
  images: string[]; foreignOk: boolean; availableFrom: string;
};

export default function EditListingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [notOwner, setNotOwner] = useState(false);

  const [geocoding, setGeocoding] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const [form, setForm] = useState<ListingForm>({
    title: '', description: '', city: '台北市', district: '', address: '',
    lat: '', lng: '',
    type: '套房', price: '', deposit: '2', minRent: '1', maxRent: '12',
    wifiSpeed: '', hasDesk: true, deskSize: '', naturalLight: '3',
    nearCowork: '', nearMRT: '', includedFees: [], amenities: [], images: [], foreignOk: false,
    availableFrom: '',
  });

  useEffect(() => {
    // ① 確認目前登入用戶
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(async (me) => {
        if (!me?.user) { router.push(`/auth/login?redirect=/listings/${id}/edit`); return; }

        // ② 載入房源資料（公開 API）
        const res = await fetch(`/api/listings/${id}`);
        if (!res.ok) { router.push('/dashboard'); return; }
        const data = await res.json();

        // ③ 驗證 ownership：非房源擁有者且非 admin → 顯示無權限畫面
        if (data.owner?.id !== me.user.id && me.user.role !== 'admin') {
          setNotOwner(true);
          setLoading(false);
          return;
        }

        setForm({
          title:        data.title        || '',
          description:  data.description  || '',
          city:         data.city         || '台北市',
          district:     data.district     || '',
          address:      data.address      || '',
          lat:          data.lat          ? String(data.lat)  : '',
          lng:          data.lng          ? String(data.lng)  : '',
          type:         data.type         || '套房',
          price:        String(data.price  || ''),
          deposit:      String(data.deposit || '2'),
          minRent:      String(data.minRent || '1'),
          maxRent:      String(data.maxRent || '12'),
          wifiSpeed:    String(data.wifiSpeed || ''),
          hasDesk:      data.hasDesk      ?? true,
          deskSize:     data.deskSize     || '',
          naturalLight: String(data.naturalLight || '3'),
          nearCowork:   data.nearCowork   ? String(data.nearCowork)  : '',
          nearMRT:      data.nearMRT      ? String(data.nearMRT)     : '',
          includedFees: data.includedFees || [],
          amenities:    data.amenities    || [],
          images:       data.images       || [],
          foreignOk:    data.foreignOk    ?? false,
          availableFrom: data.availableFrom || '',
        });
        setLoading(false);
      })
      .catch(() => router.push('/dashboard'));
  }, [id, router]);

  const set = (k: keyof ListingForm, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const toggleArray = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  const handleGeocode = useCallback(async () => {
    if (!form.district) return;
    setGeocoding(true);
    setGeoStatus('idle');
    const result = await geocodeAddress(form.city, form.district, form.address);
    setGeocoding(false);
    if (result) {
      setForm(f => ({ ...f, lat: String(result.lat), lng: String(result.lng) }));
      setGeoStatus('success');
    } else {
      setGeoStatus('failed');
    }
  }, [form.city, form.district, form.address]);

  const submit = async () => {
    // 必填欄位
    if (!form.title || !form.district || !form.address) {
      setError('請填寫所有必填欄位（標題、區域、地址）');
      return;
    }
    if (!form.description.trim()) {
      setError('請填寫詳細說明');
      return;
    }
    // 數值範圍驗證（與 PUT API 一致）
    const priceNum    = parseInt(form.price);
    const wifiNum     = parseInt(form.wifiSpeed);
    const minRentNum  = parseInt(form.minRent);
    const maxRentNum  = parseInt(form.maxRent);
    if (isNaN(priceNum) || priceNum < 1 || priceNum > 1_000_000) {
      setError('月租金須介於 1 到 1,000,000 元之間');
      return;
    }
    if (isNaN(wifiNum) || wifiNum < 0 || wifiNum > 10_000) {
      setError('Wi-Fi 速度須介於 0 到 10,000 Mbps 之間');
      return;
    }
    if (!isNaN(minRentNum) && !isNaN(maxRentNum) && maxRentNum < minRentNum) {
      setError('最長租期不可小於最短租期');
      return;
    }
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSaving(false);
      if (res.ok) {
        router.push('/dashboard');
      } else {
        // ✅ 安全解析：server 非 JSON 回應時不拋出，改顯示預設訊息
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error || '更新失敗，請稍後再試');
      }
    } catch {
      setSaving(false);
      setError('網路錯誤，請稍後再試');
    }
  };

  // ── 載入中 ──
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm">載入房源資料中...</p>
      </div>
    </div>
  );

  // ── 非擁有者 ──
  if (notOwner) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-sm mx-auto px-4">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">無法編輯此房源</h2>
        <p className="text-gray-500 text-sm mb-6">你不是此房源的擁有者，無法進行編輯。</p>
        <Link href="/dashboard" className="btn-primary">返回控制台</Link>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 頁首 */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← 返回控制台</Link>
        <span className="text-gray-300">|</span>
        <h1 className="text-xl font-bold text-nomad-navy">編輯房源</h1>
      </div>

      {/* 步驟指示 */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { n: 1, label: '基本資料' },
          { n: 2, label: '工作環境' },
          { n: 3, label: '照片描述' },
        ].map(({ n, label }, i, arr) => (
          <div key={n} className="flex items-center gap-2">
            <button onClick={() => setStep(n)}
              className={`w-8 h-8 rounded-full text-sm font-bold transition-all ${
                step === n ? 'bg-blue-600 text-white shadow-md' :
                step > n  ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
              {step > n ? '✓' : n}
            </button>
            <span className={`text-xs ${step === n ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < arr.length - 1 && <div className="w-8 h-0.5 bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-5">
          {error}
        </div>
      )}

      {/* ─────── 步驟一：基本資料 ─────── */}
      {step === 1 && (
        <div className="card p-6 space-y-5">
          <h2 className="font-bold text-gray-800">📋 基本資訊</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              房源標題 <span className="text-red-500">*</span>
            </label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="例：大安區高速光纖套房，附獨立工作桌" className="input" maxLength={100} />
            <p className={`text-xs mt-1 ${form.title.length > 90 ? 'text-amber-500' : 'text-gray-400'}`}>
              {form.title.length}/100 字元
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">城市</label>
              <select value={form.city} onChange={e => { set('city', e.target.value); setGeoStatus('idle'); }} className="input">
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">區域 <span className="text-red-500">*</span></label>
              <input value={form.district} onChange={e => { set('district', e.target.value); setGeoStatus('idle'); }}
                placeholder="例：大安區" className="input" />
            </div>
          </div>

          {/* 地址 + 自動定位 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">詳細地址（可模糊）</label>
            <div className="flex gap-2">
              <input
                value={form.address}
                onChange={e => { set('address', e.target.value); setGeoStatus('idle'); }}
                onBlur={handleGeocode}
                placeholder="審核通過後才會顯示給申請人"
                className="input flex-1" />
              <button type="button" onClick={handleGeocode} disabled={geocoding || !form.district}
                title="重新定位"
                className="shrink-0 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40">
                {geocoding
                  ? <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  : '📍'}
              </button>
            </div>
            {geocoding && <p className="text-xs text-blue-500 mt-1.5">自動定位中…</p>}
            {geoStatus === 'success' && !geocoding && (
              <p className="text-xs text-green-600 mt-1.5">✅ 座標已更新（{parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}）</p>
            )}
            {geoStatus === 'failed' && !geocoding && (
              <p className="text-xs text-amber-600 mt-1.5">⚠️ 無法自動定位，房源仍可正常更新</p>
            )}
            {form.lat && form.lng && geoStatus === 'idle' && (
              <p className="text-xs text-green-600 mt-1.5">📍 現有座標（{parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}）— 點 📍 可重新定位</p>
            )}
          </div>

          {/* 房型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">房型</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPES.map(t => (
                <button key={t} type="button" onClick={() => set('type', t)}
                  className={`py-2.5 text-xs rounded-xl border-2 font-medium transition-all ${
                    form.type === t
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">月租金（NTD）<span className="text-red-500">*</span></label>
              <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="22000" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">押金（月）</label>
              <select value={form.deposit} onChange={e => set('deposit', e.target.value)} className="input">
                {[1, 2, 3].map(n => <option key={n} value={n}>{n} 個月</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最短租期</label>
              <select value={form.minRent} onChange={e => set('minRent', e.target.value)} className="input">
                {[1, 2, 3, 6].map(n => <option key={n} value={n}>{n} 個月</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最長租期</label>
              <select value={form.maxRent} onChange={e => set('maxRent', e.target.value)} className="input">
                {[3, 6, 12, 24].map(n => <option key={n} value={n}>{n} 個月</option>)}
              </select>
            </div>
          </div>

          {/* 費用包含 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">費用包含</label>
            <div className="flex flex-wrap gap-2">
              {FEE_OPTIONS.map(f => (
                <button key={f} type="button" onClick={() => set('includedFees', toggleArray(form.includedFees, f))}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    form.includedFees.includes(f)
                      ? 'bg-green-100 border-green-400 text-green-700'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}>
                  {form.includedFees.includes(f) ? '✓ ' : ''}{f}
                </button>
              ))}
            </div>
          </div>

          {/* 外籍友善 */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="foreignOk" checked={form.foreignOk}
              onChange={e => set('foreignOk', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded" />
            <label htmlFor="foreignOk" className="text-sm text-gray-700">🌍 接受外籍租客</label>
          </div>

          {/* 可入住日期 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📅 可入住日期
              <span className="text-xs text-gray-400 font-normal ml-2">（空白 = 即可入住）</span>
            </label>
            <input suppressHydrationWarning
              type="date"
              value={form.availableFrom}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => set('availableFrom', e.target.value)}
              className="input"
            />
            {form.availableFrom && (
              <button type="button" onClick={() => set('availableFrom', '')}
                className="text-xs text-red-400 hover:underline mt-1">
                清除（設為即可入住）
              </button>
            )}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!form.title || !form.district || !form.price}
            className="btn-primary w-full py-3">
            下一步：工作環境設定 →
          </button>
        </div>
      )}

      {/* ─────── 步驟二：工作環境 ─────── */}
      {step === 2 && (
        <div className="card p-6 space-y-5">
          <h2 className="font-bold text-gray-800">🖥 工作環境設定</h2>

          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-blue-600 mb-2 font-medium">⚡ Wi-Fi 速度（游牧者最重視的指標！）</p>
            <input type="number" value={form.wifiSpeed} onChange={e => set('wifiSpeed', e.target.value)}
              placeholder="例：200（使用 fast.com 測試）" className="input" min="1" />
            {!form.wifiSpeed && (
              <p className="text-xs text-amber-600 mt-1.5">⚠️ Wi-Fi 速度為必填</p>
            )}
          </div>

          {/* 採光評分 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">自然採光</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => set('naturalLight', String(n))}
                  className={`w-12 h-10 rounded-lg border text-sm font-medium transition-colors ${
                    form.naturalLight === String(n)
                      ? 'bg-yellow-400 border-yellow-500 text-white'
                      : 'bg-white border-gray-300 text-gray-600'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">1=非常暗 5=光線充足</p>
          </div>

          {/* 書桌 toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-700">有工作桌</p>
              <p className="text-xs text-gray-400">游牧工作者必備</p>
            </div>
            <button onClick={() => set('hasDesk', !form.hasDesk)}
              className={`w-12 h-6 rounded-full transition-colors relative ${form.hasDesk ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${form.hasDesk ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {form.hasDesk && (
            <input value={form.deskSize} onChange={e => set('deskSize', e.target.value)}
              placeholder="桌面尺寸（例：120x60cm）" className="input" />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">捷運站步行（分鐘）</label>
              <input type="number" value={form.nearMRT} onChange={e => set('nearMRT', e.target.value)} placeholder="5" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">共工空間步行（分鐘）</label>
              <input type="number" value={form.nearCowork} onChange={e => set('nearCowork', e.target.value)} placeholder="10" className="input" />
            </div>
          </div>

          {/* 設備 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">設備與設施</label>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map(a => (
                <button key={a} type="button" onClick={() => set('amenities', toggleArray(form.amenities, a))}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    form.amenities.includes(a)
                      ? 'bg-blue-100 border-blue-400 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}>
                  {form.amenities.includes(a) ? '✓ ' : ''}{a}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-3">← 上一步</button>
            <button onClick={() => setStep(3)} disabled={!form.wifiSpeed}
              className="btn-primary flex-1 py-3">下一步：照片描述 →</button>
          </div>
        </div>
      )}

      {/* ─────── 步驟三：照片與描述 ─────── */}
      {step === 3 && (
        <div className="card p-6 space-y-5">
          <h2 className="font-bold text-gray-800">📝 照片與描述</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">📸 房源圖片（最多 5 張）</label>
            <ImageUploader images={form.images} onChange={urls => set('images', urls)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">詳細說明</label>
            <textarea rows={7} value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="詳細描述房源特色、周邊環境、適合的租客類型..."
              className="input resize-none" />
            <p className="text-xs text-gray-400 text-right mt-1">{form.description.length} 字元</p>
          </div>

          {/* 確認摘要 */}
          <div className="bg-blue-50 rounded-xl p-4">
            <h3 className="font-semibold text-blue-800 mb-2 text-sm">📋 修改摘要確認</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
              <div>城市：{form.city} {form.district}</div>
              <div>房型：{form.type}</div>
              <div>月租：NT$ {form.price || '—'}</div>
              <div>Wi-Fi：{form.wifiSpeed || '—'} Mbps</div>
              <div>租期：{form.minRent}～{form.maxRent} 個月</div>
              <div>外籍友善：{form.foreignOk ? '✓ 是' : '✗ 否'}</div>
              <div className="col-span-2">圖片：{form.images.length} 張</div>
            </div>
          </div>

          {/* 重新審核提示 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            ⚠️ 儲存後房源狀態將重設為「待審核」，管理員審核通過後才會重新上架。
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary flex-1 py-3">← 上一步</button>
            <button onClick={submit} disabled={saving || !form.description || !form.wifiSpeed}
              className="btn-primary flex-1 py-3 text-base">
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  儲存中...
                </span>
              ) : '💾 儲存變更'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
