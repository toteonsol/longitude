import { createProRefreshRoute } from "@longitude/kit/pro-server";
import { buildRookieScout } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const { GET } = createProRefreshRoute("rookie-scout", buildRookieScout);
