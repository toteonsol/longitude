import { runSeed } from "@longitude/kit/server";
import { buildTwoFaced } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
runSeed({ app: "two-faced", cap: 40, build: buildTwoFaced }).catch((err) => {
  console.error(err);
  process.exit(1);
});
