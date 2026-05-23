import type { DraftPayload } from '@/components/story-setup/types';

export const loadDraft = (key: string): DraftPayload | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftPayload;
    if (!parsed?.content || !parsed?.savedAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveDraft = (key: string, content: string) => {
  const payload: DraftPayload = {
    content,
    savedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(key, JSON.stringify(payload));
  return payload;
};

export const clearDraft = (key: string) => {
  window.localStorage.removeItem(key);
};

