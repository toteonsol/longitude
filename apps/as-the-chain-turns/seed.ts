import { runSeed } from "@longitude/kit/server";
import { buildAsTheChainTurns } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
runSeed({ app: "as-the-chain-turns", cap: 20, build: buildAsTheChainTurns }).catch((err) => {
  console.error(err);
  process.exit(1);
});
