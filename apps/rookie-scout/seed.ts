import { runSeed } from "@longitude/kit/server";
import { buildRookieScout } from "./lib/data";

await runSeed({ app: "rookie-scout", cap: 100, build: buildRookieScout });
