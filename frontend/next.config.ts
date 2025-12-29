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
    // Railway provides NEXT_PUBLIC_API_URL during the build/runtime.
    // If not found, it defaults to the local dev backend.
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";
    console.log(`[Config] Proxying /api to ${backendUrl}`);
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
