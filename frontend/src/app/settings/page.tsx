'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { useAuth } from '@/context/AuthContext';
import { authApi, projectsApi, settingsApi, toApiError } from '@/services/api';
import type { TextGenMode, SaveTextGenConfigPayload, TextGenProvider } from '@/services/api';
import { getImageApiUrl, setImageApiUrl } from '@/lib/imageApiUrl';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';

// ─── Panel card ───────────────────────────────────────────────────────────────

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

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ icon, label, value, loading }: { icon: string; label: string; value: number | null; loading: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-3 bg-surface-container rounded-xl min-w-[80px]">
      <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
      {loading ? (
        <div className="h-6 w-8 bg-surface-container-high rounded animate-pulse" />
      ) : (
        <span className="text-lg font-black text-on-surface">{value ?? '—'}</span>
      )}
      <span className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">{label}</span>
    </div>
  );
}

// ─── Provider badge ───────────────────────────────────────────────────────────

function ProviderBadge({ provider }: { provider: string }) {
  const map: Record<string, { icon: string; label: string; color: string }> = {
    google: { icon: 'mail',   label: 'Google',   color: 'bg-red-50 text-red-600 border-red-100' },
    github: { icon: 'code',   label: 'GitHub',   color: 'bg-gray-50 text-gray-700 border-gray-200' },
    manual: { icon: 'lock',   label: 'Password', color: 'bg-blue-50 text-blue-600 border-blue-100' },
  };
  const cfg = map[provider] ?? { icon: 'link', label: provider, color: 'bg-surface-container text-on-surface-variant border-outline-variant' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${cfg.color}`}>
      <span className="material-symbols-outlined text-sm">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ─── Inline field ─────────────────────────────────────────────────────────────

function Field({ label, type = 'text', value, onChange, placeholder }: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field w-full"
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, isLoading, refresh, logout } = useAuth();
  const router = useRouter();

  // Preferences state — initialised from localStorage
  const [comicStyle, setComicStyle] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('mohiom-pref-comic-style') ?? 'Manga') : 'Manga'
  );
  const [exportFormat, setExportFormat] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('mohiom-pref-export-format') ?? 'High-Res PNG') : 'High-Res PNG'
  );
  const [showDanger, setShowDanger] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);

  // Stats
  const [stats, setStats] = useState<{ project_count: number; character_count: number; panel_count: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Change password
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Connect notice (set after OAuth redirect back)
  const [connectNotice, setConnectNotice] = useState('');
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  // Text generation (BYOK / model selection)
  const [textGenMode, setTextGenMode] = useState<TextGenMode>('nine_router');
  const [byokProvider, setByokProvider] = useState('');
  const [byokProviders, setByokProviders] = useState<TextGenProvider[]>([]);
  const [byokApiKey, setByokApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [nineRouterModel, setNineRouterModel] = useState('');
  const [nineRouterModels, setNineRouterModels] = useState<string[]>([]);
  const [localServerApiUrl, setLocalServerApiUrl] = useState('');
  const [localServerModel, setLocalServerModel] = useState('');
  const [textGenLoading, setTextGenLoading] = useState(true);
  const [textGenSaving, setTextGenSaving] = useState(false);
  const [textGenMsg, setTextGenMsg] = useState('');
  const [textGenError, setTextGenError] = useState('');

  // Image generation server URL
  const [imageApiUrlValue, setImageApiUrlValue] = useState('');
  const [imageApiUrlSaved, setImageApiUrlSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    settingsApi.getNineRouterModels()
      .then((r) => {
        if (cancelled) return;
        setNineRouterModels(r.data.models);
        setNineRouterModel((prev) => prev || r.data.models[0] || '');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    settingsApi.getTextGenProviders()
      .then((r) => {
        if (cancelled) return;
        setByokProviders(r.data.providers);
        setByokProvider((prev) => prev || r.data.providers[0]?.id || '');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setImageApiUrlValue(getImageApiUrl());
  }, []);

  useEffect(() => {
    void refresh();
    projectsApi.stats()
      .then((r) => setStats(r.data))
      .catch(() => setStats({ project_count: 0, character_count: 0, panel_count: 0 }))
      .finally(() => setStatsLoading(false));

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const connected = params.get('connected');
      const error = params.get('error');
      if (connected) {
        setConnectNotice(`Connected ${connected.charAt(0).toUpperCase() + connected.slice(1)} successfully!`);
        window.history.replaceState({}, '', '/settings');
        void refresh();
      } else if (error === 'connect_failed') {
        setConnectNotice('Failed to connect account. Please try again.');
        window.history.replaceState({}, '', '/settings');
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) { setTextGenLoading(false); return; }
    settingsApi.getTextGenConfig()
      .then((r) => {
        const cfg = r.data;
        setTextGenMode(cfg.mode);
        setHasApiKey(cfg.has_api_key);
        if (cfg.mode === 'byok') {
          setByokProvider((prev) => cfg.provider || prev);
        } else if (cfg.mode === 'nine_router') {
          setNineRouterModel(cfg.model);
        } else if (cfg.mode === 'local_server') {
          setLocalServerApiUrl(cfg.api_url);
          setLocalServerModel(cfg.model);
        }
      })
      .catch(() => {})
      .finally(() => setTextGenLoading(false));
  }, [user]);

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Creator';
  const providers = user?.providers ?? [];
  const hasPassword = providers.includes('manual');
  const hasGoogle = providers.includes('google');
  const hasGithub = providers.includes('github');

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleChangePw = async () => {
    setPwError('');
    setPwSuccess('');
    if (!currentPw) { setPwError('Enter your current password'); return; }
    if (newPw !== confirmPw) { setPwError('New passwords do not match'); return; }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    setPwLoading(true);
    try {
      await authApi.changePassword({ current_password: currentPw, new_password: newPw });
      setPwSuccess('Password updated successfully!');
      setShowChangePw(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwError(toApiError(err).message);
    } finally {
      setPwLoading(false);
    }
  };

  const savePrefs = (style: string, format: string) => {
    localStorage.setItem('mohiom-pref-comic-style', style);
    localStorage.setItem('mohiom-pref-export-format', format);
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2000);
  };

  const handleConnect = async (provider: 'google' | 'github') => {
    setConnectingProvider(provider);
    try {
      const resp = await authApi.oauthStart(provider, 'connect');
      window.location.href = resp.data.url;
    } catch (err) {
      setConnectNotice(`Could not start ${provider} connection: ${toApiError(err).message}`);
      setConnectingProvider(null);
    }
  };

  const handleSaveTextGenConfig = async () => {
    setTextGenError('');
    setTextGenMsg('');
    setTextGenSaving(true);
    try {
      const payload: SaveTextGenConfigPayload =
        textGenMode === 'byok'
          ? { mode: 'byok', provider: byokProvider, api_key: byokApiKey }
          : textGenMode === 'nine_router'
          ? { mode: 'nine_router', model: nineRouterModel }
          : { mode: 'local_server', api_url: localServerApiUrl, model: localServerModel };
      const res = await settingsApi.saveTextGenConfig(payload);
      setHasApiKey(res.data.has_api_key);
      setByokApiKey('');
      setTextGenMsg('Saved!');
      setTimeout(() => setTextGenMsg(''), 2000);
    } catch (err) {
      setTextGenError(toApiError(err).message);
    } finally {
      setTextGenSaving(false);
    }
  };

  const handleClearTextGenConfig = async () => {
    setTextGenError('');
    setTextGenSaving(true);
    try {
      await settingsApi.clearTextGenConfig();
      setTextGenMode('nine_router');
      setByokProvider(byokProviders[0]?.id || ''); setByokApiKey('');
      setNineRouterModel(nineRouterModels[0] || '');
      setHasApiKey(false);
      setLocalServerApiUrl(''); setLocalServerModel('');
      setTextGenMsg('Reset to default.');
      setTimeout(() => setTextGenMsg(''), 2000);
    } catch (err) {
      setTextGenError(toApiError(err).message);
    } finally {
      setTextGenSaving(false);
    }
  };

  const handleImageApiUrlChange = (val: string) => {
    setImageApiUrlValue(val);
    setImageApiUrl(val);
    setImageApiUrlSaved(true);
    setTimeout(() => setImageApiUrlSaved(false), 1500);
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

          {/* ── Connect notice toast ── */}
          {connectNotice && (
            <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-bold border ${
              connectNotice.includes('success') || connectNotice.includes('Connected')
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              <span className="material-symbols-outlined text-base">
                {connectNotice.includes('success') || connectNotice.includes('Connected') ? 'check_circle' : 'error'}
              </span>
              {connectNotice}
              <button onClick={() => setConnectNotice('')} className="ml-auto opacity-60 hover:opacity-100">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* ── Identity card ── */}
          <Panel>
            <div className="h-20 rounded-t-2xl bg-gradient-to-r from-primary to-primary-container relative overflow-hidden">
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '16px 16px' }} />
              <div className="absolute inset-0 flex items-center px-8">
                <span className="text-white/30 text-6xl font-black tracking-tighter select-none">CREATOR</span>
              </div>
            </div>

            <div className="px-8 pb-8">
              <div className="flex items-end justify-between -mt-10 mb-6">
                <div className="w-20 h-20 rounded-full border-4 border-surface-container-lowest overflow-hidden bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
                  {isLoading ? (
                    <div className="w-full h-full animate-pulse bg-surface-container-high" />
                  ) : (
                    <span className="text-xl font-black text-white">
                      {fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?'}
                    </span>
                  )}
                </div>
                {/* Live stats */}
                <div className="flex gap-3">
                  <StatChip icon="auto_stories" label="Projects"   value={stats?.project_count   ?? null} loading={statsLoading} />
                  <StatChip icon="face_6"        label="Characters" value={stats?.character_count ?? null} loading={statsLoading} />
                  <StatChip icon="photo_library" label="Panels"    value={stats?.panel_count     ?? null} loading={statsLoading} />
                </div>
              </div>

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
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">tune</span>
                <h2 className="text-xs font-black tracking-[0.15em] text-on-surface-variant uppercase">App Preferences</h2>
              </div>
              {prefSaved && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 animate-pulse">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Saved
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wider">Default Comic Style</label>
                <select
                  value={comicStyle}
                  onChange={(e) => { setComicStyle(e.target.value); savePrefs(e.target.value, exportFormat); }}
                  className="field"
                >
                  {['Manga', 'Western', 'Webtoon', 'Graphic Novel', 'Chibi'].map((o) => <option key={o}>{o}</option>)}
                </select>
                <p className="mt-2 text-[11px] text-outline">Pre-selected for all new AI-generated canvases.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-wider">Default Export Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => { setExportFormat(e.target.value); savePrefs(comicStyle, e.target.value); }}
                  className="field"
                >
                  {['High-Res PNG', 'PDF', 'CBZ'].map((o) => <option key={o}>{o}</option>)}
                </select>
                <p className="mt-2 text-[11px] text-outline">Format used when exporting completed comics.</p>
              </div>
            </div>
          </Panel>

          {/* ── Account ── */}
          <Panel className="p-7">
            <SectionLabel icon="manage_accounts">Account</SectionLabel>
            <div className="space-y-1">

              {/* Change password row */}
              <div className="py-3 border-b border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-on-surface">Password</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {hasPassword ? 'Update your login password.' : 'No password set — sign in via OAuth only.'}
                    </p>
                  </div>
                  {hasPassword && (
                    <button
                      onClick={() => { setShowChangePw((v) => !v); setPwError(''); setPwSuccess(''); }}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {showChangePw ? 'Cancel' : 'Update'}
                    </button>
                  )}
                </div>

                {/* Inline change-password form */}
                {showChangePw && (
                  <div className="mt-4 p-4 bg-surface-container rounded-xl space-y-3">
                    <Field label="Current password" type="password" value={currentPw} onChange={setCurrentPw} placeholder="••••••••" />
                    <div>
                      <Field label="New password" type="password" value={newPw} onChange={setNewPw} placeholder="Min 8 characters" />
                      <div className="mt-2"><PasswordStrengthMeter password={newPw} /></div>
                    </div>
                    <Field label="Confirm new password" type="password" value={confirmPw} onChange={setConfirmPw} placeholder="••••••••" />
                    {pwError && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">error</span>
                        {pwError}
                      </p>
                    )}
                    {pwSuccess && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        {pwSuccess}
                      </p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleChangePw}
                        disabled={pwLoading}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {pwLoading ? 'Saving…' : 'Save Password'}
                      </button>
                      <button
                        onClick={() => { setShowChangePw(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError(''); }}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Connected accounts row */}
              <div className="pt-3">
                <p className="text-sm font-bold text-on-surface mb-3">Connected accounts</p>
                <div className="space-y-2.5">

                  {/* Google */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-red-500 text-sm">mail</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">Google</p>
                        <p className="text-[11px] text-on-surface-variant">Sign in with your Google account</p>
                      </div>
                    </div>
                    {hasGoogle ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Connected
                      </span>
                    ) : (
                      <button
                        onClick={() => void handleConnect('google')}
                        disabled={connectingProvider === 'google'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-outline-variant text-on-surface hover:bg-surface-container-high disabled:opacity-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">link</span>
                        {connectingProvider === 'google' ? 'Redirecting…' : 'Connect'}
                      </button>
                    )}
                  </div>

                  {/* GitHub */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                        <span className="material-symbols-outlined text-gray-600 text-sm">code</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">GitHub</p>
                        <p className="text-[11px] text-on-surface-variant">Sign in with your GitHub account</p>
                      </div>
                    </div>
                    {hasGithub ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Connected
                      </span>
                    ) : (
                      <button
                        onClick={() => void handleConnect('github')}
                        disabled={connectingProvider === 'github'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-outline-variant text-on-surface hover:bg-surface-container-high disabled:opacity-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">link</span>
                        {connectingProvider === 'github' ? 'Redirecting…' : 'Connect'}
                      </button>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </Panel>

          {/* ── Text Generation ── */}
          <Panel className="p-7">
            <SectionLabel icon="api">Text Generation</SectionLabel>
            {!user ? (
              <p className="text-sm text-on-surface-variant">Sign in to configure your own text-generation provider.</p>
            ) : textGenLoading ? (
              <div className="h-24 bg-surface-container-high rounded-xl animate-pulse" />
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'nine_router', label: "App's built-in models" },
                    { key: 'byok', label: 'Bring your own API key' },
                    { key: 'local_server', label: 'My own local model server' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTextGenMode(opt.key)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                        textGenMode === opt.key
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface-container text-on-surface-variant border-outline-variant/40 hover:bg-surface-container-high'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {textGenMode === 'nine_router' && (
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Model</label>
                    <select
                      value={nineRouterModel || nineRouterModels[0] || ''}
                      onChange={(e) => setNineRouterModel(e.target.value)}
                      className="field w-full"
                    >
                      {nineRouterModels.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <p className="mt-2 text-[11px] text-outline">Uses the app&apos;s own provider — just pick which model to request.</p>
                  </div>
                )}

                {textGenMode === 'byok' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Provider</label>
                      <select
                        value={byokProvider || byokProviders[0]?.id || ''}
                        onChange={(e) => setByokProvider(e.target.value)}
                        className="field w-full"
                      >
                        {byokProviders.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </div>
                    <Field
                      label={hasApiKey ? 'API key (saved — leave blank to keep)' : 'API key'}
                      type="password"
                      value={byokApiKey}
                      onChange={setByokApiKey}
                      placeholder={hasApiKey ? '••••••••' : 'sk-…'}
                    />
                    <p className="text-[11px] text-outline">Paste the API key from your provider&apos;s dashboard — no URL or model needed.</p>
                  </div>
                )}

                {textGenMode === 'local_server' && (
                  <div className="space-y-3">
                    <Field label="API URL" value={localServerApiUrl} onChange={setLocalServerApiUrl} placeholder="https://your-tunnel.trycloudflare.com" />
                    <Field label="Model (optional)" value={localServerModel} onChange={setLocalServerModel} placeholder="llama3, gemma2…" />
                  </div>
                )}

                {textGenError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {textGenError}
                  </p>
                )}
                {textGenMsg && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {textGenMsg}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTextGenConfig}
                    disabled={textGenSaving}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {textGenSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={handleClearTextGenConfig}
                    disabled={textGenSaving}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  >
                    Reset to default
                  </button>
                </div>
              </div>
            )}
          </Panel>

          {/* ── Image Generation ── */}
          <Panel className="p-7">
            <SectionLabel icon="image">Image Generation</SectionLabel>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Image API URL</label>
              <input
                type="url"
                value={imageApiUrlValue}
                onChange={(e) => handleImageApiUrlChange(e.target.value)}
                placeholder="https://xxxx.trycloudflare.com"
                className="field w-full font-mono text-sm"
              />
              <p className="mt-2 text-[11px] text-outline">Your Cloudflare tunnel URL — used for image generation in Step 1 and publishing.</p>
              {imageApiUrlSaved && <p className="mt-1 text-[11px] text-green-600">Saved</p>}
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