import type { NextConfig } from "next";

// `BUILD_TARGET=demo pnpm build` produces a static `out/` directory
// (Next.js `output: "export"`) suitable for Hugging Face Spaces (Static SDK).
// The default build keeps full Next features so future API routes / middleware
// in the production deployment continue to work.
const isDemoBuild = process.env.BUILD_TARGET === "demo";

const nextConfig: NextConfig = {
  output: isDemoBuild ? "export" : undefined,
};

export default nextConfig;
