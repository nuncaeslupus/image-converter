/**
 * Inline Feather/Lucide-style icons for the app shell (logo, theme toggle,
 * privacy lock, stepper tool icons).
 */
import type { JSX, ComponentChildren } from "preact";

type IconProps = JSX.SVGAttributes<SVGSVGElement> & { size?: number };

function Stroke({ size = 24, children, ...rest }: IconProps & { children: ComponentChildren }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      stroke-width={2}
      stroke-linecap="round"
      stroke-linejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Radial halftone rosette — the Halftone logo mark (40×40 viewBox). */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      style={{ color: "var(--accent)" }}
    >
      <circle cx="20" cy="20" r="5" fill="currentColor" />
      <circle cx="20" cy="7" r="2.6" fill="currentColor" />
      <circle cx="20" cy="33" r="2.6" fill="currentColor" />
      <circle cx="7" cy="20" r="2.6" fill="currentColor" />
      <circle cx="33" cy="20" r="2.6" fill="currentColor" />
      <circle cx="11" cy="11" r="1.8" fill="currentColor" />
      <circle cx="29" cy="11" r="1.8" fill="currentColor" />
      <circle cx="11" cy="29" r="1.8" fill="currentColor" />
      <circle cx="29" cy="29" r="1.8" fill="currentColor" />
    </svg>
  );
}

export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Stroke>
  );
}

export function SunIcon({ size = 17 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
    </Stroke>
  );
}

export function MoonIcon({ size = 17 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <path d="M21 12.8A8 8 0 1 1 11.2 3 6 6 0 0 0 21 12.8Z" />
    </Stroke>
  );
}

export function CheckIcon({ size = 20 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <path d="M20 6 9 17l-5-5" />
    </Stroke>
  );
}

/** Tray-upload arrow — used for both the dropzone tile and the Upload stepper node. */
export function UploadTrayIcon({ size = 28 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
    </Stroke>
  );
}

export function EditStepIcon({ size = 19 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <path d="M4 15V4h11" />
      <path d="M9 20h11V9" />
      <rect x="4" y="15" width="5" height="5" rx="1" />
      <rect x="15" y="4" width="5" height="5" rx="1" />
    </Stroke>
  );
}

export function TraceStepIcon({ size = 20 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <g transform="translate(0,-2)">
        <path d="M5 17c3-9 11-9 14 0" />
        <rect x="2.5" y="15" width="4.5" height="4.5" rx="1.2" />
        <rect x="17" y="15" width="4.5" height="4.5" rx="1.2" />
      </g>
    </Stroke>
  );
}

/** Down-arrow-into-tray glyph — used for both the Export stepper node and the download button. */
export function ExportStepIcon({ size = 20 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <path d="M12 4v12" />
      <path d="M8 12l4 4 4-4" />
      <path d="M4 20h16" />
    </Stroke>
  );
}

export function XIcon({ size = 16 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Stroke>
  );
}

export function ReplaceIcon({ size = 16 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </Stroke>
  );
}

export function CopyIcon({ size = 16 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </Stroke>
  );
}

/** GitHub mark (filled octocat) — currentColor so it follows the link color. */
export function GitHubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.28 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}
