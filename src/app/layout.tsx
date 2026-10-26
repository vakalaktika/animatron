import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/i18n/I18nProvider";
import { fontString } from "./layout-helpers";
import { ServiceWorker } from "./ServiceWorker";
import "./styles/globals.css";
import "./motion-studio/studio-motion.css";

export const viewport: Viewport = {
  // Lets the phone layout reach the screen edges and pad with safe-area insets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Animatron",
  description: "Animatron — a browser-based animation and motion design studio.",
  robots: { index: false, follow: false },
  applicationName: "Animatron",
  icons: { icon: `${base}/icons/icon.svg`, apple: `${base}/icons/apple-touch-icon.png` },
  appleWebApp: { capable: true, title: "Animatron", statusBarStyle: "default" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={fontString}>
        <I18nProvider>{children}</I18nProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
