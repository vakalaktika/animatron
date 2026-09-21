import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";
import { supportedLanguages } from "./languages";

export { supportedLanguages };

// Client-side init only (this file is imported from a "use client" provider),
// so static export never runs locale detection on the server. Starts on
// English; the provider switches to a stored/browser language after mount to
// avoid a hydration mismatch.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
