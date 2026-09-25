import { createProRefreshRoute } from "@longitude/kit/pro-server";
import { buildAsTheChainTurns } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const { GET } = createProRefreshRoute("as-the-chain-turns", buildAsTheChainTurns);
