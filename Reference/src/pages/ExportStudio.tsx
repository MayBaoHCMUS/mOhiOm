import { motion } from 'framer-motion';
import { Download, Share2, Eye, Printer, FileText, ImageIcon, Table, ChevronRight, CheckCircle2, ShieldCheck, Globe, Lock } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const FORMATS = [
  { id: 'pdf', title: 'High-Res PDF', desc: 'Industry standard for printing. 300DPI.', icon: FileText, color: 'text-red-500' },
  { id: 'jpg', title: 'JPEG Bundle', desc: 'Web-ready compressed individual panels.', icon: ImageIcon, color: 'text-blue-500' },
  { id: 'json', title: 'Project JSON', desc: 'Raw metadata for external tools.', icon: Table, color: 'text-emerald-500' },
];

export default function ExportStudio() {
  return (
    <div className="px-10 py-12 max-w-5xl mx-auto h-full overflow-y-auto hide-scrollbar">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">Export Studio</h1>
        <p className="text-on-surface-variant text-lg max-w-2xl mx-auto leading-relaxed">
          Your creative vision is complete. Finalize your output and distribute your story to the world.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start pb-20">
        {/* Left Column: Preview */}
        <section className="space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/50 ml-2">Final Proof</h3>
          <div className="bg-surface-container-lowest rounded-[2.5rem] p-8 shadow-2xl border border-outline-variant/10 relative group">
            <div className="aspect-[3/4] bg-surface-container-high rounded-3xl overflow-hidden shadow-inner flex flex-col">
               <div className="flex-grow flex items-center justify-center bg-black/5">
                 <img src="https://images.unsplash.com/photo-1605142859862-978be7eba909?q=80&w=2670&auto=format&fit=crop" className="w-full h-full object-cover opacity-60 grayscale-[0.5]" alt="Comic Page" />
               </div>
            </div>
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[2.5rem] backdrop-blur-sm">
               <button className="bg-white text-black px-8 py-3 rounded-full font-bold flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                  <Eye size={20} />
                  Inspect Pages
               </button>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4 opacity-50">
             <div className="flex flex-col items-center">
                <span className="text-sm font-bold">12</span>
                <span className="text-[10px] uppercase font-bold tracking-widest">Panels</span>
             </div>
             <div className="w-px h-8 bg-outline-variant/20" />
             <div className="flex flex-col items-center">
                <span className="text-sm font-bold">3200</span>
                <span className="text-[10px] uppercase font-bold tracking-widest">Words</span>
             </div>
             <div className="w-px h-8 bg-outline-variant/20" />
             <div className="flex flex-col items-center">
                <span className="text-sm font-bold">4K</span>
                <span className="text-[10px] uppercase font-bold tracking-widest">Assets</span>
             </div>
          </div>
        </section>

        {/* Right Column: Actions */}
        <section className="space-y-10">
          <div className="space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/50 ml-2">Export Format</h3>
            <div className="space-y-4">
               {FORMATS.map((format) => (
                 <motion.button
                   key={format.id}
                   whileHover={{ scale: 1.02, x: 8 }}
                   className="w-full p-5 bg-surface-container-low rounded-2xl flex items-center gap-5 border border-transparent hover:border-primary/20 hover:bg-white transition-all text-left group"
                 >
                   <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-surface-container-high transition-colors group-hover:bg-primary/10", format.color)}>
                      <format.icon size={24} />
                   </div>
                   <div className="flex-grow">
                      <h4 className="font-bold text-on-surface">{format.title}</h4>
                      <p className="text-xs text-on-surface-variant">{format.desc}</p>
                   </div>
                   <Download size={18} className="text-on-surface-variant group-hover:text-primary transition-colors" />
                 </motion.button>
               ))}
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/50 ml-2">Distribution</h3>
            <div className="grid grid-cols-2 gap-4">
               <button className="p-6 bg-primary/5 rounded-2xl border border-primary/10 flex flex-col items-center gap-3 transition-all hover:bg-primary/10 hover:scale-[1.02] group">
                  <Share2 size={24} className="text-primary group-hover:rotate-12 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Web Link</span>
               </button>
               <button className="p-6 bg-surface-container-low rounded-2xl border border-outline-variant/10 flex flex-col items-center gap-3 transition-all hover:bg-white hover:scale-[1.02] group">
                  <Printer size={24} className="text-on-surface-variant group-hover:-translate-y-1 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Print Lab</span>
               </button>
            </div>
          </div>

          <div className="p-8 rounded-[2rem] bg-surface-container-lowest border border-outline-variant/10 shadow-sm relative overflow-hidden group">
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
             <div className="flex items-center gap-4 mb-4">
                <ShieldCheck size={28} className="text-emerald-500" />
                <h4 className="font-bold">Creator Rights Protected</h4>
             </div>
             <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
                All generated character seeds and narrative structures are cryptographically signed to your creative ID. This ensures your commercial rights are anchored to your account.
             </p>
             <button className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1 hover:translate-x-1 transition-transform">
                Read Rights Documentation
                <ChevronRight size={14} />
             </button>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-64 right-0 h-24 bg-white/80 backdrop-blur-xl border-t border-outline-variant/10 px-10 flex items-center justify-between z-[40]">
        <div className="flex items-center gap-3 text-on-surface-variant">
           <Globe size={18} />
           <span className="text-xs font-bold">Private Draft • Visible only to you</span>
        </div>
        <button className="bg-primary text-on-primary px-12 py-4 rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 flex items-center gap-3 transition-all active:scale-95">
          Complete and Publish
          <CheckCircle2 size={18} />
        </button>
      </div>
    </div>
  );
}
