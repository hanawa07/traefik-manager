import type { NextConfig } from "next";

const backendUpstream = process.env.BACKEND_UPSTREAM_URL || "http://backend:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUpstream}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
