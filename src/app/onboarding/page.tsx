'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'tenant' | 'landlord';

interface StepProps {
  onNext: (data?: Partial<FormData>) => void;
  onBack?: () => void;
  data: FormData;
}

interface FormData {
  role: Role;
  bio: string;
  preferences: string[];
  name: string;
}

// ─── Preference tags ───────────────────────────────────────────────────────────
const TENANT_PREFS = [
  { id: 'wifi',      label: 'Fast Wi-Fi',        icon: '⚡' },
  { id: 'desk',      label: 'Work desk',          icon: '🖥️' },
  { id: 'quiet',     label: 'Quiet environment',  icon: '🤫' },
  { id: 'mrt',       label: 'Near MRT/transit',   icon: '🚇' },
  { id: 'foreign',   label: 'Foreigner-friendly', icon: '🌍' },
  { id: 'cowork',    label: 'Near co-working',    icon: '☕' },
  { id: 'kitchen',   label: 'Full kitchen',       icon: '🍳' },
  { id: 'pet',       label: 'Pet-friendly',       icon: '🐾' },
];

const LANDLORD_PREFS = [
  { id: 'studio',    label: 'Studio',             icon: '🏠' },
  { id: 'room',      label: 'Private room',       icon: '🛏️' },
  { id: 'apartment', label: 'Full apartment',     icon: '🏢' },
  { id: 'coliving',  label: 'Co-living space',    icon: '🤝' },
  { id: 'shortterm', label: 'Short stays (1 mo)', icon: '📅' },
  { id: 'longterm',  label: 'Long stays (3+ mo)', icon: '📆' },
  { id: 'verified',  label: 'Wi-Fi verified',     icon: '✅' },
  { id: 'foreignok', label: 'Accepts foreigners', icon: '🌍' },
];

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full mb-8">
      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>Step {step} of {total}</span>
        <span>{Math.round((step / total) * 100)}% complete</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─── Step 1: Role selection ───────────────────────────────────────────────────
function StepRole({ onNext, data }: StepProps) {
  const [role, setRole] = useState<Role>(data.role);

  const roles = [
    {
      value: 'tenant' as Role,
      icon: '🧳',
      title: 'Digital Nomad',
      subtitle: "I'm looking for a place to live & work",
      bullets: ['Browse verified Wi-Fi listings', 'Message hosts directly', 'Book viewings online'],
      color: 'blue',
    },
    {
      value: 'landlord' as Role,
      icon: '🏠',
      title: 'Host / Landlord',
      subtitle: "I want to list my property",
      bullets: ['Reach digital nomad tenants', 'Manage applications easily', 'Sign contracts online'],
      color: 'violet',
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">What brings you here?</h2>
      <p className="text-gray-500 text-sm mb-6">This helps us personalize your NomadNest experience.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {roles.map(r => (
          <button
            key={r.value}
            onClick={() => setRole(r.value)}
            className={`p-5 rounded-2xl border-2 text-left transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
              role === r.value
                ? r.value === 'tenant'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-violet-500 bg-violet-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="text-3xl mb-3">{r.icon}</div>
            <p className={`font-bold text-base mb-0.5 ${
              role === r.value
                ? r.value === 'tenant' ? 'text-blue-700' : 'text-violet-700'
                : 'text-gray-900'
            }`}>{r.title}</p>
            <p className="text-xs text-gray-500 mb-3">{r.subtitle}</p>
            <ul className="space-y-1">
              {r.bullets.map(b => (
                <li key={b} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <svg className={`w-3.5 h-3.5 shrink-0 ${
                    role === r.value
                      ? r.value === 'tenant' ? 'text-blue-500' : 'text-violet-500'
                      : 'text-gray-300'
                  }`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
            {role === r.value && (
              <div className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                r.value === 'tenant' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
              }`}>
                ✓ Selected
              </div>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={() => onNext({ role })}
        className="btn-primary w-full py-3 text-base font-semibold"
      >
        Continue →
      </button>
    </div>
  );
}

// ─── Step 2: Profile & Preferences ───────────────────────────────────────────
function StepProfile({ onNext, onBack, data }: StepProps) {
  const [bio, setBio] = useState(data.bio);
  const [selected, setSelected] = useState<string[]>(data.preferences);

  const tags = data.role === 'tenant' ? TENANT_PREFS : LANDLORD_PREFS;
  const label = data.role === 'tenant' ? 'What matters most to you?' : 'What describes your property?';
  const bioPlaceholder = data.role === 'tenant'
    ? 'e.g. Software developer working remotely. Love quiet spaces with great Wi-Fi. Based in Taiwan for 3 months.'
    : 'e.g. I host a studio in Taipei\'s Da\'an district. High-speed fiber Wi-Fi, dedicated work desk, 5 mins from MRT.';

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Tell us about yourself</h2>
      <p className="text-gray-500 text-sm mb-6">Help {data.role === 'tenant' ? 'hosts' : 'nomads'} know who they're connecting with.</p>

      {/* Bio */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Short bio <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder={bioPlaceholder}
          rows={3}
          maxLength={300}
          className="input resize-none w-full text-sm"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{bio.length}/300</p>
      </div>

      {/* Preference tags */}
      <div className="mb-8">
        <p className="text-sm font-semibold text-gray-700 mb-3">
          {label} <span className="text-gray-400 font-normal">(pick all that apply)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <button
              key={tag.id}
              onClick={() => toggle(tag.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                selected.includes(tag.id)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span>{tag.icon}</span>
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary px-5 py-3 font-medium">
          ← Back
        </button>
        <button
          onClick={() => onNext({ bio, preferences: selected })}
          className="btn-primary flex-1 py-3 font-semibold"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: All set! ─────────────────────────────────────────────────────────
function StepDone({ data, onFinish, saving }: { data: FormData; onFinish: () => void; saving: boolean }) {
  const isLandlord = data.role === 'landlord';

  return (
    <div className="text-center">
      {/* Celebration icon */}
      <div className="relative inline-block mb-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-4xl shadow-xl">
          {isLandlord ? '🏠' : '🧳'}
        </div>
        <div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-lg shadow-md">
          🎉
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        You're all set, {data.name}!
      </h2>
      <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">
        {isLandlord
          ? 'Your host profile is ready. List your first property and start connecting with digital nomads.'
          : 'Your nomad profile is ready. Start exploring verified listings across Taiwan.'}
      </p>

      {/* Preferences summary */}
      {data.preferences.length > 0 && (
        <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left max-w-sm mx-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Your preferences
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.preferences.map(id => {
              const tags = data.role === 'tenant' ? TENANT_PREFS : LANDLORD_PREFS;
              const tag = tags.find(t => t.id === id);
              return tag ? (
                <span key={id} className="flex items-center gap-1 px-2.5 py-1 bg-white rounded-full text-xs text-gray-600 border border-gray-200">
                  {tag.icon} {tag.label}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="space-y-3 max-w-sm mx-auto">
        <button
          onClick={onFinish}
          disabled={saving}
          className="btn-primary w-full py-3.5 text-base font-semibold disabled:opacity-60"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Setting up your account…
            </span>
          ) : isLandlord ? (
            '🏠 List my first property →'
          ) : (
            '🔍 Start exploring listings →'
          )}
        </button>

        <Link href="/dashboard" className="block text-sm text-gray-400 hover:text-gray-600 transition-colors py-2 text-center">
          Go to dashboard instead
        </Link>
      </div>

      {/* Email reminder */}
      <div className="mt-8 flex items-start gap-2.5 text-left bg-amber-50 border border-amber-200 rounded-xl p-3 max-w-sm mx-auto">
        <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
        <p className="text-xs text-amber-800">
          <span className="font-semibold">Don't forget:</span> verify your email to unlock all features. Check your inbox for the verification link.
        </p>
      </div>
    </div>
  );
}

// ─── Main Onboarding Page ─────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    role: 'tenant',
    bio: '',
    preferences: [],
    name: '',
  });

  const TOTAL_STEPS = 3;

  // ✅ Load current user — prefill role and check if already onboarded
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.user) {
          router.push('/auth/login?redirect=/onboarding');
          return;
        }
        // Already completed → skip to dashboard
        if (d.user.onboardingCompleted) {
          router.replace('/dashboard');
          return;
        }
        setFormData(prev => ({
          ...prev,
          role: d.user.role === 'landlord' ? 'landlord' : 'tenant',
          bio: d.user.bio || '',
          name: d.user.name || '',
        }));
        setAuthLoading(false);
      });
  }, [router]);

  const updateData = (patch: Partial<FormData>) =>
    setFormData(prev => ({ ...prev, ...patch }));

  const handleNext = (patch?: Partial<FormData>) => {
    if (patch) updateData(patch);
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setStep(s => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Complete onboarding ────────────────────────────────────────────────────
  const handleFinish = async () => {
    setSaving(true);
    try {
      await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: formData.bio,
          preferences: formData.preferences,
          role: formData.role,
        }),
      });
      // Redirect based on role
      if (formData.role === 'landlord') {
        router.push('/submit');
      } else {
        router.push('/listings');
      }
    } catch {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
          <p className="text-sm text-gray-400">Loading your account…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 flex flex-col">
      {/* Top bar */}
      <header className="shrink-0 px-6 py-4 flex items-center justify-between max-w-2xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors">
          <span className="text-2xl">🏡</span>
          <span className="font-bold text-sm hidden sm:block">NomadNest</span>
        </Link>
        <button
          onClick={handleFinish}
          disabled={saving}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Skip for now
        </button>
      </header>

      {/* Card */}
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 pb-12 pt-4">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          <ProgressBar step={step} total={TOTAL_STEPS} />

          {/* Step animations via key-based remount */}
          <div key={step} className="animate-fadeIn">
            {step === 1 && (
              <StepRole onNext={handleNext} data={formData} />
            )}
            {step === 2 && (
              <StepProfile onNext={handleNext} onBack={handleBack} data={formData} />
            )}
            {step === 3 && (
              <StepDone data={formData} onFinish={handleFinish} saving={saving} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
