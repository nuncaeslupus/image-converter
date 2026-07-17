/**
 * Small stroke-based toolbar icons, hand-drawn as inline SVG so the editor
 * toolbar has visible icons without pulling in an icon-font/library
 * dependency (keeps the bundle small, per status/plan.md's technology
 * choices). Each renders at `1em` so it inherits the button's font size.
 */
import type { JSX } from "preact";

type IconProps = JSX.SVGAttributes<SVGSVGElement>;

function baseProps(props: IconProps): IconProps {
  return {
    viewBox: "0 0 24 24",
    width: "1em",
    height: "1em",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
    ...props,
  };
}

/** Standard crop icon: two overlapping corner brackets. */
export function CropIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </svg>
  );
}

/** Standard counter-clockwise rotate icon. */
export function RotateLeftIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3 10a9 9 0 1 1 2.6 6.3" />
      <path d="M3 4v6h6" />
    </svg>
  );
}

/** Standard clockwise rotate icon. */
export function RotateRightIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M21 10a9 9 0 1 0-2.6 6.3" />
      <path d="M21 4v6h-6" />
    </svg>
  );
}

/** Resize icon: diagonal arrow between opposite corners. */
export function ResizeIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

/** Reset/undo icon: circular arrow back to start. */
export function ResetIcon(props: IconProps = {}) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
