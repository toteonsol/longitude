import { createCronSeedRoute } from "@longitude/kit/cron";
import { buildAsTheChainTurns } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const { GET } = createCronSeedRoute("as-the-chain-turns", buildAsTheChainTurns);
