const path = require("path");

const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL || process.env.REACT_APP_API_BASE_URL || "/api",
    REACT_APP_API_BASE_URL:
      process.env.REACT_APP_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "/api",
    NEXT_PUBLIC_BACKEND_URL:
      process.env.NEXT_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || "",
    REACT_APP_BACKEND_URL:
      process.env.REACT_APP_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "",
    NEXT_PUBLIC_GOOGLE_AUTH_START_URL:
      process.env.NEXT_PUBLIC_GOOGLE_AUTH_START_URL ||
      process.env.REACT_APP_GOOGLE_AUTH_START_URL ||
      "",
    REACT_APP_GOOGLE_AUTH_START_URL:
      process.env.REACT_APP_GOOGLE_AUTH_START_URL ||
      process.env.NEXT_PUBLIC_GOOGLE_AUTH_START_URL ||
      "",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.REACT_APP_VAPID_PUBLIC_KEY || "",
    REACT_APP_VAPID_PUBLIC_KEY:
      process.env.REACT_APP_VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
    NEXT_PUBLIC_POSTHOG_KEY:
      process.env.NEXT_PUBLIC_POSTHOG_KEY || "",
    NEXT_PUBLIC_POSTHOG_HOST:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    NEXT_PUBLIC_ENABLE_SERVICE_WORKER:
      process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER || "true",
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
      "react-router-dom": path.resolve(__dirname, "src/lib/router.js"),
    };

    return config;
  },
  async rewrites() {
    if (!apiProxyTarget) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
