import { looksLikeAddress } from "@longitude/nansen";
import { nansenFor } from "@longitude/kit/server";

export const dynamic = "force-dynamic";

/** Zero-credit Nansen search (tokens + entities), plus wallet detection for the scout link. */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ ok: true, query: q, tokens: [], entities: [], wallet: null });
  const wallet = looksLikeAddress(q, "ethereum") ? { address: q, chain: "ethereum" } : looksLikeAddress(q, "solana") ? { address: q, chain: "solana" } : null;
  try {
    const nansen = nansenFor("app:store");
    const res = await nansen.search.general({ search_query: q, result_type: "any", limit: 8 }, { tag: `search:${q.slice(0, 12)}`, ttlMs: 60_000 });
    return Response.json({ ok: true, query: q, wallet, tokens: (res.tokens ?? []).slice(0, 6), entities: (res.entities ?? []).slice(0, 4) });
  } catch (err) {
    return Response.json({ ok: false, query: q, wallet, tokens: [], entities: [], error: err instanceof Error ? err.message : String(err) });
  }
}
