import { createProRefreshRoute } from "@longitude/kit/pro-server";
import { buildTwoFaced } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const { GET } = createProRefreshRoute("two-faced", buildTwoFaced);
