export type InputVariant = "outline" | "compact";

// Shared base styling for the form inputs. "outline" matches the look the
// onboarding flow has always used: a bordered box on the page background with
// a CTA-colored focus ring. "compact" is the dense scale for tool panels
// (admin editors, inspectors): 32px tall, 13px text, lighter border.
export const INPUT_VARIANT_CLASS: Record<InputVariant, string> = {
  outline:
    "type-input min-h-11 sm:min-h-10 border border-background-cta rounded-md px-4 py-2 bg-background text-background-cta focus:outline-none focus:ring-2 focus:ring-background-cta-40",
  compact:
    "text-[13px] leading-5 font-medium min-h-8 border border-background-cta-30 rounded-md px-2.5 py-1 bg-background text-background-cta focus:outline-none focus:ring-2 focus:ring-background-cta-40",
};
