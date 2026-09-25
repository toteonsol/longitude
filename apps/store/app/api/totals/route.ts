import { hasSharedStore, readTotals } from "@longitude/kit/server";
import { socialBackend } from "@longitude/social";

export const dynamic = "force-dynamic";

/** Public, transparent view of what LONGITUDE has spent on Nansen: the buildathon's proof of calls. */
export async function GET(): Promise<Response> {
  try {
    const totals = await readTotals();
    return Response.json({ ok: true, backend: socialBackend(), shared: hasSharedStore(), ...totals }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json({ ok: false, backend: socialBackend(), error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
