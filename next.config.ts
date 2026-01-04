import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['yahoo-finance2'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
