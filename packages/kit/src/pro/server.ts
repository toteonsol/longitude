import { type NansenClient, createNansen, defaultCache, defaultSinks } from "@longitude/nansen";
import { sharedSink } from "../social/logsink";
import { NextResponse, type NextRequest } from "next/server";

export interface ProConfig {
  payTo: string;
  network: string;
  price: string;
  facilitator: string;
}

/** Reads the x402 configuration; undefined when X402_PAY_TO is not set (feature hidden). */
export function proConfig(): ProConfig | undefined {
  const payTo = process.env.X402_PAY_TO ?? process.env.NEXT_PUBLIC_X402_PAY_TO;
  if (!payTo) return undefined;
  const network = process.env.X402_NETWORK ?? "eip155:84532";
  return {
    payTo,
    network,
    price: process.env.X402_PRICE ?? "$0.05",
    facilitator: process.env.X402_FACILITATOR ?? (network === "eip155:8453" ? "https://facilitator.payai.network" : "https://x402.org/facilitator"),
  };
}

/**
 * `export const { GET } = createProRefreshRoute("rewind", buildRewind)` in `app/api/pro-refresh/route.ts`.
 * The visitor pays the configured USDC price over x402; the handler re-runs the app's builder with
 * every Nansen call forced fresh, which also warms the shared cache, so the page's next `?live=1`
 * render serves the paid, fresh data. Settlement only happens after the handler succeeds.
 */
export function createProRefreshRoute<T>(app: string, build: (nansen: NansenClient) => Promise<T>) {
  const cfg = proConfig();

  const handler = async (_req: NextRequest): Promise<NextResponse<unknown>> => {
    const shared = sharedSink();
    const nansen = createNansen({ script: `pro:${app}`, fresh: true, cache: defaultCache(), creditCap: Number(process.env.NANSEN_CREDIT_CAP ?? 300), logger: shared ? [...defaultSinks(), shared] : undefined });
    const data = await build(nansen);
    await nansen.log.flush();
    return NextResponse.json({ ok: true, app, credits: nansen.credits.spent, generatedAt: new Date().toISOString(), data });
  };

  if (!cfg) {
    const GET = async (): Promise<NextResponse<unknown>> => NextResponse.json({ ok: false, error: "pro refresh is not configured (X402_PAY_TO)" }, { status: 404 });
    return { GET };
  }

  let wrapped: ((req: NextRequest) => Promise<NextResponse<unknown>>) | undefined;
  const GET = async (req: NextRequest): Promise<NextResponse<unknown>> => {
    if (!wrapped) {
      const [{ withX402 }, { x402ResourceServer, HTTPFacilitatorClient }, { ExactEvmScheme }] = await Promise.all([
        import("@x402/next"),
        import("@x402/core/server"),
        import("@x402/evm/exact/server"),
      ]);
      const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: cfg.facilitator }));
      server.register("eip155:*", new ExactEvmScheme());
      wrapped = withX402(
        handler,
        {
          "/api/pro-refresh": {
            accepts: [{ scheme: "exact", price: cfg.price, network: cfg.network as `${string}:${string}`, payTo: cfg.payTo }],
            description: `Fresh Nansen pull for LONGITUDE / ${app}`,
            mimeType: "application/json",
          },
        },
        server,
      );
    }
    return wrapped(req);
  };
  return { GET };
}
