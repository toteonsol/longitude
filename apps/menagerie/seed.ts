import { runSeed } from "@longitude/kit/server";
import { buildMenagerie } from "./lib/data";

// No top-level await here: app packages are CommonJS to tsx.
runSeed({ app: "menagerie", cap: 100, build: buildMenagerie }).catch((err) => {
  console.error(err);
  process.exit(1);
});
