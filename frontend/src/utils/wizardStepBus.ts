export type WizardStep = 0 | 1 | 2 | 3 | 4 | 5;

const EVENT_NAME = 'mohiom:wizard-step-change';

type WizardStepEventDetail = { step: WizardStep };

export function publishWizardStep(step: WizardStep): void {
  window.dispatchEvent(new CustomEvent<WizardStepEventDetail>(EVENT_NAME, { detail: { step } }));
}

export function subscribeWizardStep(callback: (step: WizardStep) => void): () => void {
  const handler = (event: Event) => {
    callback((event as CustomEvent<WizardStepEventDetail>).detail.step);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
