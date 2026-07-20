import type { JSX } from "preact";
import { LANGUAGES, useI18n, type Lang } from "../lib/i18n";
import styles from "./LanguageSelect.module.css";

/** Header language picker — a native <select> (per request, not a switch). */
export function LanguageSelect() {
  const { lang, setLang, m } = useI18n();
  return (
    <label className={styles.wrap} title={m.language}>
      <span className={styles.srOnly}>{m.language}</span>
      <select
        className={styles.select}
        value={lang}
        aria-label={m.language}
        onChange={(event: JSX.TargetedEvent<HTMLSelectElement>) =>
          setLang(event.currentTarget.value as Lang)
        }
      >
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
