import Link from 'next/link';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';

const castMembers = [
  { name: 'The Hero', detail: 'Emma - 25yr Detective', icon: 'person', active: true },
  { name: 'Antagonist', detail: 'Minh - Cyborg companion', icon: 'psychology', active: false },
  { name: 'Sidekick', detail: 'Kael - Rogue pilot', icon: 'group', active: false },
  { name: 'Mentor', detail: '', icon: 'face_6', active: false },
  { name: 'Villain', detail: '', icon: 'skull', active: false },
];

const variations = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCldXfcldU--L84uOB8AGgsX5BdPjtzypvf4pundkvZ5mYcf-J__I85VeiKDTuxRsmVlbaxG8LT_twooqpooyLxx-zc1pynDhWN60tvmj2Y3zFLRlp2uQXDXW7ILmkeR-bTEC8g7bUAQok8aYm_YpluhDMf1AWF1mAiFaRA8X7T5p1pRgyReRxV4FmnmcU40dUeKobzOXUywmXQtrGeyBHlVg67_MHrlT0O-Uql3_0hEcLA7bwEZNhmm9yMEWQHp2eOKn2jhYOQg9I',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC0X1QtQWcSJtGXLILUVFcPDhi0XyEKfcLQ2q0wXgIATl-CezvVXcQecsqJ5mVzEJTWW7sQY1o3UWtCWg6mC0CPgNpAZZvG1Ms0F8sO9dmOG19MaHGeC3uGDlxg_6u3UqBy8BWwC2r36zZJ106c3nTqypGs2A4ekm1wL9x0-KjlbIko3icBzhxL5Jpop_mWfD-DV9l0n5sZSrOFdAoy17Avqk5LUJ7tYL36JfEcDyQoRJsJ85eyGZ7nwCthDGW4NFFcthHba9OANKA',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDsyNsxJnGez0ABOHOUeJuf_OFra9GB1rmCQOnEGhVO4Fw-SkI1XI1eeIQYXCEFijaYIok1UZcmrkhCssf8opaPKh0CrK11gK9hUz6dnRjSjNI35j3g-h62lqWbbdkbyilkrFOpo3L8m9ZJzAP2lCIwDZ-LWdzmrVR-65Xv-c2PSx24kyh1fOcJxo-e-71R2N4BvJ4WkDuboTbsHt0G4jrVBauWBQsaaAm2RBdMIQiT028S_tjNQmllTpsTZlYc8o39M9WlRVMWvLs',
];

export default function CharacterSetupPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <StudioSidebar />
      <StudioTopBar />

      <div className="flex pt-16 flex-1 overflow-hidden ml-[var(--studio-sidebar-width)]">
        <aside className="h-[calc(100vh-64px)] w-64 border-r border-outline-variant/30 bg-surface-container-low flex flex-col py-6 sticky top-16 overflow-y-auto">
          <div className="px-6 mb-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-sm">auto_stories</span>
              </div>
              <div>
                <h3 className="font-bold text-on-surface text-sm leading-tight">Project: Cyber City</h3>
                <p className="text-xs text-on-surface-variant">5 Characters Found</p>
              </div>
            </div>
          </div>
          <nav className="space-y-1 flex-1 px-4">
            <div className="px-2 mb-2 text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">Extracted Cast</div>
            {castMembers.map((member) => (
              <Link
                key={member.name}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                  member.active
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:translate-x-1'
                }`}
                href="/studio/character-setup"
              >
                <span className="material-symbols-outlined text-[20px]">{member.icon}</span>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">{member.name}</span>
                  {member.detail && <span className="text-[10px] text-on-surface-variant">{member.detail}</span>}
                </div>
              </Link>
            ))}
          </nav>
          <div className="px-4 mt-auto pt-6">
            <button className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-sm font-semibold transition-all">
              <span className="material-symbols-outlined text-sm">add</span>
              Extract New Character
            </button>
          </div>
        </aside>

        <main className="flex-1 p-8 pb-32 bg-surface">
          <div className="max-w-5xl mx-auto space-y-12">
            <header>
              <div className="flex items-end justify-between mb-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Emma - Character Tuning</h1>
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                  Draft Phase
                </span>
              </div>
              <p className="text-on-surface-variant max-w-2xl text-lg leading-relaxed">
                Refine the visual identity for Emma. These variations will serve as the grounding reference for all comic panels to ensure cinematic consistency.
              </p>
            </header>

            <section className="bg-surface-container-lowest rounded-2xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-outline-variant/10">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">smart_toy</span>
                <label className="text-sm font-bold tracking-wider text-on-surface-variant uppercase">AI Prompt Editor</label>
              </div>
              <div className="relative group">
                <textarea
                  className="w-full min-h-[160px] p-6 bg-surface-container-low border-none rounded-xl text-on-surface focus:ring-0 focus:bg-white transition-all text-lg leading-relaxed resize-none"
                  placeholder="Describe Emma's visual traits, clothing, and the specific comic art style..."
                  defaultValue="Young woman, 25 years old, sharp detective features, messy dark bob haircut, wearing a tan futuristic trench coat over a neon-accented tactical suit, glowing blue eyes, gritty cyberpunk noir style, detailed digital painting, high contrast lighting, cinematic atmosphere."
                ></textarea>
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button className="px-4 py-2 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-outline-variant/30 text-sm font-semibold text-on-surface-variant hover:bg-white transition-colors">
                    Use Suggestion
                  </button>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-on-surface">Character Variations</h2>
                  <p className="text-sm text-on-surface-variant">Select a variation to lock in the character ID.</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 bg-surface-container-high rounded-lg text-primary transition-all active:scale-95">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      grid_view
                    </span>
                  </button>
                  <button className="p-2 hover:bg-surface-container-low rounded-lg text-on-surface-variant transition-all">
                    <span className="material-symbols-outlined">view_list</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {variations.map((variation) => (
                  <div key={variation} className="group bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1 border border-outline-variant/5">
                    <div className="aspect-[3/4] relative overflow-hidden">
                      <img alt="Character variation" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src={variation} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                    <div className="p-5 space-y-3">
                      <button className="w-full py-3 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 hover:opacity-95 active:scale-95 transition-all">
                        Set as Reference ID
                      </button>
                      <button className="w-full py-3 bg-surface-container-high text-primary rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors">
                        <span className="material-symbols-outlined text-sm">casino</span>
                        Regenerate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>

      <footer className="fixed bottom-0 left-[var(--studio-sidebar-width)] right-0 z-50 flex justify-end px-8 py-4 bg-white/90 backdrop-blur-lg shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border-t border-outline-variant/20">
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Next Step</span>
            <span className="text-sm font-semibold text-on-surface">Generate Panels &amp; Backgrounds</span>
          </div>
          <Link className="bg-gradient-to-br from-primary to-primary-container text-white rounded-xl py-4 px-12 flex items-center justify-center gap-2 font-bold hover:opacity-90 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.97] transition-all duration-300" href="/studio/editor">
            Generate Comic Pages
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
