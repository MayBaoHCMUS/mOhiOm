import React, { useMemo } from 'react';

interface CharacterWordCounterProps {
  value: string;
  maxLength: number;
  minLength?: number;
}

export default function CharacterWordCounter({ value, maxLength, minLength = 0 }: CharacterWordCounterProps) {
  const characterCount = value.length;
  const wordCount = useMemo(() => value.trim().split(/\s+/).filter(Boolean).length, [value]);
  const percent = Math.min((characterCount / maxLength) * 100, 100);

  const toneClass = percent >= 95 ? 'text-red-600' : percent >= 80 ? 'text-amber-600' : 'text-gray-500';
  const limitLabel = `${characterCount.toLocaleString()} / ${maxLength.toLocaleString()} characters`;

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className={toneClass}>
        {characterCount.toLocaleString()} characters | {wordCount.toLocaleString()} words
      </span>
      <span className={toneClass}>
        {limitLabel}
        {characterCount < minLength ? ` (min ${minLength.toLocaleString()})` : ''}
      </span>
    </div>
  );
}

