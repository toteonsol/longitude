import { createProRefreshRoute } from "@longitude/kit/pro-server";
import { buildDynasties } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const { GET } = createProRefreshRoute("dynasties", buildDynasties);
