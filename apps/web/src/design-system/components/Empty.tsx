import React from "react";

interface EmptyProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

export function Empty({ icon, title, message, action, className = "" }: EmptyProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 px-6 text-center ${className}`}>
      {icon && (
        <div className="text-zinc-600 mb-1">
          {icon}
        </div>
      )}
      {title && (
        <p className="text-sm font-medium text-zinc-300">{title}</p>
      )}
      {message && (
        <p className="text-sm text-zinc-500 max-w-xs">{message}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
