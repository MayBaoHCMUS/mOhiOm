'use client';

import { useState } from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';

export default function GenerationModeModal() {
  const { setComicPageMode, sfxMode, setSfxMode } = useComicGeneration();
  const [selected, setSelected] = useState<'page' | 'panel'>('page');

  const MODES = [
    {
      mode: 'page' as const,
      icon: 'auto_awesome_mosaic',
      title: 'Full Page',
      desc: 'One composite image per page. The AI arranges all panels together in a manga layout.',
      tags: [{ label: 'Faster', color: 'bg-emerald-100 text-emerald-700' }, { label: 'Full layout', color: 'bg-gray-100 text-gray-600' }],
    },
    {
      mode: 'panel' as const,
      icon: 'dashboard',
      title: 'Panel by Panel',
      desc: 'One image per panel. You control layout templates, framing, and can regenerate each panel individually.',
      tags: [{ label: 'Full control', color: 'bg-violet-100 text-violet-700' }, { label: 'Manga layouts', color: 'bg-gray-100 text-gray-600' }],
    },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-8 space-y-6">

        <div className="text-center space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-on-surface-variant">Step 5 — Generate</p>
          <h2 className="text-2xl font-bold text-on-surface">Choose generation mode</h2>
          <p className="text-sm text-on-surface-variant">
            How should the AI create your comic images?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {MODES.map(({ mode, icon, title, desc, tags }) => {
            const active = selected === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSelected(mode)}
                className="relative text-left p-5 rounded-2xl border-2 transition-all focus:outline-none"
                style={{
                  borderColor: active ? '#4F46E5' : '#E5E7EB',
                  background: active ? '#EEF2FF' : '#FFFFFF',
                }}
              >
                {active && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#4F46E5' }}>
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 13 }}>check</span>
                  </span>
                )}
                <span
                  className="material-symbols-outlined block mb-3"
                  style={{ fontSize: 28, color: active ? '#4F46E5' : '#6B7280' }}
                >
                  {icon}
                </span>
                <p className="text-sm font-bold mb-1" style={{ color: active ? '#4F46E5' : '#111827' }}>{title}</p>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-3">{desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(t => (
                    <span key={t.label} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${t.color}`}>{t.label}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Clean images toggle */}
        <label className="flex items-start gap-3 cursor-pointer select-none group p-3 rounded-xl hover:bg-surface-container-low transition-colors">
          <div className="flex-none mt-0.5">
            <input
              type="checkbox"
              className="sr-only"
              checked={sfxMode === 'manual'}
              onChange={(e) => setSfxMode(e.target.checked ? 'manual' : 'auto')}
            />
            <div
              className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
              style={{
                borderColor: sfxMode === 'manual' ? '#4F46E5' : '#D1D5DB',
                background: sfxMode === 'manual' ? '#4F46E5' : '#FFFFFF',
              }}
            >
              {sfxMode === 'manual' && (
                <span className="material-symbols-outlined text-white" style={{ fontSize: 11 }}>check</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface leading-snug">Clean images (no dialogue/SFX text)</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Add speech bubbles manually in the Dialogue step after generation
            </p>
          </div>
        </label>

        <button
          type="button"
          onClick={() => setComicPageMode(selected)}
          className="w-full h-12 rounded-full text-sm font-bold text-white transition-all hover:brightness-110"
          style={{ background: 'linear-gradient(to right, #4F46E5, #7C3AED)', boxShadow: '0 4px 20px rgba(79,70,229,0.35)' }}
        >
          Start with {selected === 'page' ? 'Full Page' : 'Panel by Panel'} →
        </button>

      </div>
    </div>
  );
}
