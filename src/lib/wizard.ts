import { useState } from "preact/hooks";

export const WIZARD_STEPS = ["upload", "edit", "trace", "export"] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export interface Wizard {
  step: WizardStep;
  stepIndex: number;
  goTo: (step: WizardStep) => void;
  next: () => void;
  back: () => void;
}

/**
 * Drives the single-page wizard (see status/plan.md "UI flow (step wizard)").
 * Step transitions are in-memory state only — no router, no URL change.
 */
export function useWizard(initial: WizardStep = "upload"): Wizard {
  const [step, setStep] = useState<WizardStep>(initial);
  const stepIndex = WIZARD_STEPS.indexOf(step);

  return {
    step,
    stepIndex,
    goTo: setStep,
    next: () => setStep(WIZARD_STEPS[Math.min(stepIndex + 1, WIZARD_STEPS.length - 1)]),
    back: () => setStep(WIZARD_STEPS[Math.max(stepIndex - 1, 0)]),
  };
}
