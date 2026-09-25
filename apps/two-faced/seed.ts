import { runSeed } from "@longitude/kit/server";
import { buildTwoFaced } from "./lib/data";

await runSeed({ app: "two-faced", cap: 100, build: buildTwoFaced });
