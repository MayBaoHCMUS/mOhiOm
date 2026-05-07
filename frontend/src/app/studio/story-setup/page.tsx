import Link from 'next/link';

const bottomSteps = [
  { label: 'Story', icon: 'menu_book', active: true, href: '/studio/story-setup' },
  { label: 'Analysis', icon: 'query_stats', active: false, href: '/studio/character-setup' },
  { label: 'Canvas', icon: 'auto_awesome', active: false, href: '/studio/editor' },
  { label: 'Export', icon: 'ios_share', active: false, href: '/studio/export' },
];

export default function StorySetupPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <nav className="fixed top-0 w-full z-50 glass-nav flex justify-between items-center px-8 h-16 shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-8">
          <Link className="text-xl font-bold tracking-tighter" href="/studio/dashboard">
            Comic Studio
          </Link>
          <div className="hidden md:flex gap-6">
            <Link className="text-on-surface-variant font-medium hover:text-primary transition-colors duration-200" href="/studio/dashboard">
              Projects
            </Link>
            <Link className="text-on-surface-variant font-medium hover:text-primary transition-colors duration-200" href="/studio/character-manager">
              Assets
            </Link>
            <Link className="text-on-surface-variant font-medium hover:text-primary transition-colors duration-200" href="/gallery">
              Library
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">help</span>
          </button>
          <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/30">
            <img
              alt="User profile"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAWuthRimIiXYco1bVBcFsKkJcJa_Via21LqrvR3ggXeOum7tXZLFhwMmEF21finQPdBHCVkSwpzFFVHbWoTmiEDNyADJnhmtnsSe1Ildo-teqvtxvXFV97OYozA1nyhvpZnWI7N9ePdMUJTD7VF8T3Em34GP-7K5q-hGhyRW-j5XrS-M27aUNq3Tq9E0NRXCR7k8ybJrNwJS61BCV-qGjm_bXdys-Wj_lnhgLBI9n2OkZQZrPEyZoLgNwaR0lP-G0KW-rKAPxm0bw"
            />
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-2">Create Your Story</h1>
          <p className="text-on-surface-variant leading-relaxed max-w-2xl">
            Define your narrative and let Gemini analyze the visual beats. High-end AI-driven panel generation starts with your script.
          </p>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <section className="lg:col-span-7">
            <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0_20px_50px_rgba(0,88,190,0.05)] border border-outline-variant/10">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-primary text-3xl">edit_note</span>
                <h2 className="text-2xl font-bold tracking-tight">Narrative Input</h2>
              </div>
              <div className="space-y-6">
                <textarea
                  className="w-full h-80 bg-surface-container-low border-none rounded-xl p-6 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all duration-300 resize-none leading-relaxed"
                  placeholder="Paste your narrative text or script here (Up to 5000 words)"
                ></textarea>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block uppercase tracking-widest text-on-surface-variant text-xs font-bold px-1">Comic Style</label>
                    <div className="relative">
                      <select className="w-full appearance-none bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer">
                        <option value="manga">Manga</option>
                        <option value="western">Western Superhero</option>
                        <option value="noir">Noir Graphic Novel</option>
                        <option value="indie">Hand-drawn Indie</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                        expand_more
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block uppercase tracking-widest text-on-surface-variant text-xs font-bold px-1">Target Pages</label>
                    <div className="relative">
                      <select className="w-full appearance-none bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer">
                        <option value="1">1 Page (Short Action)</option>
                        <option value="3">3 Pages (Mini Chapter)</option>
                        <option value="5">5 Pages (Standard Scene)</option>
                        <option value="12">12+ Pages (Issue)</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                        expand_more
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <aside className="lg:col-span-5 sticky top-24">
            <div className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/10 min-h-[400px] flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight">AI Story Analysis</h2>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-surface-container-high text-primary rounded-full uppercase tracking-wider">
                  Live
                </span>
              </div>
              <div className="space-y-8 flex-grow">
                <p className="text-on-surface-variant font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  Gemini is analyzing scenes and extracting characters... (&lt; 10s)
                </p>
                <div className="space-y-6">
                  <div className="flex flex-col gap-4">
                    <div className="h-4 bg-surface-container-high rounded-full w-3/4 animate-pulse"></div>
                    <div className="h-4 bg-surface-container-high rounded-full w-1/2 animate-pulse"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="aspect-square bg-surface-container-high rounded-xl animate-pulse flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant/60 text-4xl">person</span>
                    </div>
                    <div className="aspect-square bg-surface-container-high rounded-xl animate-pulse flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant/60 text-4xl">landscape</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 bg-surface-container-high rounded-full w-full animate-pulse"></div>
                    <div className="h-3 bg-surface-container-high rounded-full w-5/6 animate-pulse"></div>
                    <div className="h-3 bg-surface-container-high rounded-full w-4/6 animate-pulse"></div>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-outline-variant/10 text-center">
                <p className="text-xs text-on-surface-variant italic">Refining story beats for optimal visual continuity...</p>
              </div>
            </div>
            <div className="mt-6 p-6 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-lg shadow-primary/20">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-3xl">lightbulb</span>
                <div>
                  <h4 className="font-bold mb-1">Pro Tip</h4>
                  <p className="text-sm opacity-90 leading-relaxed">
                    Describe characters clearly in your text for better AI character sheet generation in the next step.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 w-full flex justify-around items-center px-8 py-4 bg-white border-t border-outline-variant/30 z-50 shadow-[0_-4px_20px_0_rgba(0,0,0,0.05)]">
        <div className="hidden md:flex gap-12">
          {bottomSteps.map((step) => (
            <Link
              key={step.label}
              className={`flex flex-col items-center justify-center px-6 py-2 rounded-xl transition-all ${
                step.active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
              href={step.href}
            >
              <span className="material-symbols-outlined" style={step.active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {step.icon}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest mt-1">{step.label}</span>
            </Link>
          ))}
        </div>
        <div className="flex-grow md:flex-grow-0 md:ml-auto">
          <button className="w-full md:w-auto px-8 py-4 bg-surface-container-high text-on-surface-variant font-bold rounded-xl flex items-center justify-center gap-3 cursor-not-allowed opacity-60" disabled>
            Next: Character Setup
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
}

