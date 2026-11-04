import type { Metadata, Viewport } from "next";
import { Fraunces, Jost, Work_Sans } from "next/font/google";
import { shareBase } from "@/lib/config";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["600"] });
const jost = Jost({ variable: "--font-jost", subsets: ["latin"], weight: ["600"] });
const workSans = Work_Sans({ variable: "--font-work-sans", subsets: ["latin"], weight: ["400", "500"] });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1ede7" },
    { media: "(prefers-color-scheme: dark)", color: "#151311" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(shareBase()),
  title: "Animatron",
  description: "A composition shared from Animatron, the browser-based animation studio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${jost.variable} ${workSans.variable}`}>{children}</body>
    </html>
  );
}
