import { motion } from 'framer-motion';
import { Edit2, Sparkles, Plus, MoreVertical, Lock, ShieldCheck, Brush, LayoutGrid, Eye } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useState } from 'react';

const CHARACTERS = [
  {
    id: 'A1',
    name: 'Emma',
    seed: '#8472',
    description: 'Protagonist, futuristic pilot. Defined by her sharp jawline and consistent copper-colored hair under studio lighting.',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1587&auto=format&fit=crop',
    locked: true,
  },
  {
    id: 'S2',
    name: 'Unit 734',
    seed: '#2190',
    description: 'Maintenance droid with heavy weathering. Consistency focuses on optical lens glow and panel gap alignment.',
    image: 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?q=80&w=2560&auto=format&fit=crop',
    locked: false,
  },
  {
    id: 'B4',
    name: 'Captain Kael',
    seed: '#0045',
    description: 'The veteran commander. Cybernetic eye glow must remain at constant luminosity across all panels.',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1587&auto=format&fit=crop',
    locked: true,
  },
];

const RECENT_PANELS = [
  'https://images.unsplash.com/photo-1620336655055-18883ffc6a21?q=80&w=1587&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1578632738980-43314a57c125?q=80&w=1287&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2670&auto=format&fit=crop',
];

export default function CharacterManager() {
  const [activeEngine, setActiveEngine] = useState(true);

  return (
    <div className="px-10 py-12 pb-24 h-full">
      {/* Header */}
      <header className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight mb-2">Character Manager</h2>
          <p className="text-on-surface-variant text-lg">Maintain identity and consistency across all panels.</p>
        </div>
        <div className="flex bg-surface-container-low p-1 rounded-full">
          <button 
            onClick={() => setActiveEngine(true)}
            className={cn(
              "px-6 py-2 rounded-full font-bold text-sm transition-all",
              activeEngine ? "bg-white shadow-sm text-primary" : "text-on-surface-variant"
            )}
          >
            Active Engine
          </button>
          <button 
            onClick={() => setActiveEngine(false)}
            className={cn(
              "px-6 py-2 rounded-full font-bold text-sm transition-all",
              !activeEngine ? "bg-white shadow-sm text-primary" : "text-on-surface-variant"
            )}
          >
            Archived
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Active Characters Grid */}
        <section className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/70">Active Characters</h3>
            <span className="text-[10px] bg-surface-container px-3 py-1 rounded-full font-bold text-on-surface-variant">4 / 12 Slots used</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CHARACTERS.map((char) => (
              <motion.div
                key={char.id}
                whileHover={{ y: -4 }}
                className="bg-surface-container-lowest p-6 rounded-[1.5rem] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full border border-outline-variant/10 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full ring-4 ring-primary/10 overflow-hidden shadow-inner bg-surface-container">
                        <img src={char.image} alt={char.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white">
                        {char.id}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold leading-none">{char.name}</h4>
                      <div className="inline-block mt-2 px-2 py-0.5 rounded-md bg-surface-container text-primary text-[10px] font-bold tracking-tight">
                        Seed ID: {char.seed}
                      </div>
                    </div>
                  </div>
                  <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-all">
                    <Brush size={20} />
                  </button>
                </div>
                
                <p className="text-sm text-on-surface-variant leading-relaxed flex-1 mb-6">
                  {char.description}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">Lock Face</span>
                  <button className={cn(
                    "w-11 h-6 rounded-full relative transition-all duration-300",
                    char.locked ? "bg-primary" : "bg-outline-variant/30"
                  )}>
                    <div className={cn(
                      "w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-300",
                      char.locked ? "left-6" : "left-1"
                    )} />
                  </button>
                </div>
              </motion.div>
            ))}

            <button className="border-2 border-dashed border-outline-variant/30 p-6 rounded-[1.5rem] flex flex-col items-center justify-center text-center group hover:border-primary/50 hover:bg-surface-container-low transition-all h-full min-h-[220px]">
              <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Plus size={24} className="text-on-surface-variant" />
              </div>
              <span className="font-bold text-on-surface">Add Character</span>
              <p className="text-[10px] text-on-surface-variant/50 mt-1 uppercase tracking-widest">New Seed or Generation</p>
            </button>
          </div>
        </section>

        {/* Controls Sidebar */}
        <aside className="space-y-8">
          <div className="bg-primary/5 p-8 rounded-[2rem] relative overflow-hidden backdrop-blur-sm border border-primary/10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-6">Global Consistency</h3>
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-on-surface-variant">Face Lock Strength</label>
                  <span className="text-[10px] font-bold text-primary">85%</span>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full">
                  <div className="bg-primary h-full rounded-full w-[85%]" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-on-surface-variant">Attire Rigidity</label>
                  <span className="text-[10px] font-bold text-primary">40%</span>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full">
                  <div className="bg-primary h-full rounded-full w-[40%]" />
                </div>
              </div>
              <button className="w-full py-4 bg-white text-on-surface font-bold text-sm rounded-xl premium-shadow hover:scale-[0.98] transition-all">
                Recalibrate All Seeds
              </button>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-8 rounded-[1.5rem] premium-shadow border border-outline-variant/10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-6">Recent Panels</h3>
            <div className="grid grid-cols-2 gap-4">
              {RECENT_PANELS.map((p, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden group cursor-pointer">
                  <img src={p} alt="Recent panel" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                </div>
              ))}
              <div className="aspect-square rounded-xl border-2 border-dashed border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary transition-all cursor-pointer">
                <Plus size={24} />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Floating Action Menu */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-10 right-10 w-16 h-16 bg-gradient-to-br from-primary to-primary-container text-white rounded-full shadow-2xl flex items-center justify-center z-50"
      >
        <Plus size={32} />
      </motion.button>
    </div>
  );
}
