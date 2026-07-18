import type { Wizard } from "../lib/wizard";
import { Export } from "../components/Export/Export";
import { Preview } from "../components/Preview/Preview";
import styles from "./ExportStep.module.css";

/**
 * Wizard step 4 — download/copy/viewBox override/size estimate (T9). Reads
 * the current traced SVG from `wizard.svg` (populated by Trace & Tweak, T6)
 * — export never re-invokes the tracer worker (status/plan.md "Data flow"
 * step 8; status/specification.md §5).
 */
export function ExportStep({ wizard }: { wizard: Wizard }) {
  if (!wizard.svg) {
    return (
      <section>
        <p role="alert">No traced image yet — go back and trace one first.</p>
      </section>
    );
  }

  return (
    <section className={styles.layout}>
      <div className={styles.previewCol}>
        <Preview title="Your SVG is ready" tracedSvg={wizard.svg} />
      </div>
      <div className={styles.controls}>
        <Export svg={wizard.svg} />
      </div>
    </section>
  );
}
