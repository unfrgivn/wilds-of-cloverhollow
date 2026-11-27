import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  blankInput,
  createState,
  serializeSave,
  stableHash,
  step,
  type State,
} from "../../src/core";
import { shouldResumeAudioOnVisible, type AudioState } from "../../src/platform/audio";
import {
  formatSaveBackup,
  parseSaveBackup,
  saveBackupFilename,
} from "../../src/shell/save-backup";

describe("Milestone 132: iOS Audio Auto-Resume, Portable Save Backup & Plaza Smoke Route", () => {
  it("resumes audio on visibility return only when visible and suspended or interrupted", () => {
    const cases: readonly [boolean, AudioState, boolean][] = [
      [false, "interrupted", true],
      [false, "suspended", true],
      [false, "running", false],
      [false, "closed", false],
      [false, "unavailable", false],
      [true, "interrupted", false],
      [true, "suspended", false],
      [true, "running", false],
      [true, "closed", false],
      [true, "unavailable", false],
    ];
    for (const [hidden, state, expected] of cases) {
      expect(shouldResumeAudioOnVisible(hidden, state)).toBe(expected);
    }
  });

  it("sanitizes portable save backup filenames safely across area names and ticks", () => {
    expect(saveBackupFilename("plaza", 420)).toBe("cloverhollow-save-plaza-420.json");
    expect(saveBackupFilename("Pinecone Pass! / #2", 123.9)).toBe(
      "cloverhollow-save-pinecone-pass-2-123.json",
    );
    expect(saveBackupFilename("--old---trail--", 0)).toBe(
      "cloverhollow-save-old-trail-0.json",
    );
    expect(saveBackupFilename("   ///   ", -15)).toBe(
      "cloverhollow-save-cloverhollow-0.json",
    );
    expect(saveBackupFilename("market", Number.NaN)).toBe(
      "cloverhollow-save-market-0.json",
    );
  });

  it("round-trips save backup envelopes, accepts raw saves, and rejects malformed inputs", () => {
    const { world, fixtures } = loadContent();
    const initialFixture = fixtures["new-game"];
    if (initialFixture === undefined) throw new Error("Missing new-game fixture");
    const fresh = createState(world, initialFixture);
    const speciesXp: Readonly<Record<string, number>> = Object.fromEntries(
      Object.values(world.critters).map((kind) => [
        kind.species,
        world.levels.critters[kind.id]?.xp ?? 0,
      ]),
    );
    const thresholds: readonly number[] = world.levels.thresholds;

    let progressed: State = {
      ...fresh,
      area: "plaza",
      player: { x: 706, y: 398 },
      stickers: ["fountain-frog"],
    };
    for (let tick = 0; tick < 8; tick += 1) {
      progressed = step(world, progressed, { ...blankInput(), move: { x: 1, y: 0 } }).state;
    }

    const exportedAt = "2026-11-27T12:00:00.000Z";
    const backup = formatSaveBackup(progressed, world, exportedAt);
    const parsedEnvelope: unknown = JSON.parse(backup);
    expect(backup).toBe(`${JSON.stringify(parsedEnvelope, null, 2)}\n`);
    expect(parsedEnvelope).toEqual({
      app: "wilds-of-cloverhollow",
      format: 1,
      exportedAt,
      area: "plaza",
      areaName: "Town plaza",
      stickers: 1,
      save: serializeSave(progressed),
    });

    const restoredFromEnvelope = parseSaveBackup(backup, fresh, speciesXp, thresholds);
    expect(restoredFromEnvelope).not.toBeNull();
    if (restoredFromEnvelope !== null) {
      expect(stableHash(restoredFromEnvelope)).toBe(stableHash(progressed));
    }

    const rawSave = serializeSave(progressed);
    const restoredFromRaw = parseSaveBackup(rawSave, fresh, speciesXp, thresholds);
    expect(restoredFromRaw).not.toBeNull();
    if (restoredFromRaw !== null) {
      expect(stableHash(restoredFromRaw)).toBe(stableHash(progressed));
    }

    const rejectedInputs: readonly string[] = [
      "",
      "{not-json",
      "null",
      "42",
      "[]",
      "\"hello\"",
      JSON.stringify({ app: "other-game", format: 1, save: rawSave }),
      JSON.stringify({ app: "wilds-of-cloverhollow", format: 2, save: rawSave }),
      JSON.stringify({ app: "wilds-of-cloverhollow", format: "1", save: rawSave }),
      JSON.stringify({ app: "wilds-of-cloverhollow", format: 1, save: 123 }),
      JSON.stringify({ app: "wilds-of-cloverhollow", format: 1 }),
      JSON.stringify({ app: "wilds-of-cloverhollow", format: 1, save: "{corrupted" }),
      JSON.stringify({
        app: "wilds-of-cloverhollow",
        format: 1,
        save: JSON.stringify({ version: 99, state: {} }),
      }),
    ];
    for (const bad of rejectedInputs) {
      expect(parseSaveBackup(bad, fresh, speciesXp, thresholds)).toBeNull();
    }
  });

  it("clears market-door and parlor-door across y = 372..412 on the plaza smoke route", () => {
    const { world, fixtures } = loadContent();
    const initialFixture = fixtures["new-game"];
    if (initialFixture === undefined) throw new Error("Missing new-game fixture");
    const base = createState(world, initialFixture);

    for (const startY of [372, 375, 385, 398, 410, 412]) {
      let current: State = {
        ...base,
        area: "plaza",
        player: { x: 706, y: startY },
      };
      const walk = (
        dx: number,
        dy: number,
        done: (state: State) => boolean,
        allowedTarget?: string,
      ): void => {
        for (let tick = 0; tick < 400 && !done(current); tick += 1) {
          current = step(world, current, { ...blankInput(), move: { x: dx, y: dy } }).state;
          expect(current.battle).toBeNull();
          if (current.transition !== null) {
            expect(current.transition.target.area).toBe(allowedTarget);
          }
        }
        expect(done(current)).toBe(true);
      };

      walk(1, 0, (s) => s.player.x >= 946);
      expect(current.area).toBe("plaza");
      walk(0, 1, (s) => s.player.y >= 445);
      walk(1, 0, (s) => s.player.x >= 1280);
      walk(0, 1, (s) => s.player.y >= 880);
      walk(1, 0, (s) => s.player.x >= 1450);
      walk(0, 1, (s) => s.area === "park", "park");
      expect(current.area).toBe("park");
    }
  });
});
