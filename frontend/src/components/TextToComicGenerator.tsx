'use client';

import React from 'react';
import StudioSidebar from '@/components/StudioSidebar';
import StudioTopBar from '@/components/StudioTopBar';
import { ComicGenerationProvider, StepKey, WizardStepKey, useComicGeneration } from '@/context/ComicGenerationContext';
import Step0Setup from '@/components/studio-steps/Step0Setup';
import Step1Analysis from '@/components/studio-steps/Step1Analysis';
import Step2Characters from '@/components/studio-steps/Step2Characters';
import Step3Script from '@/components/studio-steps/Step3Script';
import Step4Generation from '@/components/studio-steps/Step4Generation';

const wizardSteps = [
  { key: 0, label: 'Setup', subtitle: 'Project configuration', Component: Step0Setup },
  { key: 1, label: 'Analysis', subtitle: 'Story breakdown', Component: Step1Analysis },
  { key: 2, label: 'Characters', subtitle: 'Designs and references', Component: Step2Characters },
  { key: 3, label: 'Script', subtitle: 'Panel-by-panel script', Component: Step3Script },
  { key: 4, label: 'Generation', subtitle: 'Images and export', Component: Step4Generation },
] as const;

function WizardContent() {
  const { activeStep, setActiveStep, stepMap } = useComicGeneration();

  const current = wizardSteps.find((step) => step.key === activeStep) ?? wizardSteps[0];
  const CurrentComponent = current.Component;

  const isNextDisabled =
    activeStep === 4 || (activeStep >= 1 && stepMap[activeStep as StepKey]?.locked);

  const handlePrevious = () => {
    if (activeStep === 0) return;
    setActiveStep((activeStep - 1) as WizardStepKey);
  };

  const handleNext = () => {
    if (isNextDisabled) return;
    setActiveStep((activeStep + 1) as WizardStepKey);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <StudioSidebar />
      <StudioTopBar />

      <main className="ml-[var(--studio-sidebar-width)] pt-24 min-h-screen pb-16">
        <div className="px-10 py-10 max-w-6xl mx-auto">
          <section className="bg-white text-gray-900 rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Comic Studio Wizard</p>
                <h1 className="text-3xl font-semibold">Text-to-Comic Pipeline</h1>
              </div>
              <div className="text-sm text-gray-600">Step {activeStep + 1} of {wizardSteps.length}</div>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-3">
              {wizardSteps.map((step) => {
                const isActive = step.key === activeStep;
                const isLocked = step.key >= 1 && step.key !== activeStep && stepMap[step.key as StepKey]?.locked;
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => !isLocked && setActiveStep(step.key)}
                    className={`p-4 rounded-2xl text-left transition-transform ${
                      isLocked
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isActive
                          ? 'bg-gray-900 text-white hover:scale-[1.02]'
                          : 'bg-gray-100 text-gray-900 hover:scale-[1.02]'
                    }`}
                    aria-current={isActive ? 'step' : undefined}
                    disabled={isLocked}
                  >
                    <p className="text-xs uppercase tracking-[0.2em]">{step.label}</p>
                    <p className="text-sm font-semibold mt-1">{step.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-8">
            <CurrentComponent />
          </section>

          <section className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={activeStep === 0}
              className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
                activeStep === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-900 hover:scale-105'
              }`}
            >
              Previous Step
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={isNextDisabled}
              className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-transform ${
                isNextDisabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-900 text-white hover:scale-105'
              }`}
            >
              Next Step
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function TextToComicGenerator() {
  return (
    <ComicGenerationProvider>
      <WizardContent />
    </ComicGenerationProvider>
  );
}
