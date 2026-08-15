import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Produces a minimal .next/standalone/server.js + pruned node_modules —
  // apps/web/Dockerfile's runtime stage only copies that output, not the
  // full node_modules tree.
  output: "standalone",
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
