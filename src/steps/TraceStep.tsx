import type { Wizard } from "../lib/wizard";

/** Placeholder — tweak panel + tracer worker land in plan.md T3, T6, T7. */
export function TraceStep({ wizard }: { wizard: Wizard }) {
  return (
    <section>
      <h2>3. Trace &amp; Tweak</h2>
      <p>
        Palette / smoothness / detail / contrast / background controls with original-vs-traced
        compare preview — not yet implemented.
      </p>
      <button type="button" onClick={wizard.back}>
        Back
      </button>
      <button type="button" onClick={wizard.next}>
        Next
      </button>
    </section>
  );
}
