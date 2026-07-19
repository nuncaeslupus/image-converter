/**
 * Local-storage persistence for the tweak panel's last-used values (T10; see
 * status/specification.md §5 "Local storage contract"). Persists tweak values
 * ONLY — never image data. `load()` never throws: missing, corrupted, or
 * shape-mismatched storage all fall back to `DEFAULT_TWEAK_VALUES`.
 */
import { DEFAULT_TWEAK_VALUES, type TweakValues, type BackgroundMode } from "./tweakPipeline";

export const STORAGE_KEY = "image-converter:last-settings:v1";

const BACKGROUND_MODES: readonly BackgroundMode[] = ["transparent", "solid"];

function isValidConfig(value: unknown): value is TweakValues {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.paletteSize === "auto" || typeof candidate.paletteSize === "number") &&
    typeof candidate.smoothness === "number" &&
    typeof candidate.detail === "number" &&
    typeof candidate.contrast === "number" &&
    BACKGROUND_MODES.includes(candidate.background as BackgroundMode)
  );
}

/** Persists the tweak panel's current values, debounced by the caller. */
export function save(config: TweakValues): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ponytail: storage unavailable/full (private browsing, quota) — fail
    // silently, per spec's risk table; never block the core flow.
  }
}

/** Loads the last-saved tweak values, or `DEFAULT_TWEAK_VALUES` if none/invalid. */
export function load(): TweakValues {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_TWEAK_VALUES;
    const parsed: unknown = JSON.parse(raw);
    return isValidConfig(parsed) ? parsed : DEFAULT_TWEAK_VALUES;
  } catch {
    return DEFAULT_TWEAK_VALUES;
  }
}
