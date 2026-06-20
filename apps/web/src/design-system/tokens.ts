// Single source of truth — all Forkbot design values live here.
// tailwind.config.ts imports from this file; CSS vars in globals.css mirror
// the same values so GSAP timelines can reference them.

export const brand = {
  name: "Forkbot",
  tagline: "Isolated memory for every PR",
  url: "https://forkbot.dev",
} as const;

// ── Git branch palette ──────────────────────────────────────────
// Maps to git's terminal ANSI branch colors, modernised to vivid equivalents.
// Used as logo node/edge colors and as semantic accents throughout the UI.
export const branchColors = {
  crimson: "#9F1239", // git red   — origin commit / primary brand
  amber:   "#f59e0b", // git yellow — feature branch 1
  sky:     "#0ea5e9", // git blue   — main branch
  green:   "#22c55e", // git green  — merged / success
  purple:  "#a855f7", // git magenta — branch 2
  slate:   "#475569", // git gray   — stems / connections
} as const;

// ── Neutral palette (dark-first, zinc-derived) ──────────────────
export const neutrals = {
  950:  "#09090b", // page background
  900:  "#18181b", // card / panel
  800:  "#27272a", // elevated surface / input bg
  700:  "#3f3f46", // borders
  600:  "#52525b", // disabled text
  500:  "#71717a", // muted text
  400:  "#a1a1aa", // subtle text
  200:  "#e4e4e7", // primary text
  50:   "#fafafa", // headings / high-contrast
} as const;

// ── Semantic ────────────────────────────────────────────────────
export const semantic = {
  success:     branchColors.green,
  successBg:   "rgba(34, 197, 94, 0.10)",
  error:       "#f87171",
  errorBg:     "rgba(248, 113, 113, 0.10)",
  warning:     branchColors.amber,
  warningBg:   "rgba(245, 158, 11, 0.10)",
  info:        branchColors.sky,
  infoBg:      "rgba(14, 165, 233, 0.10)",
} as const;

// ── Typography ──────────────────────────────────────────────────
export const fonts = {
  heading: "'Space Grotesk', 'Inter', system-ui, sans-serif",
  body:    "'Inter', system-ui, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', monospace",
} as const;

// ── Radius (concentric: inner = outer − padding, per visual-concentric-radius) ─
export const radius = {
  none:  "0px",
  xs:    "4px",
  sm:    "8px",
  md:    "12px",
  lg:    "16px",
  xl:    "20px",
  "2xl": "24px",
  "3xl": "32px",
  full:  "9999px",
} as const;

// ── Spacing scale (4px grid) ────────────────────────────────────
export const space = {
  px:  "1px",
  0:   "0",
  0.5: "2px",
  1:   "4px",
  1.5: "6px",
  2:   "8px",
  2.5: "10px",
  3:   "12px",
  4:   "16px",
  5:   "20px",
  6:   "24px",
  8:   "32px",
  10:  "40px",
  12:  "48px",
  16:  "64px",
  20:  "80px",
  24:  "96px",
} as const;

// ── Animation (timing-under-300ms + easing-entrance-ease-out) ──
export const motion = {
  // Duration
  fast:   "120ms", // hover / press feedback
  base:   "200ms", // small state changes
  slow:   "280ms", // page-level transitions (max 300ms per timing-under-300ms)
  // Eases  (easing-entrance-ease-out, easing-exit-ease-in)
  ease:     "cubic-bezier(0.16, 1, 0.3, 1)", // ease-out — entrance default
  easeIn:   "cubic-bezier(0.4, 0, 1, 1)",    // ease-in — exits
  easeInOut:"cubic-bezier(0.4, 0, 0.2, 1)",  // transitions
  spring:   "cubic-bezier(0.34, 1.56, 0.64, 1)", // overshoot spring
} as const;

// ── Shadow scale (visual-layered-shadows, single light source) ──
export const shadows = {
  xs:   "0 1px 2px rgba(0,0,0,0.5)",
  sm:   "0 1px 4px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.3)",
  md:   "0 2px 8px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4)",
  lg:   "0 4px 16px rgba(0,0,0,0.7), 0 24px 64px rgba(0,0,0,0.5)",
  xl:   "0 8px 32px rgba(0,0,0,0.8), 0 32px 80px rgba(0,0,0,0.6)",
  glow: (color: string) => `0 0 24px ${color}33, 0 0 8px ${color}22`,
} as const;

// ── Z-index hierarchy (staging-z-index-hierarchy) ───────────────
export const zIndex = {
  base:    0,
  raised:  10,
  overlay: 40,
  modal:   50,
  toast:   60,
} as const;
