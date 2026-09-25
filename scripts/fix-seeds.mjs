// Normalizes apps/*/seed.ts to a form without top-level await (apps are CJS packages for tsx).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const id of fs.readdirSync(path.join(root, "apps")).sort()) {
  const file = path.join(root, "apps", id, "seed.ts");
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  const cap = Number(src.match(/cap:\s*(\d+)/)?.[1] ?? 100);
  const fn = src.match(/import \{ (build\w+) \} from "\.\/lib\/data"/)?.[1];
  const name = src.match(/name:\s*"([^"]+)"/)?.[1];
  if (!fn) { console.log(`skip ${id}: no build import found`); continue; }
  const out = `import { runSeed } from "@longitude/kit/server";
import { ${fn} } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
runSeed({ app: "${id}", ${name ? `name: "${name}", ` : ""}cap: ${cap}, build: ${fn} }).catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
  if (out !== src) { fs.writeFileSync(file, out); console.log(`fixed ${id} (cap ${cap})`); }
}
