import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';

const recentProjects = [
  {
    title: 'Midnight in Neo-Tokyo',
    genre: 'Sci-Fi',
    updated: 'Last edited 2 hours ago',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCFiDmHITo6EL0AeqV43I-2me2mE-E1KO1476RP7tQj49zcgc5_caDWF3su8n9Gy9wTTCBZ_UR-5mCU77kYhfHlncij4xhXcGgN_R6BZm7A3mcEDnFHn2XVBmzUWDgkxO-DkHBPAIRk4rd_jIJce-YKv9_sido7j0DSomvYpT93X22-NgavFe-Td2TsIlhLuPgswxsJN1mr-Qn26909MRB7gDKo4Bt_XpLySsPCl9Q3_UIzK3HBrFtrBI7BwN5jl2PO_NbVxz024Uc',
  },
  {
    title: 'The Silent Woods',
    genre: 'Fantasy',
    updated: 'Last edited 5 hours ago',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBx2a2ZzAyS-1ub5UlJ8h2W194zrPQufQnGXI_VQkjbUiwz6IoJ80XSalnN0CgoISP5oc-TCTrZkXSZBvlB-xuT6ns9ah-gsLxxBv6sKyb1EFm5D0SHm5K7zVOc9gtjGFMUUHprJIs52eV3P-30BGJBhUS3OM6IuY3G1xb2rz0jQkDTiRXmoHR_FTKYd2y7cqVFi2g8JApNFXnnhbtUXy5-waG_iJxcmeQ6dcCd5g7yVycvfKcf_SKbj0qqIO280ob3W_f8We6yI2Y',
  },
  {
    title: 'Case #402: Red Herring',
    genre: 'Noir',
    updated: 'Last edited 1 day ago',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBa7K5Xk8EDGQHeTAYHT7tGdaIQKbH99GIjXSQfSjCpN9Y8SNPyj8aqrt61Dej6PAu9gUOHczGNvh9tTIfhQzn_ZewVShhjmS8T7q6WzPOz6LheIvx5G6oQjLp22JFHVTnFlC4rSIJiFRJt1IR-aVh0oh4TeDriGLp2CxepwD37N3CnKBh_xC9h2dUI71eR8_XQ0Ta5SNFKgdyR1m5kev7SiIh1BD5kOpAOjaF9o6d75dgO1A1KecsTVJHcmrOQOGBvjy5w_Ex87zY',
  },
];

const savedCharacters = [
  {
    name: 'Emma',
    seed: '#88219',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBT3qrDo6xdeUwAyrEyMyCVoIxTWB-dNLQJbcmmznYLCjODTk9K63dPLw-rBj4-pAAyOt2s-l79EIfeVs-9E5noXrDo2PZdxLviHpoQ8WR_YTBDFNWDoEvtaKkAOR46wjrP4oCv4C7YhC6UgfiJjx4ZIkFMJqWMpV7PUO5tYdZilqoMCxdIZa6KcOxdyYH1sLOfyf-iPbIr0oaBzsf1JiNI-S-QiVdD9LQfxnyrP_-iLRKXCxC8MszuMDQare8y43yIjzY7HLMsbMs',
    accent: 'from-primary to-primary-container',
    badge: 'verified',
  },
  {
    name: 'Minh',
    seed: '#44012',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDWHsKkEo8B9V6y1c-kfRA8b9tZeN4-zk3IvSu8sI42qpu-bwjqfVNA5aiaLmqQRG1ywO85SyoWcdMGx2BLugmzwwbq42d0def8cpht7dU0g-G1csm1w-slCUxIcQO2CuVTR5YTcgTDnetPWbhLJz0eaqb5KfIVrtXPYUiY7Tppr8mxAVvLZlRHwQ5R4nF4Pj30q8lh00McUqb6uHwTGEctwSYJ2qMbc0IRFMK65QFY00x4gYVXr-UKpzSgVZHz8I_yuZfm8tEbY0E',
    accent: 'bg-surface-container-high',
    badge: 'star',
  },
  {
    name: 'Kael',
    seed: '#12993',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCyc5XSMujQEJzsFKtzmOyyTdNFd7Dl1822j-Y-BGRYpSfbXOtqdpNpTt4euiSJgetillZU5j039XfNCIyUnNDhtmrbzVH3D5XPOFzOF_joICY9g0WjmMFIGj4j1RJI69pZGnQhACLxHGebD5VI7n5ptJbH4DyX6GwWj-_mVYZsUpA8Ms2tWBYzMPZjCXz036BRK4WHHqHieTyJZ7JaYABDCBQz7A_X1l-Jxwq5z8TWzHobjuL1dRAhU1-8FYvlqW_tpqhmzWTxISQ',
    accent: 'bg-surface-container-high',
  },
];

export default function StudioDashboardPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />
      <main className="ml-[var(--studio-sidebar-width)] pt-24 px-8 pb-12 min-h-screen">
        <section className="mb-12">
          <div className="bg-surface-container-low rounded-[2rem] p-10 relative overflow-hidden flex items-center">
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-4xl font-extrabold text-on-surface mb-4 leading-tight">Welcome back, Storyteller.</h2>
              <p className="text-on-surface-variant text-lg leading-relaxed mb-6">
                Your latest masterpiece is waiting. Use AI to blend cinematic landscapes with deep character emotions.
              </p>
              <div className="flex gap-4">
                <button className="px-6 py-3 bg-white text-primary font-bold rounded-full premium-shadow hover:bg-surface-container-lowest transition-colors">
                  Resume Last Project
                </button>
                <button className="px-6 py-3 text-on-surface-variant font-bold hover:text-primary transition-colors">
                  View Inspiration
                </button>
              </div>
            </div>
            <div className="absolute right-[-10%] top-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl"></div>
            <div className="absolute right-[10%] bottom-[-20%] w-[300px] h-[300px] bg-primary/10 rounded-full blur-2xl"></div>
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-bold text-on-surface">Recent Projects</h3>
              <p className="text-on-surface-variant text-sm mt-1">Pick up where you left off</p>
            </div>
            <button className="text-primary font-semibold text-sm flex items-center gap-1 hover:gap-2 transition-all">
              View all collections <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recentProjects.map((project) => (
              <div key={project.title} className="group bg-surface-container-lowest rounded-3xl overflow-hidden ambient-lift transition-all hover:-translate-y-1">
                <div className="aspect-[16/10] overflow-hidden relative">
                  <img alt={project.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src={project.image} />
                  <div className="absolute top-4 left-4">
                    <span className="bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      {project.genre}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-lg font-bold">{project.title}</h4>
                    <button className="text-on-surface-variant hover:text-primary transition-colors">
                      <span className="material-symbols-outlined">more_horiz</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    {project.updated}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-bold text-on-surface">Saved Characters</h3>
              <p className="text-on-surface-variant text-sm mt-1">Maintain consistency across panels</p>
            </div>
            <div className="flex gap-2">
              <button className="p-2 rounded-full border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined">tune</span>
              </button>
              <button className="p-2 rounded-full border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined">grid_view</span>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-10">
            {savedCharacters.map((character) => (
              <div key={character.name} className="flex flex-col items-center group cursor-pointer">
                <div className="relative mb-3">
                  <div className={`w-24 h-24 rounded-full p-1 ${character.accent} transition-transform group-hover:rotate-6`}>
                    <img alt={character.name} className="w-full h-full rounded-full object-cover border-2 border-white" src={character.image} />
                  </div>
                  {character.badge && (
                    <div className="absolute bottom-0 right-0 w-8 h-8 bg-surface-container-lowest rounded-full premium-shadow flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {character.badge}
                      </span>
                    </div>
                  )}
                </div>
                <span className="font-bold text-on-surface">{character.name}</span>
                <span className="text-[10px] font-mono text-on-surface-variant/70 mt-1 uppercase tracking-tighter">
                  Seed: {character.seed}
                </span>
              </div>
            ))}
            <button className="flex flex-col items-center group">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-outline-variant/50 flex items-center justify-center mb-3 group-hover:bg-surface-container-low transition-colors group-hover:border-primary/50">
                <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors text-3xl">
                  add_circle
                </span>
              </div>
              <span className="font-bold text-on-surface-variant group-hover:text-primary transition-colors">Add New</span>
              <span className="text-[10px] text-on-surface-variant/50 mt-1 uppercase">Custom Seed</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
