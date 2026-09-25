// Scaffold apps/<id> from the registry in packages/kit/src/apps.ts.  Usage: node scripts/new-app.mjs <id> [<id>...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = fs.readFileSync(path.join(root, "packages/kit/src/apps.ts"), "utf8");

function meta(id) {
  const m = registry.match(new RegExp(`id: "${id}",\\s*name: "([^"]+)",\\s*port: (\\d+),[\\s\\S]*?palette: \\{ bg: "([^"]+)", surface: "([^"]+)", accent: "([^"]+)", accent2: "([^"]+)", ink: "([^"]+)" \\}`));
  if (!m) throw new Error(`app ${id} not in registry`);
  return { id, name: m[1], port: Number(m[2]), bg: m[3], surface: m[4], accent: m[5], accent2: m[6], ink: m[7] };
}

const pascal = (id) => id.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join("");

for (const id of process.argv.slice(2)) {
  const a = meta(id);
  const dir = path.join(root, "apps", id);
  if (fs.existsSync(path.join(dir, "package.json"))) {
    console.log(`skip ${id} (exists)`);
    continue;
  }
  fs.mkdirSync(path.join(dir, "app"), { recursive: true });
  fs.mkdirSync(path.join(dir, "components"), { recursive: true });
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.mkdirSync(path.join(dir, "snapshots"), { recursive: true });
  const w = (f, s) => fs.writeFileSync(path.join(dir, f), s);

  w("package.json", JSON.stringify({
    name: `@longitude/${id}`,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: `next dev -p ${a.port}`,
      build: "next build",
      start: `next start -p ${a.port}`,
      typecheck: "tsc --noEmit",
      seed: "node --env-file-if-exists=../../.env --import tsx seed.ts",
    },
    dependencies: {
      "@longitude/kit": "workspace:*",
      "@longitude/motion": "workspace:*",
      "@longitude/nansen": "workspace:*",
      next: "^16.3.6",
      react: "^19.3.0",
      "react-dom": "^19.3.0",
    },
    devDependencies: {
      "@types/node": "^24.0.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      tsx: "^4.23.15",
      typescript: "^5.9.3",
    },
  }, null, 2) + "\n");

  w("next.config.ts", `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@longitude/kit", "@longitude/motion", "@longitude/nansen"],
  outputFileTracingIncludes: { "/*": ["./snapshots/**/*"] },
};

export default nextConfig;
`);

  w("tsconfig.json", JSON.stringify({
    extends: "../../tsconfig.base.json",
    compilerOptions: { jsx: "preserve", lib: ["ES2023", "DOM", "DOM.Iterable"], incremental: true, plugins: [{ name: "next" }], paths: { "@/*": ["./*"] } },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }, null, 2) + "\n");

  w("next-env.d.ts", `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`);

  w("app/globals.css", `:root {
  --lg-bg: ${a.bg};
  --lg-surface: ${a.surface};
  --lg-ink: ${a.ink};
  --lg-accent: ${a.accent};
  --lg-accent2: ${a.accent2};
  --lg-font: var(--font-body), ui-sans-serif, system-ui, sans-serif;
  --lg-font-display: var(--font-display), var(--lg-font);
  --lg-font-mono: var(--font-mono), ui-monospace, monospace;
}
`);

  w("app/layout.tsx", `import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "@longitude/kit/styles.css";
import "./globals.css";

const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const display = Inter({ subsets: ["latin"], variable: "--font-display", weight: ["600", "700"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "${a.name} · LONGITUDE",
  description: "A Nansen-powered app from the LONGITUDE store.",
};

export const viewport: Viewport = { themeColor: "${a.bg}", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={\`\${body.variable} \${display.variable} \${mono.variable}\`}>
      <body>{children}</body>
    </html>
  );
}
`);

  w("lib/data.ts", `import type { NansenClient } from "@longitude/nansen";

/** Shape of snapshots/main.json → data. Keep the seed and the page in agreement here. */
export interface ${pascal(id)}Data {
  generatedAt: string;
  items: unknown[];
}

/** Builds the app's data set. Used by seed.ts (snapshot) and by the page's "refresh live". */
export async function build${pascal(id)}(nansen: NansenClient): Promise<${pascal(id)}Data> {
  void nansen;
  return { generatedAt: new Date().toISOString(), items: [] };
}
`);

  w("app/page.tsx", `import { AppFrame, Missing, getApp } from "@longitude/kit";
import { liveFlags, loadAppData } from "@longitude/kit/server";
import { type ${pascal(id)}Data, build${pascal(id)} } from "@/lib/data";

export const dynamic = "force-dynamic";

const app = getApp("${id}");

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const flags = liveFlags(await searchParams);
  const { data, source, error } = await loadAppData<${pascal(id)}Data>({
    app: app.id,
    ...flags,
    fetchLive: ({ nansen }) => build${pascal(id)}(nansen),
  });
  return (
    <AppFrame app={app} source={source} error={error}>
      {data ? <pre>{JSON.stringify(data, null, 2).slice(0, 2000)}</pre> : <Missing app={app} />}
    </AppFrame>
  );
}
`);

  w("seed.ts", `import { runSeed } from "@longitude/kit/server";
import { build${pascal(id)} } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
runSeed({ app: "${id}", cap: 100, build: build${pascal(id)} }).catch((err) => {
  console.error(err);
  process.exit(1);
});
`);

  w("snapshots/.gitkeep", "");
  console.log(`scaffolded apps/${id} (${a.name}, :${a.port})`);
}
