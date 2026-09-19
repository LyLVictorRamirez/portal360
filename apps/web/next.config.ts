import type { NextConfig } from "next";

const apiOrigin = (process.env.API_ORIGIN ?? "http://localhost:3001").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        destination: `${apiOrigin}/api/auth/:path*`,
        source: "/api/auth/:path*",
      },
      {
        destination: `${apiOrigin}/api/authorization/:path*`,
        source: "/api/authorization/:path*",
      },
      {
        destination: `${apiOrigin}/api/clients/:path*`,
        source: "/api/clients/:path*",
      },
      {
        destination: `${apiOrigin}/api/projects/:path*`,
        source: "/api/projects/:path*",
      },
    ];
  },
};

export default nextConfig;
