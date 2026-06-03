import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
