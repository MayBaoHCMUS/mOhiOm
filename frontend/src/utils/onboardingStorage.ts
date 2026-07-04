const STORAGE_KEY = 'mohiom-onboarding-state';
const STATE_VERSION = 1;

export interface OnboardingChecklistItems {
  createStory: boolean;
  runPipeline: boolean;
  generateImage: boolean;
  addDialogue: boolean;
  publishComic: boolean;
}

export interface OnboardingState {
  version: number;
  completed: boolean;
  skipped: boolean;
  currentStep: number;
  welcomeSeen: boolean;
  tourCompleted: boolean;
  checklistItems: OnboardingChecklistItems;
  startedAt: string;
  completedAt?: string;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  version: STATE_VERSION,
  completed: false,
  skipped: false,
  currentStep: 0,
  welcomeSeen: false,
  tourCompleted: false,
  checklistItems: {
    createStory: false,
    runPipeline: false,
    generateImage: false,
    addDialogue: false,
    publishComic: false,
  },
  startedAt: new Date().toISOString(),
};

const isOnboardingState = (value: unknown): value is OnboardingState => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<OnboardingState>;
  return (
    typeof v.version === 'number' &&
    typeof v.completed === 'boolean' &&
    typeof v.welcomeSeen === 'boolean' &&
    typeof v.checklistItems === 'object' &&
    v.checklistItems !== null
  );
};

export const loadOnboardingState = (): OnboardingState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ONBOARDING_STATE, startedAt: new Date().toISOString() };
    const parsed = JSON.parse(raw);
    if (!isOnboardingState(parsed) || parsed.version !== STATE_VERSION) {
      return { ...DEFAULT_ONBOARDING_STATE, startedAt: new Date().toISOString() };
    }
    return { ...DEFAULT_ONBOARDING_STATE, ...parsed, checklistItems: { ...DEFAULT_ONBOARDING_STATE.checklistItems, ...parsed.checklistItems } };
  } catch {
    return { ...DEFAULT_ONBOARDING_STATE, startedAt: new Date().toISOString() };
  }
};

export const saveOnboardingState = (state: OnboardingState): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop — private browsing / quota exceeded */
  }
};

export const clearOnboardingState = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
};
