import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SaveStatus } from '@/components/story-setup/types';
import { saveDraft } from '@/utils/draftStorage';

export const useAutosave = (content: string, saveKey: string, interval: number = 30000) => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ status: 'idle' });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const lastSavedRef = useRef('');
  const lastChangeRef = useRef('');

  const hasUnsavedChanges = useMemo(() => content.trim() !== lastSavedRef.current.trim(), [content]);

  const performSave = useCallback(() => {
    try {
      if (!content.trim()) return;
      setSaveStatus({ status: 'saving' });
      const payload = saveDraft(saveKey, content);
      lastSavedRef.current = payload.content;
      setSaveStatus({ status: 'saved', lastSaved: new Date(payload.savedAt) });
    } catch (error) {
      setSaveStatus({ status: 'error', error: error instanceof Error ? error.message : 'Failed to save draft.' });
    }
  }, [content, saveKey]);

  useEffect(() => {
    lastChangeRef.current = content;
  }, [content]);

  useEffect(() => {
    if (interval <= 0) return undefined;
    const timer = window.setInterval(() => {
      if (lastChangeRef.current.trim() && lastChangeRef.current.trim() !== lastSavedRef.current.trim()) {
        performSave();
      }
    }, interval);
    return () => window.clearInterval(timer);
  }, [interval, performSave]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveNow = useCallback(() => {
    if (isOffline) {
      setSaveStatus({ status: 'error', error: 'Not saved (offline).' });
      return;
    }
    performSave();
  }, [isOffline, performSave]);

  return {
    saveStatus,
    saveNow,
    hasUnsavedChanges,
    isOffline,
  };
};
