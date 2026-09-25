import { createProRefreshRoute } from "@longitude/kit/pro-server";
import { buildOddsVsFlow } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const { GET } = createProRefreshRoute("odds-vs-flow", buildOddsVsFlow);
