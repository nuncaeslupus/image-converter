import type { Wizard } from "../lib/wizard";
import { Export } from "../components/Export/Export";

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
        <h2>4. Export</h2>
        <p role="alert">No traced image yet — go back and trace one first.</p>
        <button type="button" onClick={wizard.back}>
          Back
        </button>
      </section>
    );
  }

  return (
    <section>
      <h2>4. Export</h2>
      <p>Download the SVG, copy the markup, or override its size/viewBox before exporting.</p>

      <Export svg={wizard.svg} />

      <div>
        <button type="button" onClick={wizard.back}>
          Back
        </button>
      </div>
    </section>
  );
}
