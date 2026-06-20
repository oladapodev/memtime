import React from "react";
import { playClick } from "../sound";

type Variant = "primary" | "secondary" | "ghost" | "brand" | "danger";
type Size    = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  sound?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:   "bg-forkbot-sky text-zinc-950 hover:bg-sky-400 active:bg-sky-600 shadow-sm",
  secondary: "bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600",
  ghost:     "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800",
  brand:     "bg-forkbot-crimson text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm",
  danger:    "bg-red-900/40 text-red-400 border border-red-800/60 hover:bg-red-900/60 hover:text-red-300",
};

const sizeClasses: Record<Size, string> = {
  xs: "h-6 px-2 text-xs gap-1 rounded-sm",
  sm: "h-8 px-3 text-sm gap-1.5 rounded-md",
  md: "h-9 px-4 text-sm gap-2 rounded-md",
  lg: "h-11 px-6 text-base gap-2 rounded-lg",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  iconLeft,
  iconRight,
  sound = true,
  className = "",
  children,
  onClick,
  disabled,
  ...rest
}: ButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (sound && !disabled && !loading) playClick();
    onClick?.(e);
  };

  return (
    <button
      className={[
        "inline-flex items-center justify-center font-medium",
        "transition-all duration-[120ms] ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forkbot-sky focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
        "disabled:opacity-40 disabled:pointer-events-none",
        "select-none cursor-pointer",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
      disabled={disabled || loading}
      onClick={handleClick}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
}
