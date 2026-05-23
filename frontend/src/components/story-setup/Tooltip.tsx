import React from 'react';

interface TooltipProps {
  content: string;
  ariaLabel?: string;
}

export default function Tooltip({ content, ariaLabel }: TooltipProps) {
  return (
    <span className="relative inline-flex items-center group">
      <span
        className="material-symbols-outlined text-base text-gray-400 hover:text-gray-600 focus-visible:text-gray-600"
        aria-label={ariaLabel || 'More information'}
        role="img"
        tabIndex={0}
      >
        info
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-xl bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}

