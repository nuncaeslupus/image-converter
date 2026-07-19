import type { Wizard } from "../lib/wizard";
import { Editor } from "../components/Editor/Editor";
import styles from "./EditStep.module.css";

/**
 * Wizard step 2 — optional crop/resize/rotate editing (T5).
 *
 * Operates on the `ImageBitmap` decoded by Upload (T4, `wizard.image`).
 * This step is skippable by design (status/plan.md "UI flow (step wizard)"
 * step 2): the original bitmap already lives in `wizard.image` when this
 * step mounts, so clicking Next without touching any tool passes it through
 * to Trace & Tweak completely unchanged.
 */
export function EditStep({ wizard }: { wizard: Wizard }) {
  if (!wizard.image || !wizard.originalImage) {
    return (
      <section>
        <p role="alert">No image to edit yet — go back and choose one first.</p>
      </section>
    );
  }

  // A crop/rotate/undo/redo/reset replaces the working image, which
  // invalidates any previously traced SVG still sitting in `wizard.svg` —
  // otherwise the stale pre-edit trace remains reachable/exportable
  // (App.tsx's `stepReachable` gates Export purely on `!!wizard.svg`).
  //
  // `setImage` (not `replaceImage`) is deliberate here: the Editor is
  // mounted and owns the lifecycle of every bitmap in its own undo history,
  // including whichever one was previously published as `wizard.image` — see
  // the doc comments on both setters in `lib/wizard.ts`.
  function handleChange(next: ImageBitmap, isOriginal: boolean) {
    wizard.setImage(next);
    wizard.setImageIsOriginal(isOriginal);
    wizard.setSvg(null);
  }

  return (
    <section className={styles.root}>
      <Editor
        image={wizard.image}
        originalImage={wizard.originalImage}
        imageIsOriginal={wizard.imageIsOriginal}
        onChange={handleChange}
      />
    </section>
  );
}
