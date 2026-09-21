/**
 * Capitalizes the first character of a pill/tag label, preserving the rest so
 * acronyms ("SQL", "AWS") and camelCase ("JavaScript") stay intact while custom
 * entries like "python" render as "Python". Used to standardize pill display.
 */
export function capitalizeFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/**
 * Uppercases the first letter of every whitespace-separated word, leaving
 * the rest of each word untouched. Used when a user adds a freeform tag
 * (job title or location) so casual typing like "developer advocate" is
 * normalized to "Developer Advocate" while pre-cased acronyms typed
 * mid-string survive ("UX writer" → "UX Writer", "Boston, MA" → "Boston,
 * MA"). The regex only matches `[a-z]` at word starts, so any
 * already-uppercase letter is left alone.
 */
export function titleCaseTag(value: string): string {
  return value.replace(
    /(^|\s)([a-z])/g,
    (_, prefix, letter) => prefix + letter.toUpperCase(),
  );
}
