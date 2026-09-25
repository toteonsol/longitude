import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@longitude/kit", "@longitude/motion", "@longitude/nansen"],
  outputFileTracingIncludes: { "/*": ["./snapshots/**/*"] },
};

export default nextConfig;
