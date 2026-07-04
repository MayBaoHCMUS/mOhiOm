import { motion } from 'framer-motion';
import { Edit3, Wand2, Plus, Info, LayoutTemplate, Layers, MousePointer2, ChevronRight, Zap } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/src/lib/utils';

export default function StorySetup() {
  return (
    <div className="px-10 py-12 max-w-7xl mx-auto h-full overflow-y-auto hide-scrollbar">
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Create Your Story</h1>
        <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed">
          Define your narrative and let Gemini analyze the visual beats. High-end AI-driven panel generation starts with your script.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start pb-24">
        {/* Left Column: Narrative Input */}
        <section className="lg:col-span-7">
          <div className="bg-surface-container-lowest rounded-[2rem] p-10 premium-shadow border border-outline-variant/10">
            <div className="flex items-center gap-3 mb-8">
              <Edit3 size={24} className="text-primary" />
              <h2 className="text-2xl font-bold tracking-tight">Narrative Input</h2>
            </div>

            <div className="space-y-8">
              <div className="relative">
                <textarea
                  className="w-full h-80 bg-surface-container-low border-none rounded-2xl p-8 text-on-surface placeholder:text-on-surface-variant/30 focus:ring-0 focus:bg-surface-container-lowest transition-all duration-300 resize-none text-lg leading-relaxed"
                  placeholder="Paste your narrative text or script here (Up to 5000 words)..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">Comic Style</label>
                  <div className="relative">
                    <select className="w-full appearance-none bg-surface-container-low border-none rounded-2xl px-6 py-4 text-on-surface font-semibold focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer">
                      <option value="manga">Manga</option>
                      <option value="western">Western Superhero</option>
                      <option value="noir">Noir Graphic Novel</option>
                      <option value="indie">Hand-drawn Indie</option>
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                       <ChevronRight size={18} className="rotate-90 text-on-surface-variant" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">Target Pages</label>
                  <div className="relative">
                    <select className="w-full appearance-none bg-surface-container-low border-none rounded-2xl px-6 py-4 text-on-surface font-semibold focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer">
                      <option value="1">1 Page (Short Action)</option>
                      <option value="3">3 Pages (Mini Chapter)</option>
                      <option value="5">5 Pages (Standard Scene)</option>
                      <option value="12">12+ Pages (Issue)</option>
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                       <ChevronRight size={18} className="rotate-90 text-on-surface-variant" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: AI Analysis */}
        <aside className="lg:col-span-5 sticky top-24">
          <div className="bg-surface-container-low/50 rounded-[2rem] p-10 border border-outline-variant/10 min-h-[460px] flex flex-col group">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <Wand2 size={24} className="text-primary animate-pulse" />
                <h2 className="text-2xl font-bold tracking-tight">AI Story Analysis</h2>
              </div>
              <span className="text-[10px] font-bold px-3 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-widest">Live</span>
            </div>

            <div className="space-y-8 flex-grow">
              <p className="text-on-surface-variant font-medium flex items-center gap-3 text-sm">
                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Gemini is analyzing scenes and extracting characters...
              </p>

              {/* Skeletons */}
              <div className="space-y-6">
                <div className="space-y-3">
                   <div className="h-4 bg-surface-container-high rounded-full w-3/4 opacity-40" />
                   <div className="h-4 bg-surface-container-high rounded-full w-1/2 opacity-30" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="aspect-square bg-surface-container-high rounded-2xl flex items-center justify-center opacity-40">
                    <div className="w-10 h-10 bg-white/20 rounded-full" />
                  </div>
                  <div className="aspect-square bg-surface-container-high rounded-2xl flex items-center justify-center opacity-40">
                    <div className="w-10 h-10 bg-white/20 rounded-xl" />
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                   <div className="h-2 bg-surface-container-high rounded-full w-full opacity-20" />
                   <div className="h-2 bg-surface-container-high rounded-full w-5/6 opacity-20" />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-outline-variant/10 text-center">
              <p className="text-xs text-on-surface-variant/50 italic font-medium tracking-tight">Refining story beats for optimal visual continuity...</p>
            </div>
          </div>

          <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white shadow-xl shadow-primary/20 flex gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
               <Zap size={20} fill="currentColor" />
            </div>
            <div>
              <p className="font-bold text-sm mb-1">Pro Tip</p>
              <p className="text-xs opacity-80 leading-relaxed">Describe characters clearly in your text for better AI character sheet generation in the next step.</p>
            </div>
          </div>
        </aside>
      </div>

      {/* Stepper Footer */}
      <div className="fixed bottom-0 left-64 right-0 h-24 bg-white/90 backdrop-blur-xl border-t border-outline-variant/10 px-10 flex items-center justify-around z-[40] font-bold">
        <div className="flex gap-12">
          <div className="flex flex-col items-center justify-center text-primary">
            <Edit3 size={20} />
            <span className="text-[10px] uppercase tracking-widest mt-2">Story</span>
          </div>
          <div className="flex flex-col items-center justify-center text-on-surface-variant opacity-40 hover:opacity-100 transition-opacity cursor-pointer">
            <LayoutTemplate size={20} />
            <span className="text-[10px] uppercase tracking-widest mt-2">Analysis</span>
          </div>
          <div className="flex flex-col items-center justify-center text-on-surface-variant opacity-40 hover:opacity-100 transition-opacity cursor-pointer">
            <Layers size={20} />
            <span className="text-[10px] uppercase tracking-widest mt-2">Canvas</span>
          </div>
          <div className="flex flex-col items-center justify-center text-on-surface-variant opacity-40 hover:opacity-100 transition-opacity cursor-pointer">
             <MousePointer2 size={20} />
            <span className="text-[10px] uppercase tracking-widest mt-2">Export</span>
          </div>
        </div>
        
        <button className="bg-surface-container-high text-on-surface-variant/40 px-10 py-4 rounded-xl flex items-center gap-3 cursor-not-allowed">
           Next: Character Setup
           <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
