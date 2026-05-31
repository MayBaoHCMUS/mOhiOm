'use client';

import React, { useState } from 'react';
import type { ImageGenMode, ImageGenSettings } from '@/context/ComicGenerationContext';

const MODES: { id: ImageGenMode; label: string }[] = [
  { id: 1, label: 'Text only' },
  { id: 2, label: '+ Reference' },
  { id: 3, label: '+ Pose' },
  { id: 4, label: 'Full' },
];

const DEFAULT_SETTINGS: ImageGenSettings = {
  mode: 1,
  referenceImageBase64: '',
  controlImageBase64: '',
  ipAdapterScale: 0.7,
  controlnetScale: 0.8,
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Props {
  disabled?: boolean;
  value: ImageGenSettings;
  onChange: (settings: ImageGenSettings) => void;
}

export default function CharacterModePanel({ disabled, value, onChange }: Props) {
  const [refName, setRefName] = useState('');
  const [ctrlName, setCtrlName] = useState('');

  const set = (patch: Partial<ImageGenSettings>) => onChange({ ...value, ...patch });

  const handleRefFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    set({ referenceImageBase64: await readFileAsBase64(file) });
    setRefName(file.name);
  };

  const handleCtrlFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    set({ controlImageBase64: await readFileAsBase64(file) });
    setCtrlName(file.name);
  };

  const showRef = value.mode === 2 || value.mode === 4;
  const showCtrl = value.mode === 3 || value.mode === 4;

  return (
    <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
      {/* Mode tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => set({ mode: id })}
            disabled={disabled}
            className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-all ${
              value.mode === id
                ? 'bg-gray-900 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Reference image (modes 2 & 4) */}
      {showRef && (
        <div className="mt-2.5 space-y-1.5">
          <p className="text-[11px] font-semibold text-gray-600">
            Reference <span className="font-normal text-gray-400">(keeps appearance)</span>
          </p>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-xs text-gray-500 transition-colors hover:border-gray-400">
            <span className="material-symbols-outlined text-base text-gray-400">add_photo_alternate</span>
            <span className="truncate">{refName || 'Upload reference image'}</span>
            <input type="file" accept="image/*" className="hidden" disabled={disabled} onChange={handleRefFile} />
          </label>
          {value.referenceImageBase64 ? (
            <div className="flex items-center gap-2">
              <img
                src={`data:image/png;base64,${value.referenceImageBase64}`}
                alt="ref"
                className="h-10 w-10 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => { set({ referenceImageBase64: '' }); setRefName(''); }}
                className="text-[11px] text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="min-w-[110px] text-[11px] text-gray-500">
              IP scale: <span className="font-semibold">{value.ipAdapterScale.toFixed(1)}</span>
            </span>
            <input
              type="range" min={0.1} max={1.0} step={0.1}
              value={value.ipAdapterScale}
              onChange={(e) => set({ ipAdapterScale: Number(e.target.value) })}
              disabled={disabled}
              className="flex-1 accent-gray-900"
            />
          </div>
        </div>
      )}

      {/* Control/Pose image (modes 3 & 4) */}
      {showCtrl && (
        <div className="mt-2.5 space-y-1.5">
          <p className="text-[11px] font-semibold text-gray-600">
            Pose/Control <span className="font-normal text-gray-400">(keeps structure)</span>
          </p>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-xs text-gray-500 transition-colors hover:border-gray-400">
            <span className="material-symbols-outlined text-base text-gray-400">add_photo_alternate</span>
            <span className="truncate">{ctrlName || 'Upload pose / control image'}</span>
            <input type="file" accept="image/*" className="hidden" disabled={disabled} onChange={handleCtrlFile} />
          </label>
          {value.controlImageBase64 ? (
            <div className="flex items-center gap-2">
              <img
                src={`data:image/png;base64,${value.controlImageBase64}`}
                alt="ctrl"
                className="h-10 w-10 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => { set({ controlImageBase64: '' }); setCtrlName(''); }}
                className="text-[11px] text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="min-w-[110px] text-[11px] text-gray-500">
              CN scale: <span className="font-semibold">{value.controlnetScale.toFixed(1)}</span>
            </span>
            <input
              type="range" min={0.1} max={1.0} step={0.1}
              value={value.controlnetScale}
              onChange={(e) => set({ controlnetScale: Number(e.target.value) })}
              disabled={disabled}
              className="flex-1 accent-gray-900"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export { DEFAULT_SETTINGS };
export type { Props as CharacterModePanelProps };