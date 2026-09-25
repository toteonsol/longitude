import { runSeed } from "@longitude/kit/server";
import { buildDynasties } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
// Cap 45: a normal seed costs 17 credits, DEEP=1 (12 houses) costs 29.
runSeed({ app: "dynasties", cap: 45, build: buildDynasties }).catch((err) => {
  console.error(err);
  process.exit(1);
});
