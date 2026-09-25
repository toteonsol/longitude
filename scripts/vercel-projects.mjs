// Ensures one Vercel project per app with the right monorepo root directory, using the Vercel CLI's
// local login. Usage: node scripts/vercel-projects.mjs            → writes deploy/vercel-projects.json
//                     node scripts/vercel-projects.mjs env KEY VALUE [production|preview|all] → sets a plain env var on every project
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = process.platform === "darwin" ? path.join(os.homedir(), "Library/Application Support/com.vercel.cli") : path.join(os.homedir(), ".config/com.vercel.cli");
const token = JSON.parse(fs.readFileSync(path.join(cliDir, "auth.json"), "utf8")).token;
const teamId = JSON.parse(fs.readFileSync(path.join(cliDir, "config.json"), "utf8")).currentTeam;
if (!token || !teamId) throw new Error("vercel CLI is not logged in or has no current team");

const api = async (method, url, body) => {
  const res = await fetch(`https://api.vercel.com${url}${url.includes("?") ? "&" : "?"}teamId=${teamId}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  return json;
};

const apps = fs.readdirSync(path.join(root, "apps")).filter((id) => fs.existsSync(path.join(root, "apps", id, "package.json"))).sort();
const projectName = (id) => (id === "store" ? "longitude" : `longitude-${id}`);

async function ensureProjects() {
  const out = {};
  for (const id of apps) {
    const name = projectName(id);
    const rootDirectory = `apps/${id}`;
    let p;
    try {
      p = await api("GET", `/v9/projects/${name}`);
      if (p.rootDirectory !== rootDirectory || p.framework !== "nextjs") p = await api("PATCH", `/v9/projects/${name}`, { rootDirectory, framework: "nextjs" });
    } catch {
      p = await api("POST", "/v11/projects", { name, framework: "nextjs", rootDirectory });
    }
    const domains = await api("GET", `/v9/projects/${p.id}/domains`);
    const prod = (domains.domains ?? []).map((d) => d.name).find((d) => d.endsWith(".vercel.app")) ?? null;
    out[id] = { id: p.id, name, orgId: teamId, rootDirectory, url: prod ? `https://${prod}` : null };
    console.log(`${id.padEnd(20)} ${name.padEnd(28)} ${p.id}  ${out[id].url ?? "(no domain yet)"}`);
  }
  fs.mkdirSync(path.join(root, "deploy"), { recursive: true });
  fs.writeFileSync(path.join(root, "deploy/vercel-projects.json"), JSON.stringify(out, null, 2) + "\n");
  return out;
}

async function setEnv(key, value, target) {
  const projects = JSON.parse(fs.readFileSync(path.join(root, "deploy/vercel-projects.json"), "utf8"));
  const targets = target === "all" || !target ? ["production", "preview"] : [target];
  for (const [id, p] of Object.entries(projects)) {
    const existing = await api("GET", `/v9/projects/${p.id}/env`);
    for (const e of (existing.envs ?? []).filter((e) => e.key === key)) await api("DELETE", `/v9/projects/${p.id}/env/${e.id}`);
    await api("POST", `/v10/projects/${p.id}/env?upsert=true`, { key, value, type: "plain", target: targets });
    console.log(`env ${key} set on ${id}`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "env") await setEnv(rest[0], rest[1], rest[2]);
else await ensureProjects();
