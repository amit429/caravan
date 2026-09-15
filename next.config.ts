import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  agentRules: false,
  // Standalone output traces the exact dependency subset each route needs
  // and copies it into .next/standalone — that's what lets the Docker image
  // ship a `node server.js` runtime instead of `node_modules` plus a full
  // `next start`, which is most of the image-size difference.
  output: "standalone",
};

export default nextConfig;
