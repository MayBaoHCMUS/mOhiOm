import { motion } from 'framer-motion';
import { Layers, MousePointer2, Type, Square, Image as ImageIcon, Wand2, Download, Share2, ZoomIn, ZoomOut, Maximize2, Move, Undo2, Redo2, Palette, PenTool, Layout as LayoutIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/src/lib/utils';

export default function EditorWorkspace() {
  const [activeLayer, setActiveLayer] = useState(1);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-surface-container-low/30">
      {/* Left Toolbar */}
      <aside className="w-16 border-r border-outline-variant/10 flex flex-col items-center py-6 gap-6 bg-surface-container-low/50 backdrop-blur-md z-10">
        <div className="flex flex-col gap-4">
          <ToolbarButton icon={MousePointer2} active />
          <ToolbarButton icon={PenTool} />
          <ToolbarButton icon={Type} />
          <ToolbarButton icon={Square} />
          <ToolbarButton icon={ImageIcon} />
          <ToolbarButton icon={Palette} />
        </div>
        <div className="mt-auto flex flex-col gap-4 pb-4 border-t border-outline-variant/10 pt-6 px-4">
           <ToolbarButton icon={Undo2} size={18} />
           <ToolbarButton icon={Redo2} size={18} />
        </div>
      </aside>

      {/* Main Canvas Area */}
      <section className="flex-grow relative overflow-auto hide-scrollbar bg-surface flex items-center justify-center p-20 pattern-bg">
        <div className="absolute top-8 left-8 flex items-center gap-4 text-xs font-bold text-on-surface-variant/40">
           <span className="bg-surface-container-high px-4 py-1.5 rounded-full">PAGE 01 • DRAFT</span>
           <span className="bg-surface-container-high px-4 py-1.5 rounded-full">RATIO 2:3</span>
        </div>

        {/* The Panel Stage */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative bg-white aspect-[2/3] w-[500px] shadow-2xl p-6 grid grid-cols-2 grid-rows-3 gap-3 border-[12px] border-black rounded-sm"
        >
          {/* Panel 1 */}
          <div className="col-span-2 row-span-1 bg-surface-container-high relative overflow-hidden group cursor-move">
            <img src="https://images.unsplash.com/photo-1620336655055-18883ffc6a21?q=80&w=1587&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Panel" />
            <div className="absolute top-2 left-2 bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 transform -rotate-2">ZAP!</div>
            <div className="absolute bottom-4 right-4 text-xs bg-white text-black px-3 py-1 font-bold border-2 border-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Edit Panel Prompt</div>
          </div>
          
          {/* Panel 2 */}
          <div className="col-span-1 row-span-1 bg-surface-container-high relative overflow-hidden group">
            <img src="https://images.unsplash.com/photo-1578632738980-43314a57c125?q=80&w=1287&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Panel" />
            <div className="absolute inset-0 border-2 border-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Panel 3 */}
          <div className="col-span-1 row-span-1 border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-on-surface-variant/30 gap-2 hover:bg-surface-container-low hover:text-primary transition-all cursor-pointer">
             <Plus size={24} />
             <span className="text-[10px] font-bold uppercase tracking-widest">New Panel</span>
          </div>

          {/* Panel 4 */}
          <div className="col-span-2 row-span-1 bg-surface-container-high relative overflow-hidden group">
            <img src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2670&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Panel" />
          </div>
        </motion.div>

        {/* View Controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-surface-container-low/80 backdrop-blur-xl rounded-full p-2 border border-outline-variant/10 flex items-center gap-4 premium-shadow">
          <div className="flex items-center">
             <ControlButton icon={ZoomOut} />
             <span className="text-[11px] font-bold w-12 text-center text-on-surface-variant">72%</span>
             <ControlButton icon={ZoomIn} />
          </div>
          <div className="h-4 w-px bg-outline-variant/20" />
          <ControlButton icon={Maximize2} />
          <ControlButton icon={Move} />
        </div>
      </section>

      {/* Right Properties Panel */}
      <aside className="w-80 border-l border-outline-variant/10 bg-surface-container-lowest/50 backdrop-blur-xl flex flex-col">
        <header className="p-6 border-b border-outline-variant/10">
          <div className="flex bg-surface-container-low p-1 rounded-lg">
            <button className="flex-1 py-1.5 rounded-md bg-white shadow-sm text-xs font-bold text-on-surface">Settings</button>
            <button className="flex-1 py-1.5 text-xs font-bold text-on-surface-variant">Layers</button>
          </div>
        </header>

        <div className="flex-grow p-6 overflow-y-auto hide-scrollbar space-y-10">
          {/* Panel Styles */}
          <section className="space-y-4">
             <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">Panel Morphology</h3>
             <div className="grid grid-cols-2 gap-3">
                <MorphOption label="Rounded" active rounded />
                <MorphOption label="Sharp" />
                <MorphOption label="Bleed" />
                <MorphOption label="Gutterless" />
             </div>
          </section>

          {/* AI Panel Generation */}
          <section className="space-y-4 pt-6 border-t border-outline-variant/10">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">Gemini Generator</h3>
              <Wand2 size={14} className="text-primary" />
            </div>
            <textarea 
               className="w-full bg-surface-container border-none rounded-xl p-4 text-xs font-medium placeholder:text-on-surface-variant/30 min-h-[100px] leading-relaxed focus:ring-0 focus:bg-white transition-all shadow-inner"
               placeholder="Describe the action in the selected panel..."
            />
            <button className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-lg shadow-primary/20 hover:scale-[0.98] transition-all">
              Generate Composition
            </button>
          </section>

          {/* Quick Assets */}
          <section className="space-y-4 pt-6 border-t border-outline-variant/10">
             <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">Bubble Styles</h3>
             <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="aspect-square bg-surface-container rounded-lg border border-outline-variant/20 hover:border-primary transition-all cursor-pointer flex items-center justify-center">
                    <Type size={18} className="text-on-surface-variant/40" />
                  </div>
                ))}
             </div>
          </section>
        </div>

        <footer className="p-6 border-t border-outline-variant/10 flex gap-3">
           <button className="flex-1 py-3 border border-outline-variant/30 rounded-xl font-bold text-xs text-on-surface hover:bg-surface-container-low transition-all">Preview</button>
           <button className="flex-1 py-3 bg-surface-container-high text-on-surface rounded-xl font-bold text-xs hover:bg-surface-container-highest transition-all">Export</button>
        </footer>
      </aside>
    </div>
  );
}

function ToolbarButton({ icon: Icon, active, size = 20 }: { icon: any; active?: boolean; size?: number }) {
  return (
    <button className={cn(
      "w-10 h-10 rounded-xl flex items-center justify-center transition-all group",
      active ? "bg-primary text-on-primary shadow-lg shadow-primary/30" : "text-on-surface-variant hover:bg-surface-container-high"
    )}>
      <Icon size={size} className={cn("transition-transform group-hover:scale-110", active ? "scale-100" : "scale-95")} />
    </button>
  );
}

function ControlButton({ icon: Icon }: { icon: any }) {
  return (
    <button className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white transition-all">
      <Icon size={16} />
    </button>
  );
}

function MorphOption({ label, active, rounded }: { label: string; active?: boolean; rounded?: boolean }) {
  return (
    <button className={cn(
      "px-3 py-2 text-[10px] font-bold rounded-lg border transition-all text-center",
      active ? "bg-primary/5 border-primary text-primary" : "bg-surface-container border-outline-variant/10 text-on-surface-variant"
    )}>
      {label}
    </button>
  );
}
