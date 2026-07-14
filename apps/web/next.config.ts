import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/api-client"],

  // `standalone` emits the self-contained server the Docker image runs. In a
  // monorepo the file trace has to start at the repo root: left to itself Next
  // only walks apps/web, and the workspace packages never make it into the
  // bundle.
  output: "standalone",
  outputFileTracingRoot: path.join(here, "../.."),
};

export default nextConfig;
