import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These workspace packages ship TypeScript source via their exports maps.
  transpilePackages: ["@aisas/shared", "@aisas/auto-submit"],
  // Keep Playwright out of the bundle. It is only ever loaded at runtime via a gated
  // dynamic import in the local-only auto-submit routes (never on Railway).
  serverExternalPackages: ["playwright", "playwright-core"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize the whole Playwright family — including deep subpath imports like
      // `chromium-bidi/lib/cjs/...` that serverExternalPackages alone doesn't catch —
      // so webpack never tries to bundle Playwright's native loader.
      const externals = (config.externals as unknown[]) ?? [];
      externals.push(
        (
          data: { request?: string },
          callback: (err?: Error | null, result?: string) => void,
        ) => {
          const request = data.request;
          if (request && /^(playwright|playwright-core|chromium-bidi)(\/|$)/.test(request)) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      );
      config.externals = externals;
    }
    return config;
  },
};

export default nextConfig;
