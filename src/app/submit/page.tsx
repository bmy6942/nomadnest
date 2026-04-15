'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ImageUploader from '@/components/ImageUploader';
import { geocodeAddress } from '@/lib/geocode';

const FEES = ['水費', '電費', '網路費', '管理費', '第四台', '瓦斯費'];
const AMENITIES_LIST = ['冷氣', '洗衣機', '烘衣機', '冰箱', '微波爐', '熱水器', '電磁爐', '洗碗機', '電視', '第四台', '白板', '投影機', '電梯', '停車位', '腳踏車'];
const CITIES = ['台北市', '新北市', '台中市', '高雄市', '花蓮縣', '台南市', '桃園市', '其他'];
const TYPES = ['套房', '雅房', '整層公寓', '共居空間'];

export default function SubmitPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const [form, setForm] = useState({
    title: '', description: '', city: '台北市', district: '', address: '',
    lat: '', lng: '',
    type: '套房', price: '', deposit: '2', minRent: '1', maxRent: '6',
    wifiSpeed: '', hasDesk: true, deskSize: '', naturalLight: '4',
    nearCowork: '', nearMRT: '', foreignOk: false,
    availableFrom: '',
    includedFees: [] as string[], amenities: [] as string[],
    images: [] as string[],
  });

  const toggle = (key: 'includedFees' | 'amenities', val: string) => {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val],
    }));
  };

  // 地址自動定位
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
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/listings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setLoading(false);
      if (res.ok) { router.push('/dashboard'); return; }
      if (res.status === 401) { router.push('/auth/login'); return; }
      // ✅ 安全解析：server 非 JSON 回應時（如 500 HTML）不拋出，改顯示預設訊息
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error || '刊登失敗，請再試一次');
    } catch {
      setLoading(false);
      setError('網路錯誤，請稍後再試');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-nomad-navy">刊登你的房源</h1>
        <p className="text-gray-500 text-sm mt-1">讓台灣的數位游牧工作者找到你</p>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[
          { n: 1, label: '基本資料' },
          { n: 2, label: '工作環境' },
          { n: 3, label: '照片描述' },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= n ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>{n}</div>
              <span className={`text-xs mt-0.5 ${step >= n ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
            </div>
            {n < 3 && <div className={`w-12 h-0.5 mb-4 ${step > n ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

      <div className="card p-6">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-bold text-gray-800 text-lg">📋 基本資訊</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">房源標題 *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="例：大安區高速光纖套房，附獨立工作桌" className="input" maxLength={60} />
              <p className="text-xs text-gray-400 mt-1">{form.title.length}/60 字元</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">城市 *</label>
                <select value={form.city}
                  onChange={e => { setForm(f => ({ ...f, city: e.target.value })); setGeoStatus('idle'); }}
                  className="input">
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">行政區 *</label>
                <input value={form.district}
                  onChange={e => { setForm(f => ({ ...f, district: e.target.value })); setGeoStatus('idle'); }}
                  placeholder="例：大安區" className="input" />
              </div>
            </div>

            {/* 地址 + 自動定位 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">詳細地址（可模糊）</label>
              <div className="flex gap-2">
                <input
                  value={form.address}
                  onChange={e => { setForm(f => ({ ...f, address: e.target.value })); setGeoStatus('idle'); }}
                  onBlur={handleGeocode}
                  placeholder="例：仁愛路四段12號，近捷運忠孝敦化站"
                  className="input flex-1" />
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={geocoding || !form.district}
                  title="重新定位"
                  className="shrink-0 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40">
                  {geocoding ? (
                    <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : '📍'}
                </button>
              </div>

              {/* 定位狀態提示 */}
              {geocoding && (
                <p className="text-xs text-blue-500 mt-1.5 flex items-center gap-1">
                  <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  自動定位中，請稍候…
                </p>
              )}
              {geoStatus === 'success' && !geocoding && (
                <p className="text-xs text-green-600 mt-1.5">
                  ✅ 地圖座標已自動設定（{parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}）
                </p>
              )}
              {geoStatus === 'failed' && !geocoding && (
                <p className="text-xs text-amber-600 mt-1.5">
                  ⚠️ 無法自動定位，房源仍可正常刊登，但不會顯示在地圖上
                </p>
              )}
              {geoStatus === 'idle' && !geocoding && form.district && (
                <p className="text-xs text-gray-400 mt-1.5">離開地址欄位後將自動定位，或點擊 📍 手動觸發</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">房型 *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input">
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">月租金（NTD）*</label>
                <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="15000" className="input" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">押金（月）</label>
                <select value={form.deposit} onChange={e => setForm(f => ({ ...f, deposit: e.target.value }))} className="input">
                  {[1,2,3].map(n => <option key={n} value={n}>{n} 個月</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最短租期</label>
                <select value={form.minRent} onChange={e => setForm(f => ({ ...f, minRent: e.target.value }))} className="input">
                  {[1,2,3,6].map(n => <option key={n} value={n}>{n} 個月</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最長租期</label>
                <select value={form.maxRent} onChange={e => setForm(f => ({ ...f, maxRent: e.target.value }))} className="input">
                  {[3,6,12,24].map(n => <option key={n} value={n}>{n} 個月</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">費用包含</label>
              <div className="flex flex-wrap gap-2">
                {FEES.map(f => (
                  <button key={f} type="button" onClick={() => toggle('includedFees', f)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${form.includedFees.includes(f) ? 'bg-green-100 border-green-400 text-green-700' : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                    {form.includedFees.includes(f) ? '✓ ' : ''}{f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="foreignOk" checked={form.foreignOk} onChange={e => setForm(f => ({ ...f, foreignOk: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
              <label htmlFor="foreignOk" className="text-sm text-gray-700">🌍 接受外籍租客</label>
            </div>

            {/* ✅ 可入住日期 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📅 可入住日期</label>
              <input
                type="date"
                value={form.availableFrom}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm(f => ({ ...f, availableFrom: e.target.value }))}
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1">不填寫表示即可入住</p>
            </div>
          </div>
        )}

        {/* Step 2: Work Setup */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-bold text-gray-800 text-lg">🖥 工作環境設定（游牧者最重視）</h2>

            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-1 text-sm">⚡ Wi-Fi 速度</h3>
              <p className="text-xs text-blue-600 mb-3">這是游牧者選屋的第一考量！請填寫真實測速結果。</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">實測下載速度（Mbps）*</label>
                <input type="number" value={form.wifiSpeed} onChange={e => setForm(f => ({ ...f, wifiSpeed: e.target.value }))}
                  placeholder="例：200（使用 fast.com 測試）" className="input" min="1" />
                <p className="text-xs text-gray-500 mt-1">建議至少測3次取平均值，可至 fast.com 測速</p>
                {!form.wifiSpeed && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Wi-Fi 速度為必填，游牧者最重視此項目</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <input type="checkbox" id="hasDesk" checked={form.hasDesk} onChange={e => setForm(f => ({ ...f, hasDesk: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="hasDesk" className="text-sm font-medium text-gray-700">有提供工作桌</label>
              </div>
              {form.hasDesk && (
                <input value={form.deskSize} onChange={e => setForm(f => ({ ...f, deskSize: e.target.value }))}
                  placeholder="桌面尺寸（例：120x60cm）" className="input" />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">自然採光程度</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setForm(f => ({ ...f, naturalLight: String(n) }))}
                    className={`w-12 h-10 rounded-lg border text-sm font-medium transition-colors ${form.naturalLight === String(n) ? 'bg-yellow-400 border-yellow-500 text-white' : 'bg-white border-gray-300 text-gray-600'}`}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">1=非常暗 5=光線充足</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">捷運站步行（分鐘）</label>
                <input type="number" value={form.nearMRT} onChange={e => setForm(f => ({ ...f, nearMRT: e.target.value }))} placeholder="5" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">共工空間步行（分鐘）</label>
                <input type="number" value={form.nearCowork} onChange={e => setForm(f => ({ ...f, nearCowork: e.target.value }))} placeholder="10（0=本棟）" className="input" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">設備與設施</label>
              <div className="flex flex-wrap gap-2">
                {AMENITIES_LIST.map(a => (
                  <button key={a} type="button" onClick={() => toggle('amenities', a)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${form.amenities.includes(a) ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                    {form.amenities.includes(a) ? '✓ ' : ''}{a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Description */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-bold text-gray-800 text-lg">📝 房源描述</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">詳細說明 *</label>
              <textarea rows={8} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="詳細描述你的房源特色、周邊環境、適合的租客類型、特別說明等..."
                className="input resize-none" />
              <p className="text-xs text-gray-400 text-right mt-1">{form.description.length} 字元</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">📸 房源圖片（最多 5 張）</label>
              <ImageUploader
                images={form.images}
                onChange={urls => setForm(f => ({ ...f, images: urls }))}
              />
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-2 text-sm">📋 刊登摘要確認</h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                <div>城市：{form.city} {form.district}</div>
                <div>房型：{form.type}</div>
                <div>月租：NT$ {form.price || '—'}</div>
                <div>Wi-Fi：{form.wifiSpeed || '—'} Mbps</div>
                <div>租期：{form.minRent}～{form.maxRent} 個月</div>
                <div>外籍友善：{form.foreignOk ? '✓ 是' : '✗ 否'}</div>
                <div className="col-span-2">
                  地圖定位：{form.lat && form.lng
                    ? <span className="text-green-600">✅ 已設定</span>
                    : <span className="text-gray-400">未設定（不影響刊登）</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 1 && <button onClick={() => setStep(s => s - 1)} className="btn-secondary flex-1">← 上一步</button>}
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)}
              disabled={
                (step === 1 && (!form.title || !form.district || !form.price)) ||
                (step === 2 && !form.wifiSpeed)
              }
              className="btn-primary flex-1">下一步 →</button>
          ) : (
            <button onClick={submit} disabled={loading || !form.description || !form.wifiSpeed}
              className="btn-primary flex-1">
              {loading ? '送出中...' : '🚀 送出刊登申請'}
            </button>
          )}
        </div>
        {step === 3 && <p className="text-xs text-gray-400 text-center mt-2">送出後管理員將在 24 小時內審核</p>}
      </div>
    </div>
  );
}
