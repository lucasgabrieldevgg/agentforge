import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Don't use standalone output on Vercel — Vercel handles it natively
  // (output: "standalone" is for Docker / bare-metal)
};

export default nextConfig;
