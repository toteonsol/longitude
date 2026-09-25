import { createRoot } from "react-dom/client";
import { Realm } from "../components/Realm";
import type { DynastiesData } from "../lib/data";
import snapshot from "../snapshots/main.json";

const data = (snapshot as { data: DynastiesData }).data;
createRoot(document.getElementById("root") as HTMLElement).render(<Realm data={data} />);
