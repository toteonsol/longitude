import { createProRefreshRoute } from "@longitude/kit/pro-server";
import { buildExitClock } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const { GET } = createProRefreshRoute("exit-clock", buildExitClock);
