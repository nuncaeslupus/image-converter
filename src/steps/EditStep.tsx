import type { Wizard } from "../lib/wizard";
import type { EditTransform } from "../lib/imageEdit";
import { Editor } from "../components/Editor/Editor";
import styles from "./EditStep.module.css";

/**
 * Wizard step 2 — non-destructive crop/rotate (T5).
 *
 * Edit no longer bakes bitmaps: the Editor writes a pending `transform`
 * (rotation + crop) onto the wizard, which Trace/Export bake into pixels once,
 * at trace time. Skipping this step leaves the transform at identity, so the
 * source passes through unchanged.
 */
export function EditStep({ wizard }: { wizard: Wizard }) {
  if (!wizard.image) {
    return (
      <section>
        <p role="alert">No image to edit yet — go back and choose one first.</p>
      </section>
    );
  }

  // A crop/rotate change invalidates any previously traced SVG still sitting in
  // `wizard.svg` (App gates Export purely on `!!wizard.svg`).
  function handleChange(transform: EditTransform) {
    wizard.setTransform(transform);
    wizard.setSvg(null);
  }

  return (
    <section className={styles.root}>
      <Editor image={wizard.image} transform={wizard.transform} onChange={handleChange} />
    </section>
  );
}
