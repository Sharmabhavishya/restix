import type { NextConfig } from "next";

// Almost every page depends on who is signed in, so ResTix uses classic dynamic
// rendering instead of Cache Components (see docs/ARCHITECTURE.md).

const https = (process.env.APP_URL ?? "").startsWith("https://");

// The Content-Security-Policy is set per request (with a nonce) in src/proxy.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Room for an event cover (shrunk in the browser to ~1600px WebP; capped again on the server).
    serverActions: { bodySizeLimit: "1.5mb" },
  },
  // Free-tier friendly: free hosts meter image transformations, so ask for few sizes, one
  // modern format, and keep each result cached for a month. Our photos never change in place
  // (a new photo is a new file), so long caching is safe.
  images: {
    formats: ["image/webp"],
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [128, 256, 384],
    qualities: [75],
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Clips and posters: cache hard at the CDN and in the browser; renaming a file busts it.
      { source: "/media/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }] },
    ];
  },
};

export default nextConfig;
