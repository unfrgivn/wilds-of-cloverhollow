import { loadContent } from "../src/content/load";
import { createInkState } from "../src/core/ink";
import { auditAreaNavigation, type NavAuditReport } from "../src/core/nav";
import { sceneryArea } from "../src/core/props";
import type { Area } from "../src/core/types";

function parseAreaArg(argv: readonly string[]): string | null {
  const idx = argv.indexOf("--area");
  if (idx < 0) return null;
  const value = argv[idx + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error("Usage: bun tools/audit-navigation.ts [--area <id>]");
  }
  return value;
}

function padLeft(value: string, width: number): string {
  return value.length >= width ? value : " ".repeat(width - value.length) + value;
}

function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

const requestedArea = parseAreaArg(process.argv.slice(2));
const { world } = loadContent();
const initialInk = createInkState(world.story, 1);
const radius = world.tunables.playerRadius;

const allAreas = Object.values(world.areas).sort((a, b) => a.id.localeCompare(b.id));
let targetAreas: Area[] = allAreas;
if (requestedArea !== null) {
  const found = world.areas[requestedArea];
  if (found === undefined) {
    const valid = allAreas.map((a) => a.id).join(", ");
    throw new Error(`Unknown area "${requestedArea}". Valid areas: ${valid}`);
  }
  targetAreas = [found];
}

const reports: NavAuditReport[] = [];
for (const area of targetAreas) {
  const scenery = sceneryArea(world, initialInk, area);
  const staticNpcFootprints = area.npcs
    .filter((npc) => npc.stroll === undefined)
    .map((npc) => npc.footprint);
  const fullArea: Area = {
    ...scenery,
    blockers: [...scenery.blockers, ...staticNpcFootprints],
  };
  reports.push(auditAreaNavigation(fullArea, radius));
}

const nameWidth = Math.max(4, ...reports.map((r) => r.areaId.length));
const header = [
  padRight("Area", nameWidth),
  padLeft("Free", 6),
  padLeft("Reach", 6),
  padLeft("Unrch", 6),
  padLeft("Tight", 6),
  padLeft("FlsGp", 6),
  padLeft("MinSpn", 7),
  padLeft("Clust", 5),
].join("  ");
console.log(header);
console.log("-".repeat(header.length));

for (const report of reports) {
  console.log(
    [
      padRight(report.areaId, nameWidth),
      padLeft(String(report.freeCells), 6),
      padLeft(String(report.reachableCells), 6),
      padLeft(String(report.unreachableCells), 6),
      padLeft(String(report.tightCells), 6),
      padLeft(String(report.falseGapCells), 6),
      padLeft(report.minSpawnClearance.toFixed(1), 7),
      padLeft(String(report.unreachableClusters.length), 5),
    ].join("  "),
  );
}

const allClusters = reports
  .flatMap((report) =>
    report.unreachableClusters.map((cluster) => ({
      areaId: report.areaId,
      ...cluster,
    })),
  )
  .sort((a, b) => b.count - a.count);

console.log("");
console.log(`Top unreachable clusters (${allClusters.length} total):`);
if (allClusters.length === 0) {
  console.log("  none");
} else {
  for (const cluster of allClusters.slice(0, 10)) {
    const cx = Math.round(cluster.cx);
    const cy = Math.round(cluster.cy);
    console.log(
      `  ${padRight(cluster.areaId, nameWidth)}  ${padLeft(String(cluster.count), 5)} cells` +
        `  at (${cx}, ${cy})`,
    );
  }
}

if (reports.length > 1) {
  const byUnreachable = [...reports]
    .filter((r) => r.unreachableCells > 0)
    .sort((a, b) => b.unreachableCells - a.unreachableCells)
    .slice(0, 5);
  console.log("");
  console.log("Worst areas by unreachable cells:");
  if (byUnreachable.length === 0) {
    console.log("  none");
  } else {
    for (const r of byUnreachable) {
      console.log(
        `  ${padRight(r.areaId, nameWidth)}  unreachable=${r.unreachableCells}` +
          `  clusters=${r.unreachableClusters.length}`,
      );
    }
  }

  const byTightness = [...reports]
    .sort((a, b) => b.tightCells + b.falseGapCells - (a.tightCells + a.falseGapCells))
    .slice(0, 5);
  console.log("");
  console.log("Worst areas by tight + false-gap cells:");
  for (const r of byTightness) {
    console.log(
      `  ${padRight(r.areaId, nameWidth)}  tight=${r.tightCells}` +
        `  falseGap=${r.falseGapCells}  minSpawn=${r.minSpawnClearance.toFixed(1)}`,
    );
  }
}
