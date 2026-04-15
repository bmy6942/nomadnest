'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const PushNotificationManager = dynamic(
  () => import('@/components/PushNotificationManager'),
  { ssr: false }
);

type Profile = {
  id: string; name: string; email: string; role: string;
  phone: string; lineId: string; bio: string; avatar?: string | null;
  verified: boolean; verificationStatus: string; idDocUrl?: string;
  createdAt: string;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'info' | 'password' | 'verify' | 'notifications'>('info');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const [form, setForm] = useState({ name: '', phone: '', lineId: '', bio: '' });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [verifyForm, setVerifyForm] = useState({ idDocUrl: '', uploading: false });
  const fileRef = useRef<HTMLInputElement>(null);
  // Email 驗證重寄
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resentEmail, setResentEmail] = useState(false);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => { if (r.status === 401) { router.push('/auth/login'); return null; } return r.json(); })
      .then(d => {
        if (d) {
          setProfile(d);
          setForm({ name: d.name || '', phone: d.phone || '', lineId: d.lineId || '', bio: d.bio || '' });
          if (d.avatar) setAvatarUrl(d.avatar);
          if (d.idDocUrl) setVerifyForm(f => ({ ...f, idDocUrl: d.idDocUrl }));
          setLoading(false);
        }
      });
  }, [router]);

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setErrorMsg(''); setTimeout(() => setSuccessMsg(''), 4000); };

  // 重寄 Email 驗證信
  const resendVerification = async () => {
    if (!profile) return;
    setResendingEmail(true);
    await fetch('/api/auth/verify-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: profile.email }),
    });
    setResendingEmail(false);
    setResentEmail(true);
    setTimeout(() => setResentEmail(false), 8000);
  };

  // 刪除頭像
  const removeAvatar = async () => {
    if (!confirm('確定要移除頭像嗎？')) return;
    setSaving(true);
    await fetch('/api/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: null }),
    });
    setSaving(false);
    setAvatarUrl('');
    setProfile(p => p ? { ...p, avatar: null } : p);
    showSuccess('✅ 頭像已移除');
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setErrorMsg('姓名不能為空'); return; }
    setSaving(true); setErrorMsg('');
    const res = await fetch('/api/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) { setProfile(p => p ? { ...p, ...data } : p); showSuccess('✅ 個人資料已更新！'); }
    else setErrorMsg(data.error || '更新失敗');
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) { setErrorMsg('兩次密碼不一致'); return; }
    if (pwForm.newPassword.length < 8) { setErrorMsg('新密碼至少 8 個字元'); return; }
    setSaving(true); setErrorMsg('');
    const res = await fetch('/api/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) { setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); showSuccess('✅ 密碼已更新！'); }
    else setErrorMsg(data.error || '更新失敗');
  };

  // 上傳頭像
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const fd = new FormData();
    fd.append('files', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    setAvatarUploading(false);
    if (res.ok && data.urls?.[0]) {
      const url = data.urls[0];
      setAvatarUrl(url);
      // 立即儲存到 profile
      await fetch('/api/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: url }),
      });
      setProfile(p => p ? { ...p, avatar: url } : p);
      showSuccess('✅ 頭像已更新！');
    } else setErrorMsg(data.error || '頭像上傳失敗');
  };

  // 上傳身份文件
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVerifyForm(f => ({ ...f, uploading: true }));
    const fd = new FormData();
    fd.append('files', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    setVerifyForm(f => ({ ...f, uploading: false, idDocUrl: res.ok ? data.urls[0] : f.idDocUrl }));
    if (!res.ok) setErrorMsg(data.error || '上傳失敗');
  };

  const submitVerification = async () => {
    if (!verifyForm.idDocUrl) { setErrorMsg('請先上傳身分證明文件'); return; }
    setSaving(true); setErrorMsg('');
    const res = await fetch('/api/profile/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idDocUrl: verifyForm.idDocUrl }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setProfile(p => p ? { ...p, verificationStatus: 'pending' } : p);
      showSuccess('✅ 驗證申請已送出！管理員審核後會為你加上認證徽章。');
    } else setErrorMsg(data.error || '提交失敗');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><div className="text-4xl mb-4">⏳</div><p className="text-gray-500">載入中...</p></div></div>;
  if (!profile) return null;

  const roleLabel = profile.role === 'landlord' ? '🏠 房東' : profile.role === 'admin' ? '⚙ 管理員' : '🧳 房客';
  const joinDate = new Date(profile.createdAt).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });

  // 個人資料完整度計算
  const completionItems = [
    { label: '姓名',       done: !!profile.name },
    { label: '頭像',       done: !!profile.avatar },
    { label: '手機號碼',   done: !!profile.phone },
    { label: 'LINE ID',    done: !!profile.lineId },
    { label: '自我介紹',   done: !!profile.bio && profile.bio.length >= 10 },
    { label: 'Email 驗證', done: profile.verificationStatus !== 'emailPending' },
    { label: '身份驗證',   done: profile.verified },
  ];
  const completionPct = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100);
  const incompletItems = completionItems.filter(i => !i.done);

  const verifyStatusMap: Record<string, { label: string; color: string; desc: string }> = {
    none:     { label: '未申請',   color: 'bg-gray-100 text-gray-500',    desc: '提交身份文件申請驗證，通過後顯示 ✓ 認證徽章，提升房東/房客信任度' },
    pending:  { label: '⏳ 審核中', color: 'bg-yellow-100 text-yellow-700', desc: '你的驗證申請正在審核中，通常 1~2 個工作天內完成' },
    approved: { label: '✓ 已通過',  color: 'bg-green-100 text-green-700',  desc: '身份已通過驗證，認證徽章已顯示在你的個人頁面' },
    rejected: { label: '✗ 未通過',  color: 'bg-red-100 text-red-600',     desc: '驗證未通過，請重新上傳清晰的身分證明文件後再次申請' },
  };
  const vs = verifyStatusMap[profile.verificationStatus] || verifyStatusMap.none;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        {/* Avatar 可點擊上傳 */}
        <div className="relative shrink-0 flex flex-col items-center gap-1.5">
          <input type="file" ref={avatarRef} accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          <div
            onClick={() => avatarRef.current?.click()}
            className="w-20 h-20 rounded-full overflow-hidden cursor-pointer border-4 border-white shadow-lg hover:shadow-xl transition-shadow relative group">
            {avatarUploading ? (
              <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-500 text-xl animate-pulse">⏳</div>
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="頭像" loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-3xl font-bold">
                {profile.name[0]}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium rounded-full">
              📷 更換
            </div>
          </div>
          {/* 移除頭像按鈕 */}
          {avatarUrl && (
            <button onClick={removeAvatar} className="text-xs text-gray-400 hover:text-red-500 transition-colors leading-none">
              ✕ 移除
            </button>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-nomad-navy">{profile.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{roleLabel}</span>
            {profile.verified
              ? <span className="text-sm text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">✓ 已認證</span>
              : <span className={`text-xs px-2 py-0.5 rounded-full ${vs.color}`}>{vs.label}</span>}
            <span className="text-xs text-gray-400">加入於 {joinDate}</span>
          </div>
          {/* 個人資料完整度進度條 */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">個人資料完整度</span>
              <span className={`text-xs font-bold ${completionPct === 100 ? 'text-green-600' : completionPct >= 70 ? 'text-blue-600' : 'text-amber-600'}`}>{completionPct}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${completionPct === 100 ? 'bg-green-500' : completionPct >= 70 ? 'bg-blue-500' : 'bg-amber-400'}`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
            {incompletItems.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                尚未完成：{incompletItems.map(i => i.label).join('、')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Email 未驗證提示 ── */}
      {profile.verificationStatus === 'emailPending' && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="text-2xl shrink-0">📬</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Email 尚未驗證</p>
            <p className="text-xs text-amber-700 mt-0.5">
              驗證連結已寄至 <strong>{profile.email}</strong>，請查收後點擊連結完成驗證。
            </p>
            {resentEmail && <p className="text-xs text-green-700 mt-1 font-medium">✅ 驗證信已重寄！</p>}
          </div>
          {!resentEmail && (
            <button
              onClick={resendVerification}
              disabled={resendingEmail}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50">
              {resendingEmail ? '寄送中...' : '📧 重寄驗證信'}
            </button>
          )}
        </div>
      )}

      {/* Alerts */}
      {successMsg && <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-xl mb-5">{successMsg}</div>}
      {errorMsg && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl mb-5">{errorMsg}</div>}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {[
          { key: 'info',     label: '👤 個人資料' },
          { key: 'password', label: '🔒 修改密碼' },
          { key: 'verify',        label: `✓ 身份驗證${profile.verificationStatus === 'pending' ? ' ⏳' : profile.verified ? ' ✓' : ''}` },
          { key: 'notifications', label: '🔔 通知設定' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as typeof tab); setErrorMsg(''); }}
            className={`flex-1 shrink-0 px-1 sm:px-3 py-2 rounded-lg text-[11px] sm:text-sm font-medium transition-all whitespace-nowrap ${tab === t.key ? 'bg-white text-nomad-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Info Tab ── */}
      {tab === 'info' && (
        <div className="card p-4 sm:p-6">
          <form onSubmit={saveProfile} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400 font-normal text-xs">（不可修改）</span></label>
              <input value={profile.email} disabled className="input bg-gray-50 text-gray-400 cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名 / 暱稱 <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="你的名字" required className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">手機號碼</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="09XX-XXX-XXX" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LINE ID</label>
              <input value={form.lineId} onChange={e => setForm(f => ({ ...f, lineId: e.target.value }))} placeholder="@your_line_id" className="input" />
              <p className="text-xs text-gray-400 mt-1">通過身份驗證後才會對其他用戶顯示</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">自我介紹</label>
              <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={4} maxLength={300} placeholder="介紹一下自己..." className="input resize-none" />
              <p className="text-xs text-gray-400 mt-1 text-right">{form.bio.length}/300</p>
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full py-3">{saving ? '儲存中...' : '💾 儲存變更'}</button>
          </form>
        </div>
      )}

      {/* ── Password Tab ── */}
      {tab === 'password' && (
        <div className="card p-4 sm:p-6">
          <p className="text-sm text-gray-500 mb-5">請先確認目前的密碼，再設定新密碼。</p>
          <form onSubmit={savePassword} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目前密碼</label>
              <input type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} placeholder="輸入目前的密碼" required className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
              <input type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} placeholder="至少 8 個字元" required minLength={8} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">確認新密碼</label>
              <input type="password" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="再輸入一次" required className="input" />
              {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">⚠ 兩次密碼不一致</p>
              )}
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full py-3">{saving ? '更新中...' : '🔒 更新密碼'}</button>
          </form>
        </div>
      )}

      {/* ── Verification Tab ── */}
      {tab === 'verify' && (
        <div className="space-y-4">
          {/* Status banner */}
          <div className={`rounded-2xl p-4 border ${profile.verified ? 'bg-green-50 border-green-200' : profile.verificationStatus === 'pending' ? 'bg-yellow-50 border-yellow-200' : profile.verificationStatus === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center gap-3">
              <div className="text-3xl">{profile.verified ? '✅' : profile.verificationStatus === 'pending' ? '⏳' : profile.verificationStatus === 'rejected' ? '❌' : '🪪'}</div>
              <div>
                <p className="font-semibold text-gray-800">身份驗證狀態：<span className={vs.color.replace('bg-', 'text-').split(' ')[0] + ' font-bold'}>{vs.label}</span></p>
                <p className="text-sm text-gray-600 mt-0.5">{vs.desc}</p>
              </div>
            </div>
          </div>

          {/* Why verify */}
          {!profile.verified && (
            <div className="card p-5 bg-gray-50">
              <h3 className="font-semibold text-gray-800 mb-3">為什麼要驗證身份？</h3>
              <div className="space-y-2 text-sm text-gray-600">
                {[
                  '🏠 房東：取得「✓ 已認證」徽章，讓租客更放心申請',
                  '🧳 房客：房東更願意優先接受已驗證的租客申請',
                  '🔒 提升平台安全性，減少假帳號與詐欺風險',
                  '💬 通過驗證後 LINE ID 才會對其他用戶顯示',
                ].map(i => <p key={i}>{i}</p>)}
              </div>
            </div>
          )}

          {/* Upload form */}
          {(!profile.verified && profile.verificationStatus !== 'approved') && (
            <div className="card p-4 sm:p-6">
              <h3 className="font-semibold text-gray-800 mb-4">
                {profile.verificationStatus === 'rejected' ? '重新提交身份驗證' : '提交身份驗證申請'}
              </h3>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  身分證明文件 <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-400 font-normal ml-2">（身分證、護照或居留證正面）</span>
                </label>

                {/* Upload area */}
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${verifyForm.idDocUrl ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                  {verifyForm.uploading ? (
                    <div className="text-gray-500"><div className="text-2xl mb-2 animate-spin">⏳</div><p className="text-sm">上傳中...</p></div>
                  ) : verifyForm.idDocUrl ? (
                    <div>
                      <img src={verifyForm.idDocUrl} alt="已上傳文件" loading="lazy" className="max-h-40 mx-auto rounded-lg mb-2 object-contain" />
                      <p className="text-xs text-green-600 font-medium">✓ 文件已上傳，點擊可重新上傳</p>
                    </div>
                  ) : (
                    <div className="text-gray-400">
                      <div className="text-3xl mb-2">📄</div>
                      <p className="text-sm font-medium text-gray-600">點擊上傳身份文件</p>
                      <p className="text-xs mt-1">支援 JPG、PNG，檔案大小上限 5MB</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleDocUpload} />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-5 text-xs text-yellow-700">
                ⚠ 你的身份文件僅供管理員驗證使用，不會公開顯示。上傳前請確認文件清晰可辨。
              </div>

              <button
                onClick={submitVerification}
                disabled={saving || verifyForm.uploading || !verifyForm.idDocUrl || profile.verificationStatus === 'pending'}
                className="btn-primary w-full py-3 disabled:opacity-50">
                {saving ? '送出中...' : profile.verificationStatus === 'pending' ? '⏳ 審核中（已送出）' : '📨 送出驗證申請'}
              </button>
            </div>
          )}

          {/* Already verified */}
          {profile.verified && (
            <div className="card p-6 text-center">
              <div className="text-5xl mb-3">🎉</div>
              <h3 className="font-bold text-gray-800 mb-1">恭喜！你的身份已通過驗證</h3>
              <p className="text-sm text-gray-500">認證徽章已顯示在你的個人檔案與房源頁面</p>
            </div>
          )}
        </div>
      )}

      {/* ── Notifications Tab ── */}
      {tab === 'notifications' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-bold text-gray-800 mb-1">🔔 通知偏好設定</h2>
            <p className="text-sm text-gray-500 mb-4">管理你的推播通知訂閱，掌握最新申請與訊息動態。</p>
            <PushNotificationManager />
          </div>

          <div className="card p-5 bg-blue-50 border-blue-100">
            <h3 className="font-semibold text-gray-800 mb-2">📋 通知項目說明</h3>
            <div className="space-y-2 text-sm text-gray-600">
              {[
                { icon: '💬', text: '新訊息通知 — 房東或租客傳送訊息時立即推播' },
                { icon: '📩', text: '申請狀態更新 — 申請核准、退件、新申請提醒' },
                { icon: '📅', text: '看房預約提醒 — 預約確認及提前 24 小時提醒' },
                { icon: '📋', text: '合約簽署通知 — 對方完成簽署時推播提示' },
                { icon: '⏰', text: '租約到期提醒 — 距到期 30 天、7 天自動提醒' },
              ].map(item => (
                <div key={item.icon} className="flex items-start gap-2">
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
