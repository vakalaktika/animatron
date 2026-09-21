import { Fraunces, Jost, Work_Sans } from "next/font/google";

// Atomic Age type families. Self-hosted at build time by next/font — no
// runtime Google request, and the assetPrefix/basePath is applied
// automatically so the fonts load under the GitHub Pages project subpath.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const fontString = `${fraunces.variable} ${jost.variable} ${workSans.variable} antialiased`;
