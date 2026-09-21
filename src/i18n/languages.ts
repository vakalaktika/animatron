export const supportedLanguages = ["en", "es"] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

// Type guard to check if a string is a supported language
export const isSupportedLanguage = (lang: string): lang is SupportedLanguage => {
  return supportedLanguages.includes(lang as SupportedLanguage);
};
