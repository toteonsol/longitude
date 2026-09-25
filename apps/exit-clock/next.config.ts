import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// Load the monorepo's root .env into this app's process (Next only reads env files from the app
// directory). A no-op on Vercel, where the file does not exist and env vars come from the project.
for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(resolve(process.cwd(), "../..", file), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1] as string] === undefined) process.env[m[1] as string] = (m[2] as string).replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no root env file here */
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ["@longitude/kit", "@longitude/motion", "@longitude/nansen"],
  outputFileTracingIncludes: { "/*": ["./snapshots/**/*"] },
};

export default nextConfig;
