import React from 'react';
import type { SaveStatus } from '@/components/story-setup/types';

interface SaveIndicatorProps {
  status: SaveStatus;
  isOffline: boolean;
}

export default function SaveIndicator({ status, isOffline }: SaveIndicatorProps) {
  if (isOffline) {
    return (
      <span className="text-xs text-amber-600" role="status">
        ⚠️ Not saved (offline)
      </span>
    );
  }

  if (status.status === 'saving') {
    return (
      <span className="text-xs text-gray-500" role="status">
        💾 Saving...
      </span>
    );
  }

  if (status.status === 'saved' && status.lastSaved) {
    return (
      <span className="text-xs text-emerald-600" role="status">
        ✓ Saved at {status.lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }

  if (status.status === 'error') {
    return (
      <span className="text-xs text-red-600" role="alert">
        {status.error || 'Failed to save'}
      </span>
    );
  }

  return null;
}

