import React from "react";

type StatusVariant  = "completed" | "running" | "failed" | "queued" | "pending";
type SeverityLevel  = "critical" | "high" | "medium" | "low" | "info";
type BadgeSize      = "sm" | "md";

interface BadgeProps {
  variant?: StatusVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface SeverityBadgeProps {
  severity: SeverityLevel;
  size?: BadgeSize;
  className?: string;
}

const statusStyles: Record<StatusVariant, string> = {
  completed: "bg-green-950/60 text-forkbot-green border border-green-800/50",
  running:   "bg-sky-950/60 text-forkbot-sky border border-sky-800/50",
  failed:    "bg-rose-950/60 text-red-400 border border-rose-800/50",
  queued:    "bg-zinc-800 text-zinc-400 border border-zinc-700",
  pending:   "bg-amber-950/60 text-forkbot-amber border border-amber-800/50",
};

const statusDot: Record<StatusVariant, string> = {
  completed: "bg-forkbot-green",
  running:   "bg-forkbot-sky animate-pulse-dot",
  failed:    "bg-red-400",
  queued:    "bg-zinc-500",
  pending:   "bg-forkbot-amber animate-pulse-dot",
};

const severityStyles: Record<SeverityLevel, string> = {
  critical: "bg-rose-950/60 text-red-300 border border-rose-700/50",
  high:     "bg-orange-950/60 text-orange-400 border border-orange-800/50",
  medium:   "bg-amber-950/60 text-forkbot-amber border border-amber-800/50",
  low:      "bg-blue-950/60 text-forkbot-sky border border-blue-800/50",
  info:     "bg-zinc-800 text-zinc-400 border border-zinc-700",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1 rounded",
  md: "text-xs px-2 py-0.5 gap-1.5 rounded-md",
};

export function Badge({
  variant = "queued",
  size = "md",
  dot = true,
  className = "",
  children,
}: BadgeProps) {
  const label = children ?? variant;
  return (
    <span
      className={[
        "inline-flex items-center font-medium uppercase tracking-wide",
        statusStyles[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
    >
      {dot && (
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusDot[variant]}`} />
      )}
      {label}
    </span>
  );
}

export function SeverityBadge({ severity, size = "md", className = "" }: SeverityBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center font-medium uppercase tracking-wide",
        severityStyles[severity],
        sizeClasses[size],
        className,
      ].join(" ")}
    >
      {severity}
    </span>
  );
}
