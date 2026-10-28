import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "@prisma/adapter-libsql"],
  },
};

export default nextConfig;
