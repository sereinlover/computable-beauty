import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Produces a minimal .next/standalone/server.js + pruned node_modules —
  // apps/web/Dockerfile's runtime stage only copies that output, not the
  // full node_modules tree.
  output: "standalone",
  turbopack: {
    // Without this, Turbopack's own workspace-root auto-detection can pick
    // the wrong directory (falls back to scanning upward for a lockfile) and
    // then fail to resolve `next` at all once it hits a route it hasn't
    // compiled yet — pinning it to this project's own directory removes the
    // guesswork.
    root: import.meta.dirname,
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
