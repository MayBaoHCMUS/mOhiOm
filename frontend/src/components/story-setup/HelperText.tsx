import React from 'react';

interface HelperTextProps {
  id: string;
  text: string;
  tone?: 'muted' | 'warning';
}

export default function HelperText({ id, text, tone = 'muted' }: HelperTextProps) {
  const toneClass = tone === 'warning' ? 'text-amber-600' : 'text-gray-500';
  return (
    <p id={id} className={`mt-2 text-xs ${toneClass}`}>
      {text}
    </p>
  );
}

