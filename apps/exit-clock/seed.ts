import { runSeed } from "@longitude/kit/server";
import { buildExitClock } from "./lib/data";

await runSeed({ app: "exit-clock", cap: 100, build: buildExitClock });
