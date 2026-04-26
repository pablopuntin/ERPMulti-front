import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false,
  experimental: {
    optimizeCss: false  // evita Tailwind v4 runtime
  }
};

export default nextConfig;
