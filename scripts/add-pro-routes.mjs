// Adds app/api/pro-refresh/route.ts to every app, wired to its builder in lib/data.ts. Idempotent.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const id of fs.readdirSync(path.join(root, "apps")).sort()) {
  const data = path.join(root, "apps", id, "lib", "data.ts");
  if (!fs.existsSync(data)) continue;
  const fn = fs.readFileSync(data, "utf8").match(/export async function (build\w+)\(/)?.[1];
  if (!fn) {
    console.log(`WARN ${id}: no build function found`);
    continue;
  }
  const dir = path.join(root, "apps", id, "app", "api", "pro-refresh");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "route.ts"),
    `import { createProRefreshRoute } from "@longitude/kit/pro-server";
import { ${fn} } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const { GET } = createProRefreshRoute("${id}", ${fn});
`,
  );
  console.log(`pro route: ${id} → ${fn}`);
}
