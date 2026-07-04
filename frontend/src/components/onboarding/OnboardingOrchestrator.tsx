'use client';

import { usePathname } from 'next/navigation';
import { Clapperboard, BookOpen, Users, PenLine, Send } from 'lucide-react';
import { useOnboardingContext } from '@/context/OnboardingContext';
import WelcomeModal from './WelcomeModal';
import SpotlightTour, { type TourStep } from './SpotlightTour';
import OnboardingChecklist from './OnboardingChecklist';

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="comic-pipeline"]',
    title: 'Comic Pipeline — your main tool',
    body: 'This is where the magic happens. The step-by-step pipeline takes your story from text to a published comic.',
    icon: Clapperboard,
  },
  {
    selector: '[data-tour="story-setup"]',
    title: 'Story Setup',
    body: 'Paste or write your story freely here — characters, plot twists, and narrative — before feeding it into the pipeline.',
    icon: BookOpen,
  },
  {
    selector: '[data-tour="character-manager"]',
    title: 'Character Manager',
    body: 'Create and manage characters here. Upload reference images so AI keeps them consistent across every panel.',
    icon: Users,
  },
  {
    selector: '[data-tour="comic-editor"]',
    title: 'Comic Editor',
    body: 'After generating, polish your comic here — add dialogue, adjust panels, and touch up pages.',
    icon: PenLine,
  },
  {
    selector: '[data-tour="publish"]',
    title: 'Publish & Share',
    body: 'Share your finished comic as a public web reader link.',
    icon: Send,
  },
];

export default function OnboardingOrchestrator() {
  const pathname = usePathname();
  const { state, isLoaded, setWelcomeSeen, skipTour, nextTourStep, setTourStep, completeTour } =
    useOnboardingContext();

  if (!isLoaded || !pathname?.startsWith('/studio')) return null;

  const isFirstVisit = !state.welcomeSeen;
  const showTour =
    state.welcomeSeen && !state.tourCompleted && !state.skipped && pathname === '/studio/dashboard';

  return (
    <>
      <WelcomeModal
        isOpen={isFirstVisit}
        onStartTour={setWelcomeSeen}
        onSkip={() => {
          setWelcomeSeen();
          skipTour();
        }}
      />

      {showTour && (
        <SpotlightTour
          steps={TOUR_STEPS}
          currentStep={Math.min(state.currentStep, TOUR_STEPS.length - 1)}
          onNext={nextTourStep}
          onPrev={() => setTourStep(Math.max(0, state.currentStep - 1))}
          onSkip={skipTour}
          onComplete={completeTour}
        />
      )}

      {state.welcomeSeen && !showTour && <OnboardingChecklist />}
    </>
  );
}
