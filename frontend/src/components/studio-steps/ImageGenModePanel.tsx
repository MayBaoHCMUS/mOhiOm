'use client';

import React, { useState } from 'react';
import { useComicGeneration } from '@/context/ComicGenerationContext';
import type { ImageGenMode } from '@/context/ComicGenerationContext';

const MODES: { id: ImageGenMode; label: string; desc: string }[] = [
  { id: 1, label: 'Text only', desc: 'Prompt → image' },
  { id: 2, label: 'Text + Reference', desc: 'Keep appearance' },
  { id: 3, label: 'Text + Pose', desc: 'Keep structure' },
  { id: 4, label: 'All inputs', desc: 'Reference + Pose' },
];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageGenModePanel({ disabled }: { disabled?: boolean }) {
  const {
    imageGenMode,
    referenceImageBase64,
    controlImageBase64,
    ipAdapterScale,
    controlnetScale,
    setImageGenMode,
    setReferenceImageBase64,
    setControlImageBase64,
    setIpAdapterScale,
    setControlnetScale,
  } = useComicGeneration();

  const [referenceImageName, setReferenceImageName] = useState('');
  const [controlImageName, setControlImageName] = useState('');

  const handleReferenceImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReferenceImageBase64(await readFileAsBase64(file));
    setReferenceImageName(file.name);
  };

  const handleControlImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setControlImageBase64(await readFileAsBase64(file));
    setControlImageName(file.name);
  };

  const showReference = imageGenMode === 2 || imageGenMode === 4;
  const showControl = imageGenMode === 3 || imageGenMode === 4;

  return (
    <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
      <p className="text-sm font-semibold text-gray-900">Generation mode</p>
      <p className="mt-0.5 text-xs text-gray-500">Controls how the model uses reference or pose images when generating.</p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODES.map(({ id, label, desc }) => (
          <button
            key={id}
            type="button"
            onClick={() => setImageGenMode(id)}
            disabled={disabled}
            className={`rounded-2xl px-3 py-2 text-left text-xs font-semibold transition-all ${
              imageGenMode === id
                ? 'bg-gray-900 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <span className="block">{label}</span>
            <span className={`mt-0.5 block font-normal ${imageGenMode === id ? 'text-gray-300' : 'text-gray-400'}`}>
              {desc}
            </span>
          </button>
        ))}
      </div>

      {showReference && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-xs font-semibold text-gray-700">
            Reference image{' '}
            <span className="font-normal text-gray-400">(IPAdapter — keeps character appearance)</span>
          </p>
          <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-3 transition-colors hover:border-gray-400">
            <span className="material-symbols-outlined text-xl text-gray-400">add_photo_alternate</span>
            <span className="text-sm text-gray-600">{referenceImageName || 'Click to upload reference image'}</span>
            <input type="file" accept="image/*" className="hidden" disabled={disabled} onChange={handleReferenceImageChange} />
          </label>
          {referenceImageBase64 ? (
            <div className="mt-2 flex items-center gap-3">
              <img
                src={`data:image/png;base64,${referenceImageBase64}`}
                alt="Reference preview"
                className="h-14 w-14 rounded-xl object-cover"
              />
              <button
                type="button"
                onClick={() => { setReferenceImageBase64(''); setReferenceImageName(''); }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : null}
          <div className="mt-3 flex items-center gap-3">
            <span className="min-w-[140px] text-xs text-gray-600">
              IP Adapter scale: <span className="font-semibold">{ipAdapterScale.toFixed(1)}</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={ipAdapterScale}
              onChange={(e) => setIpAdapterScale(Number(e.target.value))}
              disabled={disabled}
              className="flex-1 accent-gray-900"
            />
          </div>
        </div>
      )}

      {showControl && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-xs font-semibold text-gray-700">
            Control / Pose image{' '}
            <span className="font-normal text-gray-400">(ControlNet — keeps pose or structure)</span>
          </p>
          <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-3 transition-colors hover:border-gray-400">
            <span className="material-symbols-outlined text-xl text-gray-400">add_photo_alternate</span>
            <span className="text-sm text-gray-600">{controlImageName || 'Click to upload control / pose image'}</span>
            <input type="file" accept="image/*" className="hidden" disabled={disabled} onChange={handleControlImageChange} />
          </label>
          {controlImageBase64 ? (
            <div className="mt-2 flex items-center gap-3">
              <img
                src={`data:image/png;base64,${controlImageBase64}`}
                alt="Control preview"
                className="h-14 w-14 rounded-xl object-cover"
              />
              <button
                type="button"
                onClick={() => { setControlImageBase64(''); setControlImageName(''); }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ) : null}
          <div className="mt-3 flex items-center gap-3">
            <span className="min-w-[140px] text-xs text-gray-600">
              ControlNet scale: <span className="font-semibold">{controlnetScale.toFixed(1)}</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={controlnetScale}
              onChange={(e) => setControlnetScale(Number(e.target.value))}
              disabled={disabled}
              className="flex-1 accent-gray-900"
            />
          </div>
        </div>
      )}
    </div>
  );
}