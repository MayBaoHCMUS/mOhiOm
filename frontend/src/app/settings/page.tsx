'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { useAuth } from '@/context/AuthContext';

// ─── Comic-style panel card ────────────────────────────────────────────────────

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container-lowest rounded-2xl border-2 border-on-surface/8 shadow-[4px_4px_0px_0px_rgba(0,88,190,0.10)] ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
      <h2 className="text-xs font-black tracking-[0.15em] text-on-surface-variant uppercase">{children}</h2>
    </div>
  );
}

// ─── Avatar with initials fallback ────────────────────────────────────────────

function Avatar({ name, size = 'lg' }: { name: string; size?: 'lg' | 'sm' }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const dim = size === 'lg' ? 'w-24 h-24 text-2xl' : 'w-10 h-10 text-sm';

  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center font-black text-white flex-shrink-0`}>
      {initials || '?'}
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-3 bg-surface-container rounded-xl">
      <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
      <span className="text-lg font-black text-on-surface">{value}</span>
      <span className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">{label}</span>
    </div>
  );
}

// ─── Provider badge ───────────────────────────────────────────────────────────

function ProviderBadge({ provider }: { provider: string }) {
  const map: Record<string, { icon: string; label: string; color: string }> = {
    google:   { icon: 'mail',   label: 'Google',   color: 'bg-red-50 text-red-600 border-red-100' },
    github:   { icon: 'code',   label: 'GitHub',   color: 'bg-gray-50 text-gray-700 border-gray-200' },
    password: { icon: 'lock',   label: 'Password', color: 'bg-blue-50 text-blue-600 border-blue-100' },
  };
  const cfg = map[provider] ?? { icon: 'link', label: provider, color: 'bg-surface-container text-on-surface-variant border-outline-variant' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${cfg.color}`}>
      <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, isLoading, refresh, logout } = useAuth();
  const router = useRouter();

  const [comicStyle, setComicStyle] = useState('Manga');
  const [exportFormat, setExportFormat] = useState('High-Res PNG');
  const [showDanger, setShowDanger] = useState(false);

  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Creator';
  const providers = user?.providers ?? [];

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />

      <main className="ml-[var(--studio-sidebar-width)] pt-28 pb-20 px-8">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* ── Page header ── */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-primary uppercase mb-1">Creator Hub</p>
              <h1 className="text-4xl font-black tracking-tight text-on-surface">My Profile</h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-all"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              Sign out
            </button>
          </div>

          {/* ── Identity card ── */}
          <Panel>
            {/* Comic-dot header strip */}
            <div className="h-20 rounded-t-2xl bg-gradient-to-r from-primary to-primary-container relative overflow-hidden">
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '16px 16px' }} />
              <div className="absolute inset-0 flex items-center px-8">
                <span className="text-white/30 text-6xl font-black tracking-tighter select-none">CREATOR</span>
              </div>
            </div>

            <div className="px-8 pb-8">
              {/* Avatar row — overlapping the header */}
              <div className="flex items-end justify-between -mt-10 mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-surface-container-lowest overflow-hidden bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
                    {isLoading ? (
                      <div className="w-full h-full animate-pulse bg-surface-container-high" />
                    ) : (
                      <span className="text-xl font-black text-white">
                        {fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?'}
                      </span>
                    )}
                  </div>
                </div>
                {/* Stats */}
                <div className="flex gap-3">
                  <StatChip icon="auto_stories" label="Projects" value="—" />
                  <StatChip icon="face_6" label="Characters" value="—" />
                  <StatChip icon="photo_library" label="Panels" value="—" />
                </div>
              </div>

              {/* Name & email */}
              {isLoading ? (
                <div className="space-y-2 mb-4">
                  <div className="h-7 w-48 bg-surface-container-high rounded-lg animate-pulse" />
                  <div className="h-4 w-36 bg-surface-container-high rounded-lg animate-pulse" />
                </div>
              ) : (
                <div className="mb-4">
                  <h2 className="text-2xl font-black text-on-surface">{fullName}</h2>
                  <p className="text-sm text-on-surface-variant mt-0.5">{user?.email ?? '—'}</p>
                </div>
              )}

              {/* Connected providers */}
              <div className="flex flex-wrap gap-2">
                {providers.length > 0
                  ? providers.map((p) => <ProviderBadge key={p} provider={p} />)
                  : <span className="text-xs text-outline">No connected providers</span>
                }
              </div>
            </div>
          </Panel>

          {/* ── Preferences ── */}
          <Panel className="p-7">
            <SectionLabel icon="tune">App Preferences</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wider">Default Comic Style</label>
                <select value={comicStyle} onChange={(e) => setComicStyle(e.target.value)} className="field">
                  {['Manga', 'Western', 'Webtoon', 'Graphic Novel', 'Chibi'].map((o) => <option key={o}>{o}</option>)}
                </select>
                <p className="mt-2 text-[11px] text-outline">Pre-selected for all new AI-generated canvases.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wider">Default Export Format</label>
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="field">
                  {['High-Res PNG', 'PDF', 'CBZ'].map((o) => <option key={o}>{o}</option>)}
                </select>
                <p className="mt-2 text-[11px] text-outline">Format used when exporting completed comics.</p>
              </div>
            </div>
          </Panel>

          {/* ── Account ── */}
          <Panel className="p-7">
            <SectionLabel icon="manage_accounts">Account</SectionLabel>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-outline-variant/30">
                <div>
                  <p className="text-sm font-bold text-on-surface">Email address</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{isLoading ? '…' : user?.email ?? '—'}</p>
                </div>
                <button className="text-xs font-bold text-primary hover:underline">Change</button>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-outline-variant/30">
                <div>
                  <p className="text-sm font-bold text-on-surface">Password</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Last changed: unknown</p>
                </div>
                <button className="text-xs font-bold text-primary hover:underline">Update</button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-bold text-on-surface">Connected accounts</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Link GitHub or Google for faster login.</p>
                </div>
                <button className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                  <span className="material-symbols-outlined text-sm">link</span>
                  Connect
                </button>
              </div>
            </div>
          </Panel>

          {/* ── API Integration ── */}
          <Panel className="p-7">
            <SectionLabel icon="api">Developer</SectionLabel>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-on-surface">API Keys</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Generate comics programmatically via the sandbox.</p>
              </div>
              <button className="px-4 py-2 rounded-xl text-sm font-bold bg-surface-container text-primary hover:bg-surface-container-high transition-colors">
                Manage Keys
              </button>
            </div>
          </Panel>

          {/* ── Danger zone ── */}
          <div>
            <button
              onClick={() => setShowDanger((v) => !v)}
              className="flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-red-600 transition-colors mb-3"
            >
              <span className="material-symbols-outlined text-base">expand_more</span>
              Danger Zone
            </button>

            {showDanger && (
              <div className="rounded-2xl border-2 border-red-200 bg-red-50/60 p-7">
                <div className="flex items-center gap-3 mb-5">
                  <span className="material-symbols-outlined text-red-600">warning</span>
                  <h3 className="text-base font-black text-red-700">Data &amp; Privacy</h3>
                </div>
                <p className="text-sm text-on-surface-variant mb-6 max-w-lg">
                  In compliance with GDPR, deleting your account permanently erases all generated images and scripts. This cannot be undone.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border border-outline-variant bg-white text-on-surface hover:bg-surface-container transition-colors">
                    <span className="material-symbols-outlined text-base">archive</span>
                    Export All My Data
                  </button>
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm">
                    <span className="material-symbols-outlined text-base">delete_forever</span>
                    Delete Account
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}