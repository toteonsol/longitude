import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

const headers = { "content-type": "application/json", "cache-control": "public, max-age=60, s-maxage=60", "access-control-allow-origin": "*" };

/** GET /snapshots/manifest.json and GET /snapshots/<app>/<name>.json */
http.route({
  pathPrefix: "/snapshots/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const path = new URL(req.url).pathname.replace(/^\/snapshots\//, "").replace(/\.json$/, "");
    if (path === "manifest") return new Response(JSON.stringify(await ctx.runQuery(api.snapshots.manifest, {})), { headers });
    const [app, name = "main"] = path.split("/");
    if (!app) return new Response("not found", { status: 404 });
    const json = await ctx.runQuery(api.snapshots.get, { app, name });
    if (!json) return new Response("not found", { status: 404 });
    return new Response(json, { headers });
  }),
});

export default http;
