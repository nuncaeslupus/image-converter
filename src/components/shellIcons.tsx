/**
 * Inline Feather/Lucide-style icons for the app shell (logo, theme toggle,
 * privacy lock, stepper tool icons). Paths copied verbatim from the design
 * prototype `Halftone Wizard.dc.html`.
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

export function ExportStepIcon({ size = 20 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <path d="M12 4v12" />
      <path d="M8 12l4 4 4-4" />
      <path d="M4 20h16" />
    </Stroke>
  );
}

export function DownloadIcon({ size = 17 }: { size?: number }) {
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
