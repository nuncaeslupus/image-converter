import type { JSX } from "preact";
import type { TweakValues, BackgroundMode } from "../../lib/tweakPipeline";
import type { PaletteSize } from "../../lib/traceProtocol";
import { RADIOGROUP_KEYS, nextRovingIndex } from "../../lib/rovingFocus";
import styles from "./TweakPanel.module.css";

// Palette presets + Auto. Powers of two because paletteSize maps to VTracer's
// colorPrecision via log2 (see lib/paramTranslation.ts): the old [1,2,3,4,8,16]
// set collapsed onto duplicate precisions (1&2 → 1 bit, 3&4 → 2 bits), so
// clicking "3" then "4" produced byte-identical output. These six each map to a
// distinct precision (1–6 bits/channel), so every chip does something.
const PALETTE_PRESETS: (PaletteSize | "auto")[] = [2, 4, 8, 16, 32, 64, "auto"];

/**
 * "Removed" used to be a third option here, but it rendered byte-identically
 * to "Transparent" (see tweakPipeline.ts `applyBackground`) — a real
 * "detected background removed" mode needs pixel-level background detection
 * that doesn't exist yet, so the option was removed rather than ship a
 * control that silently does nothing.
 */
const BACKGROUND_OPTIONS: { value: BackgroundMode; label: string }[] = [
  { value: "transparent", label: "Transparent" },
  { value: "solid", label: "Solid" },
];

export interface TweakPanelProps {
  values: TweakValues;
  /** Called with the full next value set on any control change. */
  onChange: (values: TweakValues) => void;
  /** True while a retrace is in flight — disables retrace-affecting controls, never background. */
  busy?: boolean;
}

/**
 * Live tweak panel (T6): palette chips, smoothness, detail, contrast, and
 * background. Every control change is forwarded as a full `TweakValues`
 * snapshot — routing to a debounced worker retrace vs. an immediate cheap edit
 * is `tweakPipeline.ts`'s job, not this component's.
 */
export function TweakPanel({ values, onChange, busy = false }: TweakPanelProps) {
  function set<K extends keyof TweakValues>(key: K, value: TweakValues[K]) {
    onChange({ ...values, [key]: value });
  }

  // WAI-ARIA radiogroup keyboard pattern: arrow keys move *and select* the
  // next/previous radio (wrapping), independent of which one currently has
  // focus — see the roving tabIndex on each `.segment` button below.
  function handleBackgroundKeyDown(event: JSX.TargetedKeyboardEvent<HTMLDivElement>) {
    const currentIndex = BACKGROUND_OPTIONS.findIndex(
      (option) => option.value === values.background,
    );
    const nextIndex = nextRovingIndex(
      event.key,
      currentIndex,
      BACKGROUND_OPTIONS.length,
      RADIOGROUP_KEYS,
    );
    if (nextIndex === null) return;
    event.preventDefault();
    const option = BACKGROUND_OPTIONS[nextIndex];
    set("background", option.value);
    event.currentTarget.querySelectorAll("button")[nextIndex]?.focus();
  }

  return (
    <div className={styles.panel}>
      <fieldset className={styles.group} disabled={busy}>
        <legend className={styles.label}>Palette</legend>
        <div className={styles.chipRow} role="group" aria-label="Palette size presets">
          {PALETTE_PRESETS.map((preset) => (
            <button
              key={String(preset)}
              type="button"
              className={styles.chip}
              aria-pressed={values.paletteSize === preset}
              onClick={() => set("paletteSize", preset)}
            >
              {preset === "auto" ? "Auto" : preset}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group} disabled={busy}>
        <div className={styles.slider}>
          <div className={styles.sliderHead}>
            <span className={styles.sliderName}>Smoothness</span>
            <span className={`${styles.value} mono`}>{values.smoothness}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={values.smoothness}
            aria-label="Smoothness"
            onInput={(event) => set("smoothness", Number(event.currentTarget.value))}
          />
        </div>
        <div className={styles.slider}>
          <div className={styles.sliderHead}>
            <span className={styles.sliderName}>Detail</span>
            <span className={`${styles.value} mono`}>{values.detail}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={values.detail}
            aria-label="Detail"
            onInput={(event) => set("detail", Number(event.currentTarget.value))}
          />
        </div>
        <div className={styles.slider}>
          <div className={styles.sliderHead}>
            <span className={styles.sliderName}>Contrast</span>
            <span className={`${styles.value} mono`}>{values.contrast}</span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={values.contrast}
            aria-label="Contrast"
            onInput={(event) => set("contrast", Number(event.currentTarget.value))}
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.label}>Background</legend>
        <div
          className={styles.segmented}
          role="radiogroup"
          aria-label="Background handling"
          onKeyDown={handleBackgroundKeyDown}
        >
          {BACKGROUND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.segment}
              role="radio"
              aria-checked={values.background === option.value}
              // Roving tabindex: only the checked radio is a Tab stop; arrow
              // keys (handled above) move between the others.
              tabIndex={values.background === option.value ? 0 : -1}
              onClick={() => set("background", option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
