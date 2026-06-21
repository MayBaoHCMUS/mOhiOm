'use client';

import React from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';

export default function GenerationModeModal() {
  const { setComicPageMode } = useComicGeneration();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 space-y-6 animate-slide-down">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Step 4 — Generate</p>
          <h2 className="text-2xl font-bold text-gray-900">Choose generation mode</h2>
          <p className="text-sm text-gray-500">
            This determines how images are created and how you can control the layout.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Full Page */}
          <button
            type="button"
            onClick={() => setComicPageMode('page')}
            className="group text-left p-6 rounded-2xl border-2 border-gray-200 hover:border-primary/60 hover:bg-primary/5 transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <div className="text-4xl mb-3">📄</div>
            <p className="text-base font-bold text-gray-900 group-hover:text-primary transition-colors">Full Page</p>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              One image per comic page. Faster to generate — great for quick drafts or when panel composition is less critical.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">Faster</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">Whole-page composition</span>
            </div>
          </button>

          {/* Panel by Panel */}
          <button
            type="button"
            onClick={() => setComicPageMode('panel')}
            className="group text-left p-6 rounded-2xl border-2 border-gray-200 hover:border-violet-400 hover:bg-violet-50/50 transition-all focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            <div className="text-4xl mb-3">⊞</div>
            <p className="text-base font-bold text-gray-900 group-hover:text-violet-700 transition-colors">Panel by Panel</p>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              One image per panel. Full control over layout templates, framing, and per-panel regeneration.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-700">Full control</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">Manga layouts</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">Dialogue overlay</span>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
          Your AI image prompts were automatically created during the Panel-by-panel script step (Step 4).
          You can edit individual prompts by clicking any panel on the canvas.
        </p>
      </div>
    </div>
  );
}
