import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source via its exports map.
  transpilePackages: ["@aisas/shared"],
};

export default nextConfig;
