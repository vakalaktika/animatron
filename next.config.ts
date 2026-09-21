import type { NextConfig } from "next";
import path from "path";

// Static export for GitHub Pages. CI injects NEXT_PUBLIC_BASE_PATH as
// "/<repo-name>" so assets and routing resolve under the project subpath.
// Locally (unset) it defaults to "" so `npx serve out` works at the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // This is a self-contained project nested under a larger repo. Pin the
  // workspace root so Turbopack doesn't climb to the parent lockfile.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
