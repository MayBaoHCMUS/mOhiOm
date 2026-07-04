'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onboardingApi, type OnboardingStateDto } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_ONBOARDING_STATE,
  loadOnboardingState,
  saveOnboardingState,
  clearOnboardingState,
  type OnboardingState,
  type OnboardingChecklistItems,
} from '@/utils/onboardingStorage';

const SYNC_DEBOUNCE_MS = 1500;

const toDto = (state: OnboardingState): OnboardingStateDto => ({
  completed: state.completed,
  skipped: state.skipped,
  currentStep: state.currentStep,
  welcomeSeen: state.welcomeSeen,
  tourCompleted: state.tourCompleted,
  createStory: state.checklistItems.createStory,
  runPipeline: state.checklistItems.runPipeline,
  generateImage: state.checklistItems.generateImage,
  addDialogue: state.checklistItems.addDialogue,
  publishComic: state.checklistItems.publishComic,
  startedAt: state.startedAt,
  completedAt: state.completedAt ?? null,
});

const fromDto = (dto: OnboardingStateDto, fallback: OnboardingState): OnboardingState => ({
  ...fallback,
  completed: dto.completed,
  skipped: dto.skipped,
  currentStep: dto.currentStep,
  welcomeSeen: dto.welcomeSeen,
  tourCompleted: dto.tourCompleted,
  checklistItems: {
    createStory: dto.createStory,
    runPipeline: dto.runPipeline,
    generateImage: dto.generateImage,
    addDialogue: dto.addDialogue,
    publishComic: dto.publishComic,
  },
  startedAt: dto.startedAt || fallback.startedAt,
  completedAt: dto.completedAt || undefined,
});

// A server document only exists once at least one field has been written —
// an all-defaults response means "no server state yet", so local wins in that case.
const isMeaningfulServerState = (dto: OnboardingStateDto): boolean =>
  dto.welcomeSeen || dto.tourCompleted || dto.completed || dto.skipped ||
  dto.createStory || dto.runPipeline || dto.generateImage || dto.addDialogue || dto.publishComic;

type OnboardingContextValue = {
  state: OnboardingState;
  isLoaded: boolean;
  markChecklistItem: (item: keyof OnboardingChecklistItems) => void;
  setWelcomeSeen: () => void;
  setTourStep: (step: number) => void;
  nextTourStep: () => void;
  completeTour: () => void;
  skipTour: () => void;
  resetOnboarding: () => void;
  completedCount: number;
  totalCount: number;
  progressPct: number;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const syncTimerRef = useRef<number | null>(null);
  const hasPulledRef = useRef(false);

  useEffect(() => {
    setState(loadOnboardingState());
    setIsLoaded(true);
  }, []);

  // Pull server state once per authenticated session and reconcile with local.
  useEffect(() => {
    if (!isLoaded || !user?.id || hasPulledRef.current) return;
    hasPulledRef.current = true;

    void (async () => {
      try {
        const response = await onboardingApi.getState();
        const dto = response.data;
        if (!isMeaningfulServerState(dto)) return;
        setState((prev) => {
          const merged = fromDto(dto, prev);
          saveOnboardingState(merged);
          return merged;
        });
      } catch {
        // offline or no saved state yet — keep local state
      }
    })();
  }, [isLoaded, user?.id]);

  // Write-through to localStorage immediately, debounce the backend push.
  useEffect(() => {
    if (!isLoaded) return;
    saveOnboardingState(state);

    if (!user?.id) return;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      void onboardingApi.saveState(toDto(state)).catch(() => {
        /* offline — next mutation will retry */
      });
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [state, isLoaded, user?.id]);

  const markChecklistItem = useCallback((item: keyof OnboardingChecklistItems) => {
    setState((prev) => {
      if (prev.checklistItems[item]) return prev;
      const checklistItems = { ...prev.checklistItems, [item]: true };
      const allDone = Object.values(checklistItems).every(Boolean);
      return {
        ...prev,
        checklistItems,
        completed: allDone,
        completedAt: allDone ? new Date().toISOString() : prev.completedAt,
      };
    });
  }, []);

  const setWelcomeSeen = useCallback(() => {
    setState((prev) => (prev.welcomeSeen ? prev : { ...prev, welcomeSeen: true }));
  }, []);

  const setTourStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const nextTourStep = useCallback(() => {
    setState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }));
  }, []);

  const completeTour = useCallback(() => {
    setState((prev) => (prev.tourCompleted ? prev : { ...prev, tourCompleted: true }));
  }, []);

  const skipTour = useCallback(() => {
    setState((prev) => (prev.tourCompleted && prev.skipped ? prev : { ...prev, tourCompleted: true, skipped: true }));
  }, []);

  const resetOnboarding = useCallback(() => {
    clearOnboardingState();
    hasPulledRef.current = false;
    const fresh = { ...DEFAULT_ONBOARDING_STATE, startedAt: new Date().toISOString() };
    setState(fresh);
    if (user?.id) {
      void onboardingApi.saveState(toDto(fresh)).catch(() => {
        /* offline — local reset already applied */
      });
    }
  }, [user?.id]);

  const completedCount = useMemo(
    () => Object.values(state.checklistItems).filter(Boolean).length,
    [state.checklistItems]
  );
  const totalCount = Object.keys(state.checklistItems).length;

  const value = useMemo<OnboardingContextValue>(
    () => ({
      state,
      isLoaded,
      markChecklistItem,
      setWelcomeSeen,
      setTourStep,
      nextTourStep,
      completeTour,
      skipTour,
      resetOnboarding,
      completedCount,
      totalCount,
      progressPct: totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100),
    }),
    [state, isLoaded, markChecklistItem, setWelcomeSeen, setTourStep, nextTourStep, completeTour, skipTour, resetOnboarding, completedCount, totalCount]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingContext() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboardingContext must be used within OnboardingProvider');
  }
  return ctx;
}
