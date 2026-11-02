import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone" removido — next start sirve los archivos estáticos correctamente
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
