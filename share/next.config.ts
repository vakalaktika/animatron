import type { NextConfig } from "next";
import path from "path";

// The share service: a small Next app deployed on its own (Vercel, root
// directory `share`). The studio stays a static site; this is the one
// place it talks to a server.
const nextConfig: NextConfig = {
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
