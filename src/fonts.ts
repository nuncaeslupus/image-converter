/**
 * Self-hosted fonts — no CDN. Vite bundles these woff2 from @fontsource and
 * serves them from our own origin, so no request ever leaves the user's browser
 * for a Google server (the old `@import` from fonts.googleapis.com both blocked
 * first paint and pinged Google on every load, undercutting the private/no-CDN
 * promise). Latin subset only — covers EN + ES (and FR/DE/IT); add a subset
 * import here if a language needs Cyrillic/CJK/etc.
 *
 * ponytail: the `→` in the tagline isn't in the Latin subset, so it falls back
 * to the system font for that one glyph — fine, and cheaper than shipping the
 * punctuation subset.
 */
import "@fontsource/onest/latin-400.css";
import "@fontsource/onest/latin-500.css";
import "@fontsource/onest/latin-600.css";
import "@fontsource/onest/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
