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
  if (!wizard.image) {
    return (
      <section>
        <p role="alert">No image to edit yet — go back and choose one first.</p>
      </section>
    );
  }

  // A crop/rotate/undo/redo replaces the working image, which invalidates any
  // previously traced SVG still sitting in `wizard.svg` — otherwise the stale
  // pre-edit trace remains reachable/exportable (App.tsx's `stepReachable`
  // gates Export purely on `!!wizard.svg`).
  function handleChange(next: ImageBitmap) {
    wizard.setImage(next);
    wizard.setSvg(null);
  }

  return (
    <section className={styles.root}>
      <Editor image={wizard.image} onChange={handleChange} />
    </section>
  );
}
