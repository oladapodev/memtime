import React from "react";

type Status = "running" | "completed" | "failed" | "queued" | "pending";

interface StatusDotProps {
  status: Status;
  size?: "xs" | "sm" | "md";
  label?: string;
  className?: string;
}

const dotColor: Record<Status, string> = {
  running:   "bg-forkbot-sky",
  completed: "bg-forkbot-green",
  failed:    "bg-red-400",
  queued:    "bg-zinc-500",
  pending:   "bg-forkbot-amber",
};

const dotPulse: Record<Status, boolean> = {
  running: true,
  pending: true,
  completed: false,
  failed: false,
  queued: false,
};

const dotSize = {
  xs: "w-1.5 h-1.5",
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
};

export function StatusDot({ status, size = "sm", label, className = "" }: StatusDotProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={[
          "inline-block rounded-full shrink-0",
          dotColor[status],
          dotSize[size],
          dotPulse[status] ? "animate-pulse-dot" : "",
        ].join(" ")}
      />
      {label && <span className="text-xs text-zinc-400">{label}</span>}
    </span>
  );
}
