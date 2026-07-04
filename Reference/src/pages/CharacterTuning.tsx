import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Dice5, Check, ChevronRight, Edit3, Wand2, Grid, List as ListIcon, Zap } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/src/lib/utils';

const VARIATIONS = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1588&auto=format&fit=crop',
    seed: '#98219'
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=1664&auto=format&fit=crop',
    seed: '#44012'
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=1587&auto=format&fit=crop',
    seed: '#12993'
  }
];

export default function CharacterTuning() {
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [prompt, setPrompt] = useState('Young woman, 25 years old, sharp detective features, messy dark bob haircut, wearing a tan futuristic trench coat over a neon-accented tactical suit, glowing blue eyes, gritty cyberpunk noir style, detailed digital painting, high contrast lighting, cinematic atmosphere.');

  return (
    <div className="px-10 py-12 pb-32 max-w-6xl mx-auto h-full overflow-y-auto hide-scrollbar">
      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Emma – Character Tuning</h1>
          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase tracking-widest">Draft Phase</span>
        </div>
        <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
          Refine the visual identity for Emma. These variations will serve as the grounding reference for all comic panels to ensure cinematic consistency.
        </p>
      </header>

      {/* AI Prompt Editor */}
      <section className="bg-surface-container-lowest rounded-[2rem] p-8 premium-shadow border border-outline-variant/10 mb-12 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <Wand2 size={120} />
        </div>
        
        <div className="flex items-center gap-3 mb-6">
          <Zap size={20} className="text-primary" />
          <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/70">AI Prompt Editor</label>
        </div>

        <div className="relative group">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full min-h-[160px] p-6 bg-surface-container-low border-none rounded-2xl text-on-surface focus:ring-0 focus:bg-white transition-all text-lg leading-relaxed resize-none scroll-m-0"
            placeholder="Describe Emma's visual traits, clothing, and the specific comic art style..."
          />
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button className="px-6 py-2 bg-white text-on-surface font-bold text-sm rounded-xl shadow-sm hover:shadow-md transition-all">
              Use Suggestion
            </button>
            <button className="px-6 py-2 bg-primary text-on-primary font-bold text-sm rounded-xl shadow-md transition-all active:scale-95">
              Refine Prompt
            </button>
          </div>
        </div>
      </section>

      {/* Variations Grid */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold">Character Variations</h2>
            <p className="text-sm text-on-surface-variant mt-1">Select a variation to lock in the character ID.</p>
          </div>
          <div className="flex bg-surface-container-low p-1 rounded-lg">
            <button className="p-2 bg-white rounded-md shadow-sm text-primary transition-all">
              <Grid size={18} />
            </button>
            <button className="p-2 text-on-surface-variant hover:text-on-surface transition-all">
              <ListIcon size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {VARIATIONS.map((v) => (
            <motion.div
              key={v.id}
              whileHover={{ y: -6 }}
              className={cn(
                "group bg-surface-container-lowest rounded-[2rem] overflow-hidden transition-all duration-500 border relative",
                selectedId === v.id ? "ring-4 ring-primary border-primary" : "border-outline-variant/10 shadow-sm hover:shadow-xl"
              )}
              onClick={() => setSelectedId(v.id)}
            >
              <div className="aspect-[3/4] relative overflow-hidden">
                <img src={v.image} alt="Variation" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute top-4 left-4">
                   <div className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-widest">{v.seed}</div>
                </div>
                {selectedId === v.id && (
                  <div className="absolute top-4 right-4 bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
                    <Check size={20} strokeWidth={3} />
                  </div>
                )}
              </div>
              <div className="p-6 space-y-3">
                <button 
                  className={cn(
                    "w-full py-3 rounded-xl font-bold text-sm transition-all shadow-sm",
                    selectedId === v.id ? "bg-primary text-on-primary" : "bg-primary/10 text-primary hover:bg-primary/20"
                  )}
                >
                  Set as Reference ID
                </button>
                <button className="w-full py-3 bg-surface-container-high text-on-surface font-bold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-all group/btn">
                  <Dice5 size={18} className="group-hover/btn:rotate-45 transition-transform" />
                  Regenerate
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-64 right-0 h-24 bg-white/80 backdrop-blur-xl border-t border-outline-variant/10 px-10 flex items-center justify-end z-[40]">
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">Next Step</p>
            <p className="text-sm font-bold">Generate Panels & Backgrounds</p>
          </div>
          <button className="bg-primary text-on-primary px-10 py-4 rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 flex items-center gap-3 transition-transform active:scale-95">
            Generate Comic Pages
            <Sparkles size={18} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
