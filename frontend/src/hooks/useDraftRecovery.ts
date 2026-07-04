import { useCallback, useEffect, useState } from 'react';
import type { DraftPayload } from '@/components/story-setup/types';
import { clearDraft, loadDraft } from '@/utils/draftStorage';

export const useDraftRecovery = (saveKey: string, currentContent: string) => {
  const [draft, setDraft] = useState<DraftPayload | null>(null);

  useEffect(() => {
    const stored = loadDraft(saveKey);
    if (stored && stored.content.trim() && stored.content.trim() !== currentContent.trim()) {
      setDraft(stored);
    }
  }, [currentContent, saveKey]);

  const restoreDraft = useCallback(() => {
    const stored = loadDraft(saveKey);
    if (stored) {
      setDraft(stored);
      return stored.content;
    }
    return null;
  }, [saveKey]);

  const discardDraft = useCallback(() => {
    clearDraft(saveKey);
    setDraft(null);
  }, [saveKey]);

  return {
    draft,
    restoreDraft,
    discardDraft,
  };
};

