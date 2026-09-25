import { createProRefreshRoute } from "@longitude/kit/pro-server";
import { buildLastOnesOut } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const { GET } = createProRefreshRoute("last-ones-out", buildLastOnesOut);
