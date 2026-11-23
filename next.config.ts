import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Live business data on every screen, so we use the classic dynamic rendering model.
  cacheComponents: false,
  // bill and product photos from phones are sent to server actions
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
