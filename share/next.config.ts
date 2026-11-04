import type { NextConfig } from "next";
import path from "path";

// The share page service: a small Next app deployed on its own (Vercel,
// root directory `share`). The studio stays a static site and keeps shares
// in Supabase; this only reads them, to serve a page and card per link.
const nextConfig: NextConfig = {
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
