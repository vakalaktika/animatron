import type { ComponentProps, ReactNode } from "react";

/** 44px square icon control for app bars and drawer headers. Always labelled. */
export function IconButton({
  label,
  children,
  pressed,
  className = "",
  ...rest
}: Omit<ComponentProps<"button">, "aria-label"> & { label: string; children: ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 ${
        pressed ? "bg-primary-soft text-primary" : "text-ink-secondary hover:bg-surface-sunken hover:text-ink"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
