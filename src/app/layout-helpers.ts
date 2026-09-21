import { Gelasio, Work_Sans } from "next/font/google";

// Self-hosted at build time by next/font — no runtime Google request, and the
// assetPrefix/basePath is applied automatically so the fonts load under the
// GitHub Pages project subpath.
const gelasio = Gelasio({
  variable: "--font-gelasio",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const fontString = `${gelasio.variable} ${workSans.variable} antialiased`;
