'use client';

import { useEffect } from 'react';
import GalleryContent from '@/components/gallery/GalleryContent';

export function GalleryModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-surface rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 md:p-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center transition-colors z-10"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
        <GalleryContent />
      </div>
    </div>
  );
}
