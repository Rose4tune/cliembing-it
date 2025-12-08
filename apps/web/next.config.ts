import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@pkg/auth",
    "@pkg/config",
    "@pkg/domain",
    "@pkg/env",
    "@pkg/features",
    "@pkg/shared",
    "@pkg/style",
    "@pkg/supabase",
    "@pkg/ui",
    "@pkg/ui-web",
  ],
  experimental: {
    optimizePackageImports: ["react", "react-dom"],
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
