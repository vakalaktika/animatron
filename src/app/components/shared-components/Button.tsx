import React from "react";
import { motion, MotionConfig } from "motion/react";
import { SNAP } from "@/lib/motion";

export type ButtonVariant = "primary" | "outline" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export type ButtonProps = Omit<
  React.ComponentProps<typeof motion.button>,
  "children"
> & {
  children: React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  /**
   * primary — filled CTA, used for the main forward action.
   * outline — bordered button used for "+ Add" affordances and secondary
   *           actions like Back / Cancel.
   * danger  — destructive (delete account, confirm-delete) action.
   */
  variant?: ButtonVariant;
  /**
   * xs — dense tool panels: repeated or in-list actions (28px tall, 12px text).
   * sm — section-header "+ Add" / inline pill (control typography, px-3 py-1).
   * md — dialog footers and settings buttons (control typography, px-4 py-2).
   * lg — onboarding primary actions (control typography, px-6 py-3).
   */
  size?: ButtonSize;
  fullWidth?: boolean;
};

// Atomic Age button: Jost uppercase label, radius-md, a 1px outline, and
// the soft shadow-pop offset on hover.
const BASE_CLASS =
  "atm-button-type cursor-pointer rounded-md border inline-flex items-center justify-center gap-2 whitespace-nowrap leading-none transition-[background-color,box-shadow] duration-200 enabled:hover:shadow-pop disabled:opacity-[0.42] disabled:cursor-not-allowed";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-primary text-on-primary enabled:hover:bg-primary-hover",
  outline:
    "border-border-control bg-transparent text-ink enabled:hover:bg-surface-raised",
  danger: "border-transparent bg-error text-on-error",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  xs: "text-[11px] min-h-7 px-2.5 py-1",
  sm: "text-[12.5px] min-h-11 sm:min-h-10 px-3 py-1",
  md: "text-sm min-h-11 sm:min-h-10 px-4 py-2",
  lg: "text-[15px] min-h-11 sm:min-h-10 px-6 py-3",
};

/**
 * The single button primitive used across the profile, settings, and
 * onboarding flows. Three variants × three sizes. Anything button-shaped
 * should use this — not raw `<button className="px-… py-… bg-…">` — so the
 * focus ring, disabled state, hover behavior, and typography stay aligned
 * with the design system.
 */
export function Button({
  children,
  icon,
  iconPosition = "left",
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  disabled = false,
  ...props
}: ButtonProps) {
  const cls = [
    BASE_CLASS,
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <MotionConfig reducedMotion="user">
      <motion.button
        className={cls}
        disabled={disabled}
        whileHover={disabled ? undefined : { scale: 1.01 }}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        transition={SNAP}
        {...props}
      >
        {icon && iconPosition === "left" && (
          <span className="shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        {children}
        {icon && iconPosition === "right" && (
          <span className="shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
      </motion.button>
    </MotionConfig>
  );
}
