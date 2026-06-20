import React from "react";

type LogoVariant = "mark" | "full";

interface LogoProps {
  size?: number;
  variant?: LogoVariant;
  className?: string;
}

/**
 * Forkbot logo — a git fork SVG with two colored branches.
 *
 * Node colors map to git's terminal ANSI branch colors:
 *   Crimson (#9F1239)  → git red    — origin commit
 *   Amber   (#f59e0b)  → git yellow — feature branch path
 *   Green   (#22c55e)  → git green  — feature branch tip (merged)
 *   Sky     (#0ea5e9)  → git blue   — second branch path + main tip
 *   Purple  (#a855f7)  → git magenta— second branch tip
 *   Slate   (#475569)  → git gray   — stems
 */
export function Logo({ size = 36, variant = "mark", className }: LogoProps) {
  return variant === "mark" ? (
    <LogoMark size={size} className={className} />
  ) : (
    <LogoFull size={size} className={className} />
  );
}

/** Compact mark used in nav bar, favicon, etc. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <ForkPaths />
    </svg>
  );
}

/** Hero-sized logo (landing page) */
export function LogoFull({ size = 340, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Forkbot logo"
      className={className}
    >
      <defs>
        <filter id="forkbot-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#forkbot-glow)">
        <ForkPaths />
      </g>
    </svg>
  );
}

/** Shared SVG paths — the actual fork geometry */
function ForkPaths() {
  return (
    <>
      {/* ── Origin commit (top) = Crimson ──────────────────────── */}
      <circle cx="150" cy="48" r="30" fill="#9F1239" />

      {/* ── Main vertical stem = Slate ──────────────────────────── */}
      <line
        x1="150" y1="78"
        x2="150" y2="252"
        stroke="#475569"
        strokeWidth="14"
        strokeLinecap="round"
      />

      {/* ── Main branch tip (bottom) = Sky ─────────────────────── */}
      <circle cx="150" cy="260" r="20" fill="#0ea5e9" />

      {/* ── Branch 1: right, longer — path=Amber, tip=Green ───── */}
      {/* Branch point at y≈130, curves right to (238, 200) */}
      <path
        d="M150 132 Q 200 158 238 202"
        stroke="#f59e0b"
        strokeWidth="13"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="238" cy="202" r="16" fill="#22c55e" />

      {/* ── Branch 2: left, shorter — path=Sky, tip=Purple ─────── */}
      {/* Branch point at y≈178, curves left to (78, 218) */}
      <path
        d="M150 180 Q 110 196 80 218"
        stroke="#0ea5e9"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="80" cy="218" r="14" fill="#a855f7" />
    </>
  );
}

/** Color legend badge — shows all branch colors */
export function ForkColorLegend({ className }: { className?: string }) {
  const dots = [
    { color: "#9F1239", label: "origin" },
    { color: "#f59e0b", label: "feature" },
    { color: "#0ea5e9", label: "main" },
    { color: "#22c55e", label: "merged" },
    { color: "#a855f7", label: "branch-2" },
  ];
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      {dots.map((d) => (
        <span
          key={d.label}
          style={{ background: d.color }}
          className="w-2.5 h-2.5 rounded-full"
          title={d.label}
        />
      ))}
    </div>
  );
}
