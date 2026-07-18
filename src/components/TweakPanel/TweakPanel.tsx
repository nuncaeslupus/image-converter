import type { TweakValues, BackgroundMode } from "../../lib/tweakPipeline";
import type { PaletteSize } from "../../lib/traceProtocol";
import styles from "./TweakPanel.module.css";

/** Quick-select palette sizes (status/specification.md Goals: "1, 2, 3, 4, 8, 16…") + Auto. */
const PALETTE_PRESETS: (PaletteSize | "auto")[] = [1, 2, 3, 4, 8, 16, "auto"];

const BACKGROUND_OPTIONS: { value: BackgroundMode; label: string }[] = [
  { value: "transparent", label: "Transparent" },
  { value: "solid", label: "Solid" },
  { value: "removed", label: "Removed" },
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
            min={-50}
            max={50}
            value={values.contrast}
            aria-label="Contrast"
            onInput={(event) => set("contrast", Number(event.currentTarget.value))}
          />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.label}>Background</legend>
        <div className={styles.segmented} role="radiogroup" aria-label="Background handling">
          {BACKGROUND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.segment}
              role="radio"
              aria-checked={values.background === option.value}
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
