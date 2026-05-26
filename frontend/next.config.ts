import type { NextConfig } from "next";

// `BUILD_TARGET=demo pnpm build` produces a static `out/` directory
// (Next.js `output: "export"`) suitable for Hugging Face Spaces (Static SDK).
// The default build keeps full Next features so future API routes / middleware
// in the production deployment continue to work.
const isDemoBuild = process.env.BUILD_TARGET === "demo";

// Security headers. Only registered for the non-demo build because Next.js
// `output: "export"` ignores `headers()` (there's no server). The HF Spaces
// demo is static + read-only anyway; the higher-value attack surface is the
// self-hosted backend, which this build serves.
const securityHeaders = [
  // Block embedding in iframes from any origin (clickjacking defense).
  { key: "X-Frame-Options", value: "DENY" },
  // Disable browser MIME-sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't send the full referrer cross-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop features we never use; reduces the attack surface for compromised deps.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  output: isDemoBuild ? "export" : undefined,
  ...(isDemoBuild
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: securityHeaders,
            },
          ];
        },
      }),
};

export default nextConfig;
