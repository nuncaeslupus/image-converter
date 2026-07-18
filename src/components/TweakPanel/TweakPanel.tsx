import type { JSX } from "preact";
import type { TweakValues, BackgroundMode } from "../../lib/tweakPipeline";
import type { PaletteSize } from "../../lib/traceProtocol";
import styles from "./TweakPanel.module.css";

/** Quick-select palette sizes (status/specification.md Goals: "1, 2, 3, 4, 8, 16…"). */
const PALETTE_PRESETS: number[] = [1, 2, 3, 4, 8, 16];

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
 * Live tweak panel (T6): palette (presets + auto + custom), smoothness,
 * detail, contrast, and background. Every control change is forwarded as a
 * full `TweakValues` snapshot — routing to a debounced worker retrace vs. an
 * immediate cheap edit is `tweakPipeline.ts`'s job, not this component's.
 */
export function TweakPanel({ values, onChange, busy = false }: TweakPanelProps) {
  function set<K extends keyof TweakValues>(key: K, value: TweakValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function handlePaletteNumberInput(event: JSX.TargetedEvent<HTMLInputElement>) {
    const next: PaletteSize = Math.max(1, Math.min(64, Number(event.currentTarget.value) || 1));
    set("paletteSize", next);
  }

  return (
    <div className={styles.panel}>
      <fieldset className={styles.group} disabled={busy}>
        <legend>Palette</legend>
        <div className={styles.presetRow} role="group" aria-label="Palette size presets">
          {PALETTE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={styles.presetButton}
              aria-pressed={values.paletteSize === preset}
              onClick={() => set("paletteSize", preset)}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            className={styles.presetButton}
            aria-pressed={values.paletteSize === "auto"}
            onClick={() => set("paletteSize", "auto")}
          >
            Auto
          </button>
        </div>
        <label className={styles.field}>
          Custom count
          <input
            type="number"
            min={1}
            max={64}
            disabled={values.paletteSize === "auto"}
            value={values.paletteSize === "auto" ? "" : values.paletteSize}
            placeholder={values.paletteSize === "auto" ? "auto" : undefined}
            onInput={handlePaletteNumberInput}
          />
        </label>
      </fieldset>

      <fieldset className={styles.group} disabled={busy}>
        <legend>Trace quality</legend>
        <label className={styles.field}>
          Smoothness
          <input
            type="range"
            min={0}
            max={100}
            value={values.smoothness}
            onInput={(event) => set("smoothness", Number(event.currentTarget.value))}
          />
        </label>
        <label className={styles.field}>
          Detail
          <input
            type="range"
            min={0}
            max={100}
            value={values.detail}
            onInput={(event) => set("detail", Number(event.currentTarget.value))}
          />
        </label>
        <label className={styles.field}>
          Contrast
          <input
            type="range"
            min={-100}
            max={100}
            value={values.contrast}
            onInput={(event) => set("contrast", Number(event.currentTarget.value))}
          />
        </label>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Background</legend>
        <div className={styles.presetRow} role="radiogroup" aria-label="Background handling">
          {BACKGROUND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.presetButton}
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
