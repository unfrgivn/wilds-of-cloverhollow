import { parseSave, serializeSave, type State, type World } from "../core";

export type SaveBackupEnvelope = {
  app: "wilds-of-cloverhollow";
  format: 1;
  exportedAt: string;
  area: string;
  areaName: string;
  stickers: number;
  save: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Builds a clean lowercase filename for an exported portable save backup. */
export function saveBackupFilename(area: string, tick: number): string {
  const cleaned = area
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const clean = cleaned.length > 0 ? cleaned : "cloverhollow";
  const safeTick = Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
  return `cloverhollow-save-${clean}-${safeTick}.json`;
}

/** Formats the current save state as a pretty-printed portable backup envelope. */
export function formatSaveBackup(
  state: State,
  world: Pick<World, "areas">,
  exportedAtIso: string,
): string {
  const areaName = world.areas[state.area]?.name ?? state.area;
  const envelope: SaveBackupEnvelope = {
    app: "wilds-of-cloverhollow",
    format: 1,
    exportedAt: exportedAtIso,
    area: state.area,
    areaName,
    stickers: state.stickers.length,
    save: serializeSave(state),
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

/**
 * Parses either a portable SaveBackupEnvelope or a raw `serializeSave` JSON
 * string through `parseSave`, returning null for any malformed or invalid data.
 */
export function parseSaveBackup(
  raw: string,
  fresh: State,
  speciesXp: Readonly<Record<string, number>>,
  thresholds: readonly number[],
): State | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const xpMap: Record<string, number> = { ...speciesXp };
    const levelThresholds: number[] = [...thresholds];
    if ("app" in parsed || "format" in parsed || "save" in parsed) {
      if (
        parsed.app !== "wilds-of-cloverhollow" ||
        parsed.format !== 1 ||
        typeof parsed.save !== "string"
      ) {
        return null;
      }
      return parseSave(parsed.save, fresh, xpMap, levelThresholds);
    }
    return parseSave(raw, fresh, xpMap, levelThresholds);
  } catch {
    return null;
  }
}
