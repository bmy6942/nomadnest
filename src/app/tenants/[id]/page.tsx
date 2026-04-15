import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return { title: '找不到租客' };
  return {
    title: `${user.name} 的租客檔案 | NomadNest Taiwan`,
    description: user.bio || `查看 ${user.name} 在 NomadNest 上的租屋記錄`,
  };
}

export default async function TenantProfilePage({ params }: { params: { id: string } }) {
  const viewer = await getCurrentUser();

  // 只有房東 / 管理員可以查看租客完整檔案
  const isLandlordOrAdmin = viewer?.role === 'landlord' || viewer?.role === 'admin';

  const tenant = await prisma.user.findUnique({
    where: { id: params.id, role: 'tenant' },
    select: {
      id: true, name: true, bio: true, verified: true, createdAt: true,
      verificationStatus: true, avatar: true,
      applications: {
        where: { status: 'approved' },
        select: {
          id: true, moveInDate: true, duration: true, createdAt: true,
          listing: { select: { id: true, title: true, city: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      reviewsGiven: {
        select: {
          id: true, rating: true, wifiRating: true, content: true, createdAt: true,
          listing: { select: { id: true, title: true, city: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!tenant) notFound();

  const memberSince = new Date(tenant.createdAt).toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long',
  });

  const avgRating = tenant.reviewsGiven.length > 0
    ? (tenant.reviewsGiven.reduce((s, r) => s + r.rating, 0) / tenant.reviewsGiven.length).toFixed(1)
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shrink-0">
            {tenant.avatar
              ? <img src={tenant.avatar} alt="" loading="lazy" className="w-full h-full object-cover rounded-2xl" />
              : tenant.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{tenant.name}</h1>
              {tenant.verified && (
                <span className="badge bg-green-100 text-green-700 text-xs">✓ 已驗證</span>
              )}
              {tenant.verificationStatus === 'emailPending' ? (
                <span className="badge bg-yellow-100 text-yellow-700 text-xs">📬 Email 待驗證</span>
              ) : null}
              <span className="badge bg-gray-100 text-gray-600 text-xs">🧳 游牧租客</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">成員自 {memberSince}</p>
            {tenant.bio && (
              <p className="text-sm text-gray-700 mt-3 leading-relaxed">{tenant.bio}</p>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100 text-center">
          <div>
            <div className="text-xl font-bold text-nomad-navy">{tenant.applications.length}</div>
            <div className="text-xs text-gray-500">已入住次數</div>
          </div>
          <div>
            <div className="text-xl font-bold text-nomad-navy">{tenant.reviewsGiven.length}</div>
            <div className="text-xs text-gray-500">撰寫的評價</div>
          </div>
          <div>
            <div className="text-xl font-bold text-nomad-navy">{avgRating ?? '—'}</div>
            <div className="text-xs text-gray-500">平均評分</div>
          </div>
        </div>
      </div>

      {/* Rental History（僅房東可見）*/}
      {isLandlordOrAdmin && tenant.applications.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-bold text-gray-800 mb-4">🏠 租屋記錄（核准入住）</h2>
          <div className="space-y-3">
            {tenant.applications.map(app => (
              <div key={app.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <Link href={`/listings/${app.listing.id}`}
                    className="font-medium text-sm hover:text-blue-600 line-clamp-1">
                    {app.listing.title}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {app.listing.city} · {app.listing.type} · {app.moveInDate} 入住 · {app.duration} 個月
                  </p>
                </div>
                <span className="badge bg-green-100 text-green-700 text-xs shrink-0">✅ 已入住</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLandlordOrAdmin && (
        <div className="card p-5 mb-6 bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800 text-center">
            🔒 租屋記錄僅供房東查看。
            {!viewer && <Link href="/auth/login" className="font-semibold underline ml-1">登入</Link>}
          </p>
        </div>
      )}

      {/* Reviews Written */}
      {tenant.reviewsGiven.length > 0 && (
        <div className="card p-5">
          <h2 className="font-bold text-gray-800 mb-4">⭐ 撰寫的評價</h2>
          <div className="space-y-4">
            {tenant.reviewsGiven.map(r => (
              <div key={r.id} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <Link href={`/listings/${r.listing.id}`}
                    className="font-medium text-sm hover:text-blue-600 truncate max-w-[60%]">
                    {r.listing.title}
                  </Link>
                  <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                    <span className="text-yellow-500">{'★'.repeat(r.rating)}</span>
                    <span>Wi-Fi: {'★'.repeat(r.wifiRating)}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{r.content}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(r.createdAt).toLocaleDateString('zh-TW')} · {r.listing.city}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tenant.reviewsGiven.length === 0 && (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-gray-500 text-sm">尚未撰寫任何評價</p>
        </div>
      )}
    </div>
  );
}
