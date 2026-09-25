import { runSeed } from "@longitude/kit/server";
import { buildLastOnesOut } from "./lib/data";

await runSeed({ app: "last-ones-out", cap: 100, build: buildLastOnesOut });
