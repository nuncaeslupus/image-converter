import { useEffect, useState } from "preact/hooks";

export type Theme = "light" | "dark";

const STORAGE_KEY = "halftone:theme:v1";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // storage unavailable — fall through to system preference
  }
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Applies the saved (or system) theme to `<html data-theme>` once. For static
 * pages (the FAQ shells) that load index.css but never mount the app/useTheme. */
export function applyStoredTheme(): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", initialTheme());
  }
}

/**
 * App theme state — mirrors the design's `dark` flag, persisted to
 * localStorage and reflected onto `<html data-theme>` so the token blocks in
 * index.css take effect. First load respects `prefers-color-scheme`.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore — persistence is best-effort
    }
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}
