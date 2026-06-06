'use client';

import { useCallback, useEffect, useState } from 'react';

export interface SavedStory {
  id: string;
  title: string;
  projectId: string;
  storyText: string;
  adaptedStory: string | null;
  genre: string;
  creativeDirection: string;
  analysisResult: {
    sceneBeats: number;
    chars: string[];
    tone: string[];
    panels: number;
  } | null;
  savedAt: string; // ISO date
}

const LIBRARY_KEY = 'mohiom-story-library';

function readLibrary(): SavedStory[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LIBRARY_KEY);
    return raw ? (JSON.parse(raw) as SavedStory[]) : [];
  } catch {
    return [];
  }
}

function writeLibrary(stories: SavedStory[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(stories));
  } catch { /* localStorage full — silently skip */ }
}

export function useStoryLibrary() {
  const [stories, setStories] = useState<SavedStory[]>([]);

  useEffect(() => {
    setStories(readLibrary());
  }, []);

  const save = useCallback((story: Omit<SavedStory, 'id' | 'savedAt'>): SavedStory => {
    const newStory: SavedStory = {
      ...story,
      id: `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      savedAt: new Date().toISOString(),
    };
    setStories((prev) => {
      const next = [newStory, ...prev];
      writeLibrary(next);
      return next;
    });
    return newStory;
  }, []);

  const remove = useCallback((id: string) => {
    setStories((prev) => {
      const next = prev.filter((s) => s.id !== id);
      writeLibrary(next);
      return next;
    });
  }, []);

  const duplicate = useCallback((id: string) => {
    setStories((prev) => {
      const original = prev.find((s) => s.id === id);
      if (!original) return prev;
      const copy: SavedStory = {
        ...original,
        id: `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: `${original.title} (copy)`,
        savedAt: new Date().toISOString(),
      };
      const next = [copy, ...prev];
      writeLibrary(next);
      return next;
    });
  }, []);

  const getById = useCallback((id: string): SavedStory | null => {
    return stories.find((s) => s.id === id) ?? null;
  }, [stories]);

  return { stories, save, remove, duplicate, getById };
}