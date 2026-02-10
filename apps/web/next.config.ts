import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appDir, "..", "..");
const cloudflareStatePath = path.join(workspaceRoot, ".wrangler", "state", "v3");

if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev({
    persist: {
      path: cloudflareStatePath,
    },
  });
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  turbopack: {
    root: workspaceRoot,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8787/api/:path*",
      },
    ];
  },
};

export default nextConfig;
