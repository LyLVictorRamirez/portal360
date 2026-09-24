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
      {
        destination: `${apiOrigin}/api/requirements/:path*`,
        source: "/api/requirements/:path*",
      },
      {
        destination: `${apiOrigin}/api/tickets/:path*`,
        source: "/api/tickets/:path*",
      },
      {
        destination: `${apiOrigin}/api/activities/:path*`,
        source: "/api/activities/:path*",
      },
      {
        destination: `${apiOrigin}/api/activity-categories/:path*`,
        source: "/api/activity-categories/:path*",
      },
    ];
  },
};

export default nextConfig;
