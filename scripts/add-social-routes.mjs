// Adds app/api/social/[op]/route.ts (and app/og/route.tsx for apps) to every app, and OG metadata
// to each app layout. Idempotent.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const id of fs.readdirSync(path.join(root, "apps")).sort()) {
  const dir = path.join(root, "apps", id);
  if (!fs.existsSync(path.join(dir, "package.json"))) continue;
  const routeDir = path.join(dir, "app", "api", "social", "[op]");
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(
    path.join(routeDir, "route.ts"),
    `import { createSocialRoutes } from "@longitude/kit/social-server";

export const dynamic = "force-dynamic";
export const { GET, POST } = createSocialRoutes("${id}");
`,
  );
  if (id !== "store") {
    const ogDir = path.join(dir, "app", "og");
    fs.mkdirSync(ogDir, { recursive: true });
    fs.writeFileSync(
      path.join(ogDir, "route.tsx"),
      `import { createOgRoute } from "@longitude/kit/og";

export const dynamic = "force-dynamic";
export const { GET } = createOgRoute("${id}");
`,
    );
    const layoutFile = path.join(dir, "app", "layout.tsx");
    let layout = fs.readFileSync(layoutFile, "utf8");
    if (!layout.includes("openGraph")) {
      if (!layout.includes('from "@longitude/kit"')) {
        layout = layout.replace(/import type \{ Metadata, Viewport \} from "next";\n/, 'import type { Metadata, Viewport } from "next";\nimport { appUrl } from "@longitude/kit";\n');
      }
      layout = layout.replace(
        /export const metadata: Metadata = \{\n/,
        `export const metadata: Metadata = {\n  metadataBase: new URL(appUrl("${id}")),\n  openGraph: { images: ["/og"] },\n  twitter: { card: "summary_large_image", images: ["/og"] },\n`,
      );
      if (!layout.includes("openGraph")) console.log(`WARN ${id}: layout metadata pattern not found`);
      fs.writeFileSync(layoutFile, layout);
    }
  }
  console.log(`social routes: ${id}`);
}
