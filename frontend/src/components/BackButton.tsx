'use client';

import { useRouter } from 'next/navigation';

// Returns to whatever page actually linked here (e.g. /login or /register),
// instead of hardcoding a destination — falls back to '/' if there's no
// prior page in history (e.g. the link was opened directly).
export default function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
        } else {
          router.push('/');
        }
      }}
      className="text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface"
    >
      ← Back
    </button>
  );
}
