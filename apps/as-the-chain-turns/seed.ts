import { runSeed } from "@longitude/kit/server";
import { buildAsTheChainTurns } from "./lib/data";

await runSeed({ app: "as-the-chain-turns", cap: 100, build: buildAsTheChainTurns });
