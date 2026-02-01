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
    // NOTE: rewrites are compiled at build time; if Railway's build env doesn't include
    // NEXT_PUBLIC_API_URL (or the deploy is cached), the proxy can break in prod.
    // We provide a hard fallback to the known Railway backend domain for demos.
    const isProd = process.env.NODE_ENV === "production";
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.BACKEND_URL ||
      (isProd ? "https://roleferry-production.up.railway.app" : "http://localhost:8001");
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
