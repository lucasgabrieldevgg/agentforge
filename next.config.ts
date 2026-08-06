import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Headers to help with bfcache (back-forward cache) so the page doesn't reload
  // when the user switches tabs and comes back.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow bfcache to work
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      {
        // Static assets can be cached aggressively
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
