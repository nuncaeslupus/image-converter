import type { JSX } from "preact";
import { LANGUAGES, useI18n, type Lang } from "../lib/i18n";
import { ChevronRightIcon } from "./shellIcons";
import styles from "./LanguageSelect.module.css";

/** The URL for `lang` at the current page (tool vs FAQ), under the deploy base.
 * Language lives in the URL (one static shell per language), so switching is a
 * navigation, not client state. */
function langHref(lang: Lang): string {
  const base = import.meta.env.BASE_URL; // "/image-converter/" (build) or "/" (dev)
  const isFaq = /\/faq\/?$/.test(location.pathname);
  return base + (lang === "es" ? "es/" : "") + (isFaq ? "faq/" : "");
}

/** Header language picker — a native <select> (per request, not a switch) with
 * a custom, theme-aware dropdown chevron. Selecting a language navigates to that
 * language's URL (the shells are per-language and crawlable). */
export function LanguageSelect() {
  const { lang, m } = useI18n();
  return (
    <label className={styles.wrap} title={m.language}>
      <span className={styles.srOnly}>{m.language}</span>
      <select
        className={styles.select}
        value={lang}
        aria-label={m.language}
        onChange={(event: JSX.TargetedEvent<HTMLSelectElement>) => {
          const next = event.currentTarget.value as Lang;
          if (next !== lang) location.assign(langHref(next));
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
      <span className={styles.chevron} aria-hidden="true">
        <ChevronRightIcon size={14} />
      </span>
    </label>
  );
}
