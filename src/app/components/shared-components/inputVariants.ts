export type InputVariant = "outline" | "compact";

// Shared base styling for the form inputs. "outline" matches the look the
// onboarding flow has always used: an Atomic Age control-outline box on raised
// paper that turns primary on focus (the global focus ring marks it too). "compact" is the dense scale for tool panels
// (admin editors, inspectors): 32px tall, 13px text, lighter border.
export const INPUT_VARIANT_CLASS: Record<InputVariant, string> = {
  outline:
    "type-input min-h-11 sm:min-h-10 border border-border-control rounded-sm px-4 py-2 bg-surface-raised text-ink hover:border-ink-secondary focus:outline-none focus:border-primary",
  compact:
    "text-[13px] leading-5 font-medium min-h-8 border border-border-control rounded-sm px-2.5 py-1 bg-surface-raised text-ink hover:border-ink-secondary focus:outline-none focus:border-primary",
};
