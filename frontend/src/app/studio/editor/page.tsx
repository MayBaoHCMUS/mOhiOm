import Link from 'next/link';

const panels = [
  {
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJQb39ZznFVA9tnHCaCA8-xEr4v_H6Brql2TkCpKQm8ypwr2JjJ_zIxEFdfAqhL7i3pWRnx6sk__D5zK7IbB2HQAuR_rD_wz7-9_ds05BLMWkplqXQETwe0J-N-2Mu2uXjoGPvsy4TrVqosDwfvtEDOI8EouSbmvKQpNJ-QIs2XdoI7Q0uYkQx4Ahut_1D6xu1DbrbmtElT9prAzvaZGS-LPIaO1vrcZI9JlgVpq-YR0-t53hpUf2GJn9V9R7jlf-OWZGhdw2nD-4',
    bubble: '"Where did they go?"',
  },
  {
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvFMBfyCcvuqUZx68BlWorWr-e7C30lKP3F8VAT6kR97ubocxv4s4wnG1QKIf31ggSRHMrmkD1Bedwd7HNzfulv8bLMPy6TEpxdv6yZsIGqFCaWxxYlKmtNoIX_5V13949gQ8pw9tKGpYNIVzfzLKj6yadBwpdHpCmRl0oRJ7dRCwmt6i7EwvvrRUUFwtAmpp_z1gwv9J1NZ-_YITvigA0CUzHOLeFe_Du0cpSA8bim-g7meJEzkOALBNpBXQzVTX61XrZGq0VbFA',
    active: true,
  },
  {
    loading: true,
  },
  {
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDehLNvEBltythSgLldpWKCr9Q9l1OWMaInhPB-w0osjlhXOOURY_AYijDxAmDZSDJm_gkhf4fzLYhZIgbUwBxhEVjauJUuewaSI8xwSKDMIX6LdVfd3CUBJWBliYLGwopX6lcHxjCyX9shIpot3yL6f6-BzMpX_Vy19iVoZgX5-oIgnV1iUx5qy_FoQbKTvZMukRwiVL9uV5c0azYaTRFQyesWqhYfDP_8jljbYdW4D4hmDk9ixuPFlO7K_CgyfCtXqGKaOyF6WkU',
  },
  {
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAhKXfF16qBgg1z_w5gNNPqvqJPiMEveqcq5lORKVFVCskf-Qz88D_atpmyuV5Jy0VMPJXyW0E8hVabOZTJXyybbfJdCO2R5UCk4aP9YeyLn7xxHpCP5xFM6uTdLCrRWEpOZz6f3gRg2H3tujIRuKathqlWJ5EP9ysJ_AkYESi-foyFxX9LY7WeYMMXELFGKQB3IudrLjDuIGi242XCXZLDKGg3SAdc6BnX4fa6ZuB0GvO8G57svd0VU5BWthAc3_IAH0gwLROdrtw',
    bubble: '"The signal is coming from inside..."',
  },
  {
    add: true,
  },
];

export default function ComicEditorPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface antialiased overflow-hidden">
      <header className="fixed top-0 w-full z-50 glass-nav shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link className="text-xl font-bold tracking-tighter" href="/studio/dashboard">
            Luminous Comics
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link className="text-on-surface-variant hover:text-on-surface transition-all" href="/studio/editor">
              Drafts
            </Link>
            <Link className="text-primary font-semibold border-b-2 border-primary transition-all" href="/studio/editor">
              Assets
            </Link>
            <Link className="text-on-surface-variant hover:text-on-surface transition-all" href="/gallery">
              Gallery
            </Link>
            <Link className="text-on-surface-variant hover:text-on-surface transition-all" href="/studio/dashboard">
              Team
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-all">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-all">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
          <Link className="bg-gradient-to-br from-primary to-primary-container text-white px-6 py-2 rounded-xl font-semibold premium-shadow hover:scale-[0.98] transition-all" href="/studio/export">
            Publish
          </Link>
          <div className="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden">
            <img
              alt="User Workspace Profile"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBIEowVbtQi_PPJ4BYU4OPPTPuMkwscS5r33E3kRsB65uKw_JgzOizZhW_Ha2r_lWdiFYEIk0QXvvab_ueRX5fjaptsW4aj5Mft5NxvZWKrWwz2Pw6P-IUV3LHNHgF-cSNGZO7HF09I0G6CkOBILP167UDe5JDoLsvnoYV9eiDd8ARnaVQhrv9e-FlgaAgwPlKGV92JfMo_98woGzL3niY3isLYmI2sGSj3uwj4pYaQsmLKo54gFjvEZsElC_qq-qY8cd5zhFtFwn8"
            />
          </div>
        </div>
      </header>

      <div className="flex h-screen pt-16">
        <aside className="fixed left-0 top-16 bottom-0 w-64 p-4 space-y-2 flex flex-col bg-surface-container-low text-sm font-medium border-r border-outline-variant/30">
          <div className="mb-6 px-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-sm">auto_stories</span>
              </div>
              <div>
                <h2 className="text-on-surface font-bold text-base leading-none">Project Alpha</h2>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">Issue #1 - Origins</span>
              </div>
            </div>
          </div>
          <nav className="space-y-1 flex-1">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 bg-white text-primary shadow-sm rounded-xl transition-all">
              <span className="material-symbols-outlined">auto_stories</span>
              <span>Story Beats</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-on-surface-variant hover:translate-x-1 transition-transform">
              <span className="material-symbols-outlined">collections_bookmark</span>
              <span>Asset Library</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-on-surface-variant hover:translate-x-1 transition-transform">
              <span className="material-symbols-outlined">layers</span>
              <span>Layers</span>
            </button>
            <div className="pt-6 pb-2 px-3">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em]">Scenes</span>
            </div>
            <div className="space-y-3 px-1">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-outline-variant/30 hover:border-primary/30 transition-colors cursor-pointer group">
                <p className="text-xs text-primary font-bold mb-1">Scene 1</p>
                <p className="text-on-surface text-sm leading-snug">The Encounter</p>
              </div>
              <div className="p-3 bg-surface-container-high rounded-xl hover:bg-white hover:shadow-sm transition-all cursor-pointer group">
                <p className="text-xs text-on-surface-variant font-bold mb-1">Scene 2</p>
                <p className="text-on-surface-variant text-sm leading-snug">Into the City</p>
              </div>
              <div className="p-3 bg-surface-container-high rounded-xl hover:bg-white hover:shadow-sm transition-all cursor-pointer group opacity-60">
                <p className="text-xs text-on-surface-variant font-bold mb-1">Scene 3</p>
                <p className="text-on-surface-variant text-sm leading-snug">The Reveal</p>
              </div>
            </div>
          </nav>
          <div className="pt-4 border-t border-outline-variant/30 space-y-1">
            <Link className="w-full flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:translate-x-1 transition-transform" href="/studio/export">
              <span className="material-symbols-outlined">download</span>
              <span>Export</span>
            </Link>
            <button className="w-full bg-primary/10 text-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/20 transition-all">
              <span className="material-symbols-outlined">add</span>
              New Chapter
            </button>
          </div>
        </aside>

        <main className="flex-1 ml-64 mr-72 bg-surface-container-low min-h-screen overflow-y-auto p-12">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {panels.map((panel, index) => {
                if (panel.loading) {
                  return (
                    <div key={`panel-${index}`} className="aspect-[3/4] bg-surface-container-high rounded-2xl overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-surface-container-high to-surface-container-highest flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <div>
                          <p className="font-bold text-on-surface">Generating...</p>
                          <p className="text-xs text-on-surface-variant">&lt; 30s remaining</p>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (panel.add) {
                  return (
                    <div key={`panel-${index}`} className="aspect-[3/4] border-2 border-dashed border-outline-variant/50 rounded-2xl flex flex-col items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary transition-all cursor-pointer bg-surface-container-lowest">
                      <span className="material-symbols-outlined text-4xl mb-2">add_box</span>
                      <span className="text-sm font-bold uppercase tracking-wider">Add Panel</span>
                    </div>
                  );
                }
                return (
                  <div key={`panel-${index}`} className={`aspect-[3/4] bg-white rounded-2xl overflow-hidden premium-shadow relative group ${panel.active ? 'ring-2 ring-primary' : ''}`}>
                    {panel.src && (
                      <img className={`w-full h-full object-cover ${panel.active ? 'brightness-95' : 'grayscale-[0.3] brightness-90'}`} alt="Panel" src={panel.src} />
                    )}
                    {panel.bubble && (
                      <div className={`absolute ${panel.active ? 'bottom-6 right-6 rounded-br-none' : 'top-4 left-4 rounded-bl-none'} bg-white px-4 py-2 rounded-[2rem] shadow-lg border-2 border-slate-900 max-w-[180px]`}>
                        <p className="text-xs font-bold leading-tight uppercase tracking-tight">{panel.bubble}</p>
                      </div>
                    )}
                    {panel.active && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-4 shadow-2xl">
                        <button className="hover:text-primary/70 transition-colors">
                          <span className="material-symbols-outlined text-lg">casino</span>
                        </button>
                        <div className="w-px h-4 bg-white/20"></div>
                        <button className="hover:text-primary/70 transition-colors">
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <div className="w-px h-4 bg-white/20"></div>
                        <button className="hover:text-primary/70 transition-colors">
                          <span className="material-symbols-outlined text-lg">open_with</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        <aside className="fixed right-0 top-16 bottom-0 w-72 flex flex-col p-6 bg-surface-container-low border-l border-outline-variant/30">
          <div className="mb-8">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-6">Smart Engine</h3>
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface">Layout Engine</label>
                  <span className="material-symbols-outlined text-primary text-sm">grid_view</span>
                </div>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-bold text-on-surface-variant uppercase">
                      <span>Story Pacing</span>
                      <span className="text-primary">Dynamic</span>
                    </div>
                    <input className="w-full h-1.5 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary" max={10} min={1} type="range" defaultValue={7} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">face</span>
                      <span className="text-xs font-bold text-on-surface">Smart Face Detection</span>
                    </div>
                    <button className="w-10 h-5 bg-primary rounded-full relative transition-all">
                      <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface">Composition</label>
                  <span className="material-symbols-outlined text-on-surface-variant text-sm">speed</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="bg-primary/10 text-primary text-[10px] font-bold py-2 rounded-lg border border-primary/10">Action</button>
                  <button className="bg-white text-on-surface-variant text-[10px] font-bold py-2 rounded-lg border border-outline-variant/30 hover:bg-surface-container-low">Dialog</button>
                  <button className="bg-white text-on-surface-variant text-[10px] font-bold py-2 rounded-lg border border-outline-variant/30 hover:bg-surface-container-low">Landscape</button>
                  <button className="bg-white text-on-surface-variant text-[10px] font-bold py-2 rounded-lg border border-outline-variant/30 hover:bg-surface-container-low">Abstract</button>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface">Typography</label>
                  <span className="material-symbols-outlined text-on-surface-variant text-sm">format_size</span>
                </div>
                <div className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface-variant font-medium">
                  <div className="flex justify-between items-center mb-2">
                    <span>Font Family</span>
                    <span className="text-on-surface font-bold">Comic Classic</span>
                  </div>
                  <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="w-2/3 h-full bg-primary"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-auto bg-slate-900 text-white p-4 rounded-2xl premium-shadow">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-yellow-400">auto_awesome</span>
              <span className="text-xs font-bold">Pro Suggestion</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Consider a darker tone for Panel 4 to emphasize the dramatic shift in Scene 2&apos;s atmosphere.
            </p>
            <button className="w-full mt-3 text-[10px] font-bold uppercase bg-white/10 hover:bg-white/20 py-2 rounded-lg transition-all">
              Apply Tone
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

