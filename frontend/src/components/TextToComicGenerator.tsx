'use client';

import React, { useEffect } from 'react';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { ComicGenerationProvider, StepKey, WizardStepKey, useComicGeneration } from '@/context/ComicGenerationContext';
import { useOnboardingContext } from '@/context/OnboardingContext';
import Step0Setup from '@/components/studio-steps/Step0Setup';
import Step1Analysis from '@/components/studio-steps/Step1Analysis';
import Step2Characters from '@/components/studio-steps/Step2Characters';
import Step3Script from '@/components/studio-steps/Step3Script';
import Step4Generation from '@/components/studio-steps/Step4Generation';
import Step5Export from '@/components/studio-steps/Step5Export';

const wizardSteps = [
  { key: 0, label: 'Setup',      subtitle: 'Project configuration',      Component: Step0Setup },
  { key: 1, label: 'Analysis',   subtitle: 'Story breakdown',            Component: Step1Analysis },
  { key: 2, label: 'Characters', subtitle: 'Designs and references',     Component: Step2Characters },
  { key: 3, label: 'Script',     subtitle: 'Panel-by-panel script',      Component: Step3Script },
  { key: 4, label: 'Generate',   subtitle: 'Layout & image generation',  Component: Step4Generation },
  { key: 5, label: 'Export',     subtitle: 'Export & finish',            Component: Step5Export },
] as const;

function WizardContent() {
  const { activeStep, setActiveStep, stepMap, setupValidation, handleGenerate, step1 } = useComicGeneration();
  const { markChecklistItem } = useOnboardingContext();

  useEffect(() => {
    if (activeStep === 4) markChecklistItem('runPipeline');
  }, [activeStep, markChecklistItem]);

  const current = wizardSteps.find((step) => step.key === activeStep) ?? wizardSteps[0];
  const CurrentComponent = current.Component;

  const isLastStep = activeStep === wizardSteps.length - 1;

  // Step 0: enabled when all required fields are complete (loading is OK — clicking navigates to watch the stream)
  // Steps 1–4: enabled when the current step is approved
  const isNextDisabled =
    activeStep === 0
      ? !setupValidation?.isValid
      : !stepMap[activeStep as StepKey]?.isApproved;

  const nextTooltip = isNextDisabled
    ? activeStep === 0
      ? 'Complete all required fields to continue'
      : activeStep === 1 && step1.isLoading
        ? 'Wait for analysis to complete'
        : 'Approve this step to continue'
    : undefined;

  // Step 0 label is context-aware: reflects whether generation will happen
  const nextLabel =
    activeStep === 0
      ? step1.isLoading
        ? 'Analyzing…'
        : step1.data
          ? 'Next Step'
          : 'Generate analysis'
      : 'Next Step';

  const handlePrevious = () => {
    if (activeStep === 0) return;
    setActiveStep((activeStep - 1) as WizardStepKey);
  };

  const handleNext = () => {
    if (isNextDisabled || isLastStep) return;
    if (activeStep === 0) {
      // Fire generation only if not already running and no analysis exists
      if (!step1.isLoading && !step1.data) {
        handleGenerate(1);
      }
      markChecklistItem('createStory');
      setActiveStep(1); // advance immediately so user watches the stream on Step 1
      return;
    }
    setActiveStep((activeStep + 1) as WizardStepKey);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />

      <main className="ml-[var(--studio-sidebar-width)] pt-24 min-h-screen pb-28">
        <div className="px-4 sm:px-8 lg:px-10 py-6 lg:py-10 max-w-6xl mx-auto">
          <section className="bg-white text-gray-900 rounded-3xl p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Comic Studio Wizard</p>
                <h1 className="text-2xl sm:text-3xl font-semibold">Text-to-Comic Pipeline</h1>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">Step {activeStep + 1} of {wizardSteps.length}</div>
              </div>
            </div>

            <div className="mt-6 sm:mt-8">
              <div className="flex items-start gap-2 sm:gap-4 overflow-x-auto pb-2 hide-scrollbar">
                {wizardSteps.map((step, index) => {
                  const isActive = step.key === activeStep;
                  const isComplete = step.key < activeStep;
                  const isLocked = step.key >= 1 && step.key !== activeStep && stepMap[step.key as StepKey]?.locked;

                  return (
                    <div key={step.key} className="flex-1 min-w-[100px] sm:min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => !isLocked && setActiveStep(step.key)}
                          className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition-transform ${
                            isLocked
                              ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                              : isComplete
                                ? 'border-emerald-500 bg-emerald-500 text-white hover:scale-105'
                                : isActive
                                  ? 'border-blue-600 bg-blue-600 text-white hover:scale-105'
                                  : 'border-gray-300 text-gray-400 hover:scale-105'
                          }`}
                          aria-current={isActive ? 'step' : undefined}
                          disabled={isLocked}
                        >
                          {isComplete ? (
                            <span className="material-symbols-outlined text-base">check</span>
                          ) : (
                            <span className="text-xs font-semibold">{index + 1}</span>
                          )}
                        </button>
                        {index < wizardSteps.length - 1 && (
                          <div className={`h-1 w-full rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                        )}
                      </div>
                      <div className="mt-4">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-gray-400">Step {index + 1}</p>
                        <p className="text-sm font-semibold text-gray-900">{step.subtitle}</p>
                        <p className={`text-xs mt-1 ${isComplete ? 'text-emerald-600' : isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                          {isComplete ? 'Completed' : isActive ? 'In Progress' : 'Pending'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mt-8">
            <CurrentComponent />
          </section>
        </div>
      </main>

      {/* Sticky bottom navigation bar — hidden on steps that own their action bar */}
      {activeStep !== 1 && activeStep !== 2 && activeStep !== 3 && activeStep !== 4 && activeStep !== 5 && <div className="fixed bottom-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        style={{ left: 'var(--studio-sidebar-width)' }}>
        <div className="px-4 sm:px-8 lg:px-10 py-4 max-w-6xl mx-auto flex items-center justify-between">
          {/* Previous Step — hidden on Step 1, ghost on Steps 2–5 */}
          {activeStep > 0 ? (
            <button
              type="button"
              onClick={handlePrevious}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Previous Step
            </button>
          ) : (
            <div />
          )}

          {/* Next Step — primary emerald, with tooltip when disabled */}
          {!isLastStep && (
            <div className="relative group">
              <button
                type="button"
                onClick={handleNext}
                disabled={isNextDisabled}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-transform border-2 border-transparent ${
                  isNextDisabled
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-105 t-next-border'
                }`}
              >
                {nextLabel}
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
              {nextTooltip && (
                <div className="absolute bottom-full right-0 mb-2.5 hidden group-hover:block z-50 pointer-events-none">
                  <div className="bg-gray-900 text-white rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                    {nextTooltip}
                  </div>
                  <div className="w-2.5 h-2.5 bg-gray-900 rotate-45 ml-auto mr-4 -mt-1.5" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}

interface TextToComicGeneratorProps {
  initialProjectId?: string | null;
}

export default function TextToComicGenerator({ initialProjectId }: TextToComicGeneratorProps = {}) {
  return (
    <ComicGenerationProvider initialProjectId={initialProjectId}>
      <WizardContent />
    </ComicGenerationProvider>
  );
}
