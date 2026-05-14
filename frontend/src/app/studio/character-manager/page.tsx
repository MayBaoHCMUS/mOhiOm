import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';

const characters = [
  {
    name: 'Emma',
    seed: '#8472',
    description:
      'Protagonist, futuristic pilot. Defined by her sharp jawline and consistent copper-colored hair under studio lighting.',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAI9kHG7q0lTClXYx_ozlAsTr6otiXwYKLDp85rFDEWmcDsUEHUMwOcTPf6XV0Be8Lh0SqYp1Ih9dLhtMloZNIfO5JXA6jQ-uws5qGzt9Kwpm3_YMnpw-fduYzgnJdtOMLo8zSfEH9-jgcgrnHftZEm-6t4OaREWSXNoeY3M6i6VJiJlTv8Ze4WMruFUJosN2uEz_Z9gVWeuEY225JOKiqY0YqlxvoXX4PG1EpOzDJj-5Q3ZVgw2-wE0qkmE560s1lHNFz0pCAyC_g',
    tag: 'A1',
    locked: true,
  },
  {
    name: 'Unit 734',
    seed: '#2190',
    description:
      'Maintenance droid with heavy weathering. Consistency focuses on optical lens glow and panel gap alignment.',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD2lDrTGpQtWJ-GnxiHtIB6evZf1vshBKx3HzQ4wxlyVMdvybKO9y_NpGQfX0OfazH78aDXY1sugdoWCRoxZnh0n749OumOqZnzpniN3fugTLDdYcnC-hwJWUzWl38tig8_Vqk2qTEpO3OXL9Wh9kudy9NhjQLis4OnXGDnWJTlh7ZE3wiYb4xZqoyHPi3qTN0g7ggedtOv1U_rOxI1gTXmGo1kLlyH8-ql4LP96Fyb33UJpVsRU3ZtiasFyvJht5H1bokgnjdbb9k',
    tag: 'S2',
    locked: false,
  },
  {
    name: 'Captain Kael',
    seed: '#0045',
    description:
      'The veteran commander. Cybernetic eye glow must remain at constant luminosity across all panels.',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAkNvxbISgQwnZsoFGVxnMVfuPOgPedQ2Ww0SJEb_Schy_tOOSmuK4FqTg6gLVX9qT3gvVKqm2PU7-3i_x_wIHP96JrvMIg6n355tkU-y65ouyJ6ZBrNrgUlz-ywXUW3qfucS5x6DfXJ9kkg1MEw_OI5laRBUGY_46k02BUwQW9JPMOglRSVz5LUXpVo5J1ATlKz1IZZLe0rHAjQHOLNxGjMpfpQpIdNX2Wbqi-bWRC3N6vJJrXo-Vwg7dovI_cdmREeJyjgbIvoIU',
    tag: 'B4',
    locked: true,
  },
];

const recentPanels = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBCYl41vGC4XxxGvClNonGsVdxlBKgTT7XxgHGgFSC6fVo3aMC9Xq2s7ZWaUMXQaHzxWb5Q2NGkDH9gOWttGvfyDza10iwiyERV0aYLp0uRT04AGapPNHxa2e2FNGf7cZEkpVDu7X1duskeLOqYYybsP0YLMSJcsFwooJnT_BNJjN-SlI6i62GRKOraISxLcfEK5wWmYQVtfC-noz_OjBbfNgotxBfi6J0nkaiCpox8orR3GRHh-IdbCrzVTmn-h8HJhihHvkFtMwE',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBIRoy8t1LJa-aQoCjkvD9WSaoScdLTc0hKor4L-wFFiZNbL8CZBGKVPskC62Am6LVyU7wlA9589VROslL6mvnF-EAyVJAyH3Fdw6WZuyxe5iRwd9N4Ve9MQZBny1VFcg4dFaYsX0_aspxMJPebYtRe3-0gFbE5eWGqQr_VlIU5rvHjWGJ-vp6kbJvi5i2d649sTzqUbWY_emrkhqcxkQiTv6CEemJ5cJvMO1XdEtkHexbWfPTrDWHsPcjwnUnv5_v6B1LQg1UVyEM',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDcvpHrJy2qMZCVLydjjQ9PExa8xKzjVKSzB0dhc3zfBtDjoFqO_W1kvKK8dU79aPhex375fLeEkMxLDn8XdLt6LWHdfD-8EN8tPewxDtvqgnSxPnEY6CadBefitTAJfBR937o1YDdft5VvnbKiPqdCdJV_voE6Lo_cwaAq_tnHExoTFk9wiezPRR3v_zVfc2z8xVZa-cqTOvJPjVzteI_5mkzMo1fKVC4jznkfugwXHmkVJ6Y3LYjxGPzshwAh2fg9MPw24QikjRo',
];

export default function CharacterManagerPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface flex overflow-hidden">
      <StudioSidebar />
      <StudioTopBar />
      <main className="flex-1 ml-[var(--studio-sidebar-width)] h-screen overflow-y-auto relative px-10 pt-24 pb-12">
        <div className="max-w-7xl mx-auto space-y-12">
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tighter text-on-surface">Character Manager</h2>
              <p className="text-on-surface-variant mt-1">Maintain identity and consistency across all panels.</p>
            </div>
            <div className="flex gap-4">
              <div className="flex bg-surface-container-low p-1 rounded-full">
                <button className="px-6 py-2 rounded-full bg-surface-container-lowest shadow-sm font-bold text-primary text-sm">Active Engine</button>
                <button className="px-6 py-2 rounded-full text-on-surface-variant font-medium text-sm">Archived</button>
              </div>
            </div>
          </header>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <section className="xl:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-on-surface-variant tracking-widest uppercase">Active Characters</h3>
                <span className="text-xs text-outline bg-surface-container px-3 py-1 rounded-full">4 / 12 Slots used</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {characters.map((character) => (
                  <div key={character.name} className="bg-surface-container-lowest p-6 rounded-xl shadow-lg flex flex-col h-full group hover:bg-surface-container-low transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full ring-4 ring-primary/10 overflow-hidden shadow-inner bg-surface-container">
                            <img alt={character.name} className="w-full h-full object-cover" src={character.avatar} />
                          </div>
                          <div className="absolute -bottom-1 -right-1 bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold">
                            {character.tag}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-bold text-on-surface leading-none">{character.name}</h4>
                          <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface text-[10px] font-bold tracking-tight">
                            Seed ID: {character.seed}
                          </span>
                        </div>
                      </div>
                      <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-white transition-all">
                        <span className="material-symbols-outlined text-xl">brush</span>
                      </button>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed flex-1 mb-6">{character.description}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Lock Face</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input className="sr-only peer" type="checkbox" defaultChecked={character.locked} />
                        <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>
                ))}
                <div className="border-2 border-dashed border-outline-variant/40 p-6 rounded-xl flex flex-col items-center justify-center text-center group hover:border-primary/40 hover:bg-surface-container-low transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-outline">person_add</span>
                  </div>
                  <span className="font-bold text-on-surface-variant">Add Character</span>
                  <p className="text-[10px] text-outline mt-1 px-4 uppercase tracking-tighter">New seed or generation</p>
                </div>
              </div>
            </section>

            <aside className="space-y-8">
              <div className="bg-surface-container-high p-8 rounded-xl relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-3xl"></div>
                <h3 className="text-xs font-bold text-primary tracking-widest uppercase mb-4">Global Consistency</h3>
                <div className="space-y-6">
                  {[
                    { label: 'Face Lock Strength', value: '85%', width: '85%' },
                    { label: 'Attire Rigidity', value: '40%', width: '40%' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-on-surface-variant">{item.label}</label>
                        <span className="text-[10px] text-primary font-bold">{item.value}</span>
                      </div>
                      <div className="w-full bg-surface-container-lowest h-2 rounded-full">
                        <div className="bg-primary h-2 rounded-full" style={{ width: item.width }}></div>
                      </div>
                    </div>
                  ))}
                  <button className="w-full py-3 bg-surface-container-lowest text-on-surface font-bold rounded-xl shadow-sm hover:shadow-md transition-shadow">
                    Recalibrate All Seeds
                  </button>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-8 rounded-xl shadow-lg">
                <h3 className="text-xs font-bold text-on-surface-variant tracking-widest uppercase mb-6">Recent Panels</h3>
                <div className="grid grid-cols-2 gap-4">
                  {recentPanels.map((panel) => (
                    <div key={panel} className="aspect-square rounded-lg bg-surface-container overflow-hidden group">
                      <img alt="Panel" className="w-full h-full object-cover group-hover:scale-110 transition-transform" src={panel} />
                    </div>
                  ))}
                  <div className="aspect-square rounded-lg bg-surface-container overflow-hidden group flex items-center justify-center border-2 border-dashed border-outline-variant/40">
                    <span className="material-symbols-outlined text-outline">add_photo_alternate</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <button className="fixed bottom-10 right-10 w-16 h-16 bg-gradient-to-br from-primary to-primary-container text-white rounded-full shadow-2xl flex items-center justify-center group active:scale-95 duration-150">
        <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform">add</span>
      </button>
    </div>
  );
}
