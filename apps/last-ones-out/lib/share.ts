import type { LastOnesOutData } from "./data";

/** The line that goes out with a share: how many buildings retail is still buying into while smart money leaves. */
export function shareText(data: LastOnesOutData): string {
  const n = data.buildings.filter((b) => b.retailNetFlow7dUsd > 0).length;
  return `${n} token${n === 1 ? "" : "s"} where smart money already left and retail is still buying. Tonight's skyline on Last Ones Out, LONGITUDE, built on @nansen_ai`;
}
