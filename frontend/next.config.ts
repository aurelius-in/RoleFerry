import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow container builds to succeed despite lint issues; dev still shows warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow container builds to proceed even if there are type errors
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
