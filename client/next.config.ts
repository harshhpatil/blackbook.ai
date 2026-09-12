import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep development compilation within a predictable CPU budget.
    cpus: 2,
  },
  turbopack: {},
  webpack: (config, { dev }) => {
    // Avoid spawning a worker per available CPU while developing.
    if (dev) {
      config.parallelism = 1;
    }

    return config;
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
