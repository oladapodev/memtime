import React from "react";

interface CardProps {
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  hover?: boolean;
  glow?: "crimson" | "sky" | "green" | "amber" | "purple" | false;
}

interface CardHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

interface CardBodyProps {
  className?: string;
  children?: React.ReactNode;
  noPad?: boolean;
}

interface CardFooterProps {
  className?: string;
  children?: React.ReactNode;
}

const glowColors = {
  crimson: "hover:shadow-[0_0_0_1px_rgba(159,18,57,0.4),0_0_20px_rgba(159,18,57,0.12)]",
  sky:     "hover:shadow-[0_0_0_1px_rgba(14,165,233,0.4),0_0_20px_rgba(14,165,233,0.12)]",
  green:   "hover:shadow-[0_0_0_1px_rgba(34,197,94,0.4),0_0_20px_rgba(34,197,94,0.12)]",
  amber:   "hover:shadow-[0_0_0_1px_rgba(245,158,11,0.4),0_0_20px_rgba(245,158,11,0.12)]",
  purple:  "hover:shadow-[0_0_0_1px_rgba(168,85,247,0.4),0_0_20px_rgba(168,85,247,0.12)]",
};

export function Card({ className = "", children, onClick, hover = false, glow = false }: CardProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className={[
        "bg-zinc-900 border border-zinc-800 rounded-xl",
        "transition-all duration-[200ms] ease-out",
        hover && "hover:border-zinc-700 hover:bg-zinc-800/80",
        glow && glowColors[glow],
        onClick && "cursor-pointer text-left w-full",
        className,
      ].filter(Boolean).join(" ")}
      {...(onClick ? { onClick } : {})}
    >
      {children}
    </Tag>
  );
}

Card.Header = function CardHeader({ title, subtitle, action, className = "", children }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-zinc-800 ${className}`}>
      <div className="min-w-0">
        {children ?? (
          <>
            {title && (
              <h3 className="text-sm font-semibold text-zinc-100 truncate">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-zinc-500 truncate">{subtitle}</p>
            )}
          </>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

Card.Body = function CardBody({ className = "", children, noPad = false }: CardBodyProps) {
  return (
    <div className={noPad ? className : `px-4 py-3 ${className}`}>
      {children}
    </div>
  );
};

Card.Footer = function CardFooter({ className = "", children }: CardFooterProps) {
  return (
    <div className={`px-4 py-3 border-t border-zinc-800 ${className}`}>
      {children}
    </div>
  );
};
