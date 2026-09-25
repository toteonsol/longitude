import { runSeed } from "@longitude/kit/server";
import { buildMenagerie } from "./lib/data";

await runSeed({ app: "menagerie", cap: 100, build: buildMenagerie });
