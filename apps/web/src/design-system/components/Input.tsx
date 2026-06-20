import React from "react";

// ── Input ───────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  wrapperClassName?: string;
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
  children: React.ReactNode;
}

interface FormGroupProps {
  label?: React.ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

const fieldBase =
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-sm " +
  "placeholder:text-zinc-500 " +
  "transition-colors duration-[120ms] ease-out " +
  "focus:outline-none focus:border-forkbot-sky focus:ring-1 focus:ring-forkbot-sky " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

const fieldError =
  "border-red-600 focus:border-red-500 focus:ring-red-500";

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, iconLeft, iconRight, wrapperClassName = "", className = "", ...rest }, ref) {
    return (
      <FormGroup label={label} error={error} hint={hint} className={wrapperClassName}>
        <div className="relative">
          {iconLeft && (
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
              {iconLeft}
            </span>
          )}
          <input
            ref={ref}
            className={[
              fieldBase,
              error ? fieldError : "",
              iconLeft  ? "pl-8" : "px-3",
              iconRight ? "pr-8" : "pr-3",
              "py-2",
              className,
            ].join(" ")}
            {...rest}
          />
          {iconRight && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
              {iconRight}
            </span>
          )}
        </div>
      </FormGroup>
    );
  }
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, hint, wrapperClassName = "", className = "", rows = 4, ...rest }, ref) {
    return (
      <FormGroup label={label} error={error} hint={hint} className={wrapperClassName}>
        <textarea
          ref={ref}
          rows={rows}
          className={[fieldBase, "px-3 py-2 resize-y", error ? fieldError : "", className].join(" ")}
          {...rest}
        />
      </FormGroup>
    );
  }
);

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, error, hint, wrapperClassName = "", className = "", children, ...rest }, ref) {
    return (
      <FormGroup label={label} error={error} hint={hint} className={wrapperClassName}>
        <select
          ref={ref}
          className={[
            fieldBase,
            "px-3 py-2 pr-8 appearance-none bg-no-repeat",
            "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2371717a' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")] bg-[right_0.5rem_center] bg-[length:1rem]",
            error ? fieldError : "",
            className,
          ].join(" ")}
          {...rest}
        >
          {children}
        </select>
      </FormGroup>
    );
  }
);

export function FormGroup({ label, htmlFor, error, hint, className = "", children }: FormGroupProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs font-medium text-zinc-400 uppercase tracking-wide"
        >
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
