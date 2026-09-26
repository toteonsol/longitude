import { createCronSeedRoute } from "@longitude/kit/cron";
import { buildOddsVsFlow } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 800;
export const { GET } = createCronSeedRoute("odds-vs-flow", buildOddsVsFlow);
