import React from 'react';

interface Preset {
  label: string;
  value: number;
}

interface PresetButtonsProps {
  presets: Preset[];
  onSelect: (value: number) => void;
}

export default function PresetButtons({ presets, onSelect }: PresetButtonsProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {presets.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => onSelect(preset.value)}
          className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition-colors hover:border-blue-500 hover:text-blue-600"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

