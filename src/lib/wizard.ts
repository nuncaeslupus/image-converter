import { useState } from "preact/hooks";
import type { TweakValues } from "./tweakPipeline";
import { type EditTransform, IDENTITY_TRANSFORM } from "./imageEdit";

export const WIZARD_STEPS = ["upload", "edit", "trace", "export"] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export interface Wizard {
  step: WizardStep;
  stepIndex: number;
  goTo: (step: WizardStep) => void;
  next: () => void;
  back: () => void;
  /**
   * The source image — the pristine decode from Upload. Edit never mutates it;
   * crop/rotate are non-destructive (see `transform`), baked into pixels only
   * when the image is traced. Replaced only by Upload / "Start over" (via
   * `replaceImage`). `null` until Upload's decode succeeds.
   */
  image: ImageBitmap | null;
  /**
   * Replaces the source image, closing the outgoing one, and resets the Edit
   * transform to identity. Used by Upload (decode / Replace / Remove) and App's
   * "Start over". Pass `(null, null)` to clear. Because Edit no longer bakes
   * bitmaps, this is the only place the source image ever changes — there is no
   * separate pristine copy to keep in sync anymore.
   */
  replaceImage: (next: ImageBitmap | null, fileName: string | null) => void;
  /**
   * The uploaded source's original file name (e.g. "logo.png"), or `null` when
   * no image is loaded. Export uses it to default the download name.
   */
  fileName: string | null;
  /**
   * The pending, non-destructive Edit transform (rotate + crop). Lives here so
   * it survives Edit⇄Trace round-trips; Trace/Export bake it fresh from `image`
   * each time they trace, so a rotation is always a single clean resample and
   * can never double-apply on a round trip.
   */
  transform: EditTransform;
  /** Replaces the current Edit transform — called by the Editor on any change. */
  setTransform: (transform: EditTransform) => void;
  /**
   * The current traced SVG markup (T6/T8), threaded to Export (T9). `null`
   * until Trace & Tweak produces a first result.
   */
  svg: string | null;
  /** Replaces the current traced SVG — called on every trace result / cheap edit. */
  setSvg: (svg: string | null) => void;
  /**
   * The tweak panel's last-used values (T6), lifted here so they survive
   * Trace <-> Export navigation. `null` until a first value is produced.
   */
  tweakValues: TweakValues | null;
  /** Replaces the current tweak values — called on every tweak-panel change. */
  setTweakValues: (values: TweakValues | null) => void;
}

/**
 * Drives the single-page wizard (see status/plan.md "UI flow (step wizard)").
 * Step transitions are in-memory state only — no router, no URL change.
 */
export function useWizard(initial: WizardStep = "upload"): Wizard {
  const [step, setStep] = useState<WizardStep>(initial);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [transform, setTransform] = useState<EditTransform>(IDENTITY_TRANSFORM);
  const [svg, setSvg] = useState<string | null>(null);
  const [tweakValues, setTweakValues] = useState<TweakValues | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const stepIndex = WIZARD_STEPS.indexOf(step);

  // Close the outgoing source OUTSIDE the state updaters — updaters must stay
  // pure (double-invocation under strict/concurrent rendering would close the
  // replacement's predecessor twice). replaceImage only runs from event
  // handlers, so `image` is current here.
  //
  // A new source is a clean slate: besides the transform, the traced SVG and
  // the tweak-panel values (palette/smoothness/detail/contrast/background) are
  // reset too, so a fresh image — or "Start over" — never inherits the previous
  // image's Trace settings. This is the single place the source changes, so
  // every caller (upload / replace / remove / start over) gets the reset.
  function replaceImage(next: ImageBitmap | null, nextFileName: string | null) {
    if (image && image !== next) image.close();
    setImage(next);
    setTransform(IDENTITY_TRANSFORM);
    setFileName(nextFileName);
    setSvg(null);
    setTweakValues(null);
  }

  return {
    step,
    stepIndex,
    goTo: setStep,
    next: () => setStep(WIZARD_STEPS[Math.min(stepIndex + 1, WIZARD_STEPS.length - 1)]),
    back: () => setStep(WIZARD_STEPS[Math.max(stepIndex - 1, 0)]),
    image,
    replaceImage,
    fileName,
    transform,
    setTransform,
    svg,
    setSvg,
    tweakValues,
    setTweakValues,
  };
}
