import type { NextConfig } from "next";

const apiOrigin = (process.env.API_ORIGIN ?? "http://localhost:3001").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        destination: `${apiOrigin}/api/auth/:path*`,
        source: "/api/auth/:path*",
      },
    ];
  },
};

export default nextConfig;
