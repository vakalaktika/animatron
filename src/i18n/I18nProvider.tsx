"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "./config";
import { isSupportedLanguage } from "./languages";

const LANG_KEY = "motion-studio:lang";

/**
 * Client-only i18n provider for the static export. English is used for the
 * first (server-rendered) paint to match hydration; after mount it switches to
 * a saved choice or the browser language if that resolves to a supported one.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = window.localStorage.getItem(LANG_KEY);
    const browser = window.navigator.language.split("-")[0];
    const next = stored ?? browser;
    if (isSupportedLanguage(next) && next !== i18n.language) {
      void i18n.changeLanguage(next);
    }
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
