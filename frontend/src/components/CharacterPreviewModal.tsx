'use client';

import Link from 'next/link';
import type { CharacterSummary } from '@/services/api';

interface Props {
  char: CharacterSummary;
  onClose: () => void;
  /** Omit entirely (e.g. previewing your own character on the dashboard) to hide
   * the "Add to My Library" CTA — it only makes sense for community characters. */
  onAdd?: () => void;
  inLibrary?: boolean;
  adding?: boolean;
  isAuthed?: boolean;
}

export default function CharacterPreviewModal({ char, onClose, onAdd, inLibrary = false, adding = false, isAuthed = false }: Props) {
  // Trait tags parsed from the same prompt string — rendering only, data source unchanged.
  const traits = (char.prompt ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const sourceLabel = char.project_id ? char.project_id.replace(/_/g, ' ') : 'Community';

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full overflow-hidden flex flex-col"
        style={{ maxWidth: 300, maxHeight: '85vh', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', background: '#FFFFFF' }}
      >
        {/* Image area — fixed height; never compressed by a long trait list below */}
        <div className="relative w-full aspect-[3/4] bg-surface-container-high overflow-hidden flex-shrink-0">
          {char.selected_image_url ? (
            <img src={char.selected_image_url} alt={char.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-7xl text-outline-variant">person</span>
            </div>
          )}

          {/* Gradient bridge from image into the content area — dark enough to stay legible over any artwork */}
          <div
            className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.85) 100%)' }}
          />

          {/* Name + source badge, overlaid on the image — kept clear of the content panel's overlap below */}
          <div className="absolute left-3 right-12 bottom-6 flex flex-col gap-1">
            <p
              className="truncate"
              style={{ fontSize: 17, fontWeight: 700, color: '#FFFFFF', textShadow: '0 1px 4px rgba(0,0,0,0.4)', lineHeight: 1.2 }}
            >
              {char.name}
            </p>
            <span
              className="self-start"
              style={{ fontSize: 10, color: '#FFFFFF', background: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: '2px 8px' }}
            >
              {sourceLabel}
            </span>
          </div>

          {/* Close button — 44x44 touch target, floats above the image */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close character preview"
            className="absolute flex items-center justify-center transition-colors hover:bg-black/60"
            style={{
              top: 8, right: 8, width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              zIndex: 10,
            }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Content area — overlaps the image slightly so the gradient is the only seam.
            Scrolls independently so a long trait list (parsed from a detailed AI
            prompt) can't push the modal taller than the viewport. */}
        {(traits.length > 0 || onAdd) && (
          <div
            className="relative bg-surface-container-lowest flex flex-col gap-3 overflow-y-auto"
            style={{
              marginTop: -8,
              borderRadius: '20px 20px 0 0',
              padding: '14px 16px',
              paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
              minHeight: 0,
            }}
          >
            {/* Trait chip tags (parsed from char.prompt) */}
            {traits.length > 0 && (
              <div className="flex flex-wrap" style={{ gap: 5 }}>
                {traits.map((trait, i) => (
                  <span
                    key={`${trait}-${i}`}
                    className="inline-flex"
                    style={{ background: '#F0F0F5', color: '#333', borderRadius: 999, padding: '3px 10px', fontSize: 12 }}
                  >
                    {trait}
                  </span>
                ))}
              </div>
            )}

            {/* Primary CTA — only rendered when the caller wants a "save to library" action */}
            {onAdd && (
              isAuthed ? (
                <button
                  type="button"
                  onClick={onAdd}
                  disabled={inLibrary || adding}
                  aria-label={inLibrary ? 'Already in your library' : 'Add to My Library'}
                  className={`w-full transition-colors ${
                    inLibrary
                      ? 'bg-emerald-100 text-emerald-700 cursor-default'
                      : adding
                      ? 'bg-surface-container text-outline cursor-not-allowed'
                      : 'bg-primary text-on-primary hover:opacity-90'
                  }`}
                  style={{ height: 44, borderRadius: 12, fontSize: 14, fontWeight: 600 }}
                >
                  {inLibrary ? '✓ In Library' : adding ? 'Adding…' : 'Add to My Library'}
                </button>
              ) : (
                <Link
                  href="/login"
                  className="w-full flex items-center justify-center text-center text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition-colors"
                  style={{ height: 44, borderRadius: 12, fontSize: 14, fontWeight: 600 }}
                >
                  Sign in to save
                </Link>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
