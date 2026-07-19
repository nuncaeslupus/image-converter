/**
 * Shared arrow-key navigation helper for roving-tabindex ARIA composite
 * widgets — radiogroups and toolbars both follow the same "wrap to the next
 * item on an arrow key" shape (WAI-ARIA APG "Keyboard Navigation Inside
 * Components"), they just differ in which keys count as forward/backward and
 * in what happens once the index changes (a radiogroup also *selects*; a
 * toolbar just moves focus). This module owns only the index arithmetic so
 * both `TweakPanel` (background radiogroup) and `Editor` (toolbar) can share
 * it without duplicating the wrap-around logic.
 */
export interface RovingKeys {
  /** Keys that move to the next item, wrapping past the end. */
  forward: string[];
  /** Keys that move to the previous item, wrapping past the start. */
  backward: string[];
}

/** Toolbar pattern: only Left/Right move focus (single-row, no selection). */
export const TOOLBAR_KEYS: RovingKeys = { forward: ["ArrowRight"], backward: ["ArrowLeft"] };

/** Radiogroup pattern: all four arrows move (and select) per WAI-ARIA. */
export const RADIOGROUP_KEYS: RovingKeys = {
  forward: ["ArrowRight", "ArrowDown"],
  backward: ["ArrowLeft", "ArrowUp"],
};

/**
 * Given the pressed key, the current index, and the item count, returns the
 * new (wrapped) index — or `null` if the key isn't a navigation key for this
 * widget, so the caller can leave the event alone.
 */
export function nextRovingIndex(
  key: string,
  currentIndex: number,
  count: number,
  keys: RovingKeys,
): number | null {
  if (count === 0) return null;
  if (keys.forward.includes(key)) return (currentIndex + 1 + count) % count;
  if (keys.backward.includes(key)) return (currentIndex - 1 + count) % count;
  return null;
}
