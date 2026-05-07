import Link from 'next/link';

const profileActions = [
  {
    title: 'Default Comic Style',
    description: 'This style will be pre-selected for all new AI-generated canvases.',
    icon: 'palette',
    options: ['Manga', 'Western', 'Webtoon'],
  },
  {
    title: 'Default Export Format',
    description: 'Optimization level: High. Formats suitable for professional printing.',
    icon: 'download',
    options: ['High-Res PNG', 'PDF', 'CBZ'],
  },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <nav className="glass-nav fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-6 shadow-xl shadow-primary/5">
        <div className="flex items-center gap-2">
          <Link className="text-xl font-bold bg-gradient-to-br from-primary to-primary-container bg-clip-text text-transparent" href="/">
            ComicGen AI
          </Link>
        </div>
        <div className="hidden items-center space-x-6 md:flex">
          <Link className="text-on-surface-variant hover:bg-surface-container-low/60 transition-colors px-3 py-2 rounded-lg" href="/gallery">
            Explore
          </Link>
          <Link className="text-on-surface-variant hover:bg-surface-container-low/60 transition-colors px-3 py-2 rounded-lg" href="/studio">
            Create
          </Link>
          <Link className="text-primary font-semibold px-3 py-2 rounded-lg" href="/settings">
            Creator Hub
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center rounded-full bg-surface-container-low px-4 py-1.5 sm:flex">
            <span className="material-symbols-outlined text-on-surface-variant text-lg mr-2">search</span>
            <input
              className="bg-transparent border-none focus:ring-0 text-sm w-40"
              placeholder="Search projects..."
              type="text"
            />
          </div>
          <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low/60 p-2 rounded-full transition-colors">
            notifications
          </button>
          <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low/60 p-2 rounded-full transition-colors">
            settings
          </button>
          <img
            alt="User profile avatar"
            className="w-8 h-8 rounded-full ring-2 ring-primary/10"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC69imlKCWdurtnQi0bFS97BaDgV2Ol_sNj6_i14JrCYnRXSdtvGK7xH1w8HrUDO-vaht6JPGazyNPZY54bLG7Uw687XSQ6qlNiiK-_1fJEuZW8_6XRe3-O_zIxFtLe6JoU9jJUufRCBDADvhGfZ7pO-5W-Fs-KjsXjwnwMawdYC9TIMtMUdzpPFIWkL9_Ok_lnkSPx-0CNOc8eTBjQtleSbPhJMw7d-afMiyLcG3nfRQg42_5cxqBdq1vZN7NAAAmRSfjE_QJtFbI"
          />
        </div>
      </nav>

      <div className="flex pt-16 min-h-screen">
        <aside className="hidden md:flex h-[calc(100vh-64px)] w-64 fixed left-0 top-16 bg-surface-container-low flex-col p-6 space-y-2">
          <div className="mb-8 px-2">
            <h2 className="text-lg font-black">Creator Hub</h2>
            <p className="text-xs text-on-surface-variant font-medium tracking-wide uppercase">Pro Plan</p>
          </div>
          <nav className="flex-1 space-y-1">
            <a className="flex items-center gap-3 px-4 py-3 text-primary bg-surface-container-lowest shadow-sm rounded-lg font-medium text-sm" href="#profile">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                account_circle
              </span>
              Profile
            </a>
            <a className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:translate-x-1 transition-transform duration-200 font-medium text-sm" href="#preferences">
              <span className="material-symbols-outlined">tune</span>
              Preferences
            </a>
            <a className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:translate-x-1 transition-transform duration-200 font-medium text-sm" href="#privacy">
              <span className="material-symbols-outlined">lock</span>
              Privacy
            </a>
            <a className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:translate-x-1 transition-transform duration-200 font-medium text-sm" href="#integrations">
              <span className="material-symbols-outlined">extension</span>
              Integrations
            </a>
          </nav>
          <div className="mt-auto pt-6 border-t border-outline-variant/40 space-y-1">
            <Link
              className="block text-center bg-gradient-to-br from-primary to-primary-container text-white py-3 rounded-xl font-bold text-sm mb-4 shadow-lg shadow-primary/20 scale-95 active:scale-90 duration-200"
              href="/pricing"
            >
              Upgrade to Max
            </Link>
            <Link className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-on-surface text-sm font-medium" href="/support">
              <span className="material-symbols-outlined text-base">help</span>
              Help Center
            </Link>
            <Link className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-on-surface text-sm font-medium" href="/login">
              <span className="material-symbols-outlined text-base">logout</span>
              Sign Out
            </Link>
          </div>
        </aside>

        <main className="flex-1 md:ml-64 p-8 md:p-12 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-12">
            <section id="profile">
              <header className="mb-8">
                <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">My Profile</h1>
                <p className="text-on-surface-variant">Manage your identity and connected accounts.</p>
              </header>
              <div className="bg-surface-container-lowest p-8 rounded-xl shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <img
                      alt="Alex Rivera avatar"
                      className="w-24 h-24 rounded-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuD04NRC4Lpl-s5_UdngB3Jw_sXA2ggTZ6E3c6S8GolXUGnB5LEbr1QtBXJK9iLV7zCm_8NPX2TBpIJgB2ZBdbA0zDMUuKS_0iTSo3sN5wmvjalc_WhOeN8x-ADVWSbZWKGgZgImfhVu5fI6rfRzpU8N8lclo5ArJlWlm8tNfpsAPE17U-s2tM3UZs6SkNuL6s4eyQFidmqh1_GGDtrjvmJexx5gHzAkQE_6sWslr-fnW5vmOgdBFJXWdn1Zs3Hqog83FWATYq8Re-A"
                    />
                    <button className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full shadow-lg border-4 border-white">
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-on-surface">Alex Rivera</h3>
                    <p className="text-on-surface-variant font-medium">alex@studio.ai</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container-low text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                      Verified Creator
                    </div>
                  </div>
                </div>
                <div>
                  <button className="bg-surface-container-high text-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-surface-container-highest transition-colors">
                    <span className="material-symbols-outlined">link</span>
                    Connect GitHub/Google Account
                  </button>
                </div>
              </div>
            </section>

            <section id="preferences">
              <header className="mb-8">
                <h2 className="text-2xl font-extrabold tracking-tight text-on-surface">App Preferences</h2>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {profileActions.map((action) => (
                  <div key={action.title} className="bg-surface-container-low p-6 rounded-xl border-l-4 border-primary">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="material-symbols-outlined text-primary">{action.icon}</span>
                      <label className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                        {action.title}
                      </label>
                    </div>
                    <select className="w-full bg-surface-container-lowest border-none rounded-lg p-3 text-on-surface font-medium shadow-sm focus:ring-2 focus:ring-primary/20">
                      {action.options.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                    <p className="mt-3 text-xs text-on-surface-variant leading-relaxed">{action.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="integrations" className="bg-gradient-to-r from-primary/5 to-transparent p-8 rounded-2xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">api</span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold">Advanced API Integration</h4>
                    <p className="text-sm text-on-surface-variant">Generate comics programmatically with our developer sandbox.</p>
                  </div>
                </div>
                <button className="text-primary font-bold text-sm hover:underline">Manage Keys</button>
              </div>
            </section>

            <section id="privacy" className="mt-16">
              <div className="border-4 border-red-200/60 rounded-2xl p-8 bg-red-50/50">
                <header className="flex items-center gap-4 mb-6">
                  <span className="material-symbols-outlined text-red-600 text-3xl">warning</span>
                  <h2 className="text-2xl font-black text-red-600">Data &amp; Privacy (Danger Zone)</h2>
                </header>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex-1">
                    <p className="text-on-surface font-semibold mb-2">Manage your archival data</p>
                    <p className="text-sm text-on-surface-variant max-w-lg">
                      In compliance with GDPR, deleting your account will permanently erase all generated images and scripts. This action cannot be undone.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <button className="bg-surface-container-lowest text-on-surface border border-outline-variant px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white transition-colors">
                      <span className="material-symbols-outlined">archive</span>
                      Export All My Data (JSON/ZIP)
                    </button>
                    <button className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-600/90 transition-shadow shadow-lg shadow-red-200">
                      <span className="material-symbols-outlined">delete_forever</span>
                      Delete Account &amp; Data
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

