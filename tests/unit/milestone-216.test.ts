import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as battleParsers from "../../src/content/battle-parsers";
import * as progressionParsers from "../../src/content/progression-parsers";
import * as battleVfxChecks from "../../src/render/battle-vfx-checks";
import * as battleVfxStage from "../../src/render/battle-vfx-stage";
import { postcardToastMessage } from "../../src/ui/postcard";

describe("Milestone 216: Album Foley, Weather Postcard Toast & Modular Splits", () => {
  it("formats postcardToastMessage identically without weather and appends active weather", () => {
    // 2-arg callers and undefined / "clear" stay byte-identical.
    expect(postcardToastMessage("downloaded", "Cloverhollow Plaza · Wilds of Cloverhollow")).toBe(
      "Postcard saved · Cloverhollow Plaza",
    );
    expect(
      postcardToastMessage("downloaded", "Cloverhollow Plaza · Wilds of Cloverhollow", undefined),
    ).toBe("Postcard saved · Cloverhollow Plaza");
    expect(
      postcardToastMessage("downloaded", "Cloverhollow Plaza · Wilds of Cloverhollow", "clear"),
    ).toBe("Postcard saved · Cloverhollow Plaza");
    expect(
      postcardToastMessage("shared", "Cloverhollow Plaza · Wilds of Cloverhollow", "clear"),
    ).toBe("Postcard shared · Cloverhollow Plaza");

    // Active cozy weather modes append their friendly display stamp for both saved and shared.
    const plazaCaption = "Cloverhollow Plaza · Wilds of Cloverhollow";
    expect(postcardToastMessage("downloaded", plazaCaption, "sunshower")).toBe(
      "Postcard saved · Cloverhollow Plaza · Rainbow Sunshower",
    );
    expect(postcardToastMessage("shared", plazaCaption, "sunshower")).toBe(
      "Postcard shared · Cloverhollow Plaza · Rainbow Sunshower",
    );
    expect(
      postcardToastMessage("downloaded", "Town plaza · Wilds of Cloverhollow", "breeze-petals"),
    ).toBe("Postcard saved · Town plaza · Petal Breeze");
    expect(
      postcardToastMessage("shared", "Town plaza · Wilds of Cloverhollow", "breeze-petals"),
    ).toBe("Postcard shared · Town plaza · Petal Breeze");
    expect(postcardToastMessage("downloaded", plazaCaption, "snow-flurry")).toBe(
      "Postcard saved · Cloverhollow Plaza · Snow Flurry",
    );
    expect(postcardToastMessage("shared", plazaCaption, "snow-flurry")).toBe(
      "Postcard shared · Cloverhollow Plaza · Snow Flurry",
    );
    expect(
      postcardToastMessage("downloaded", "Town plaza", "twilight-fireflies"),
    ).toBe("Postcard saved · Town plaza · Twilight Fireflies");
    expect(
      postcardToastMessage("shared", "Town plaza", "twilight-fireflies"),
    ).toBe("Postcard shared · Town plaza · Twilight Fireflies");
  });

  it("re-exports battle-vfx-checks and progression-parsers with purity & budgets", () => {
    // Reference-identical re-exports through src/render/battle-vfx-stage.ts.
    expect(battleVfxStage.ECHO_CHIME_COLORS).toBe(battleVfxChecks.ECHO_CHIME_COLORS);
    expect(battleVfxStage.echoNoteColor).toBe(battleVfxChecks.echoNoteColor);
    expect(battleVfxStage.LEAN_WIND_TINTS).toBe(battleVfxChecks.LEAN_WIND_TINTS);
    expect(battleVfxStage.PEEKABOO_WARNING_TINT).toBe(battleVfxChecks.PEEKABOO_WARNING_TINT);
    expect(battleVfxStage.PEEKABOO_WATCH_TINTS).toBe(battleVfxChecks.PEEKABOO_WATCH_TINTS);
    expect(battleVfxStage.PEEKABOO_DUST_TINT).toBe(battleVfxChecks.PEEKABOO_DUST_TINT);
    expect(battleVfxStage.TRACE_BRUSH_COLORS).toBe(battleVfxChecks.TRACE_BRUSH_COLORS);
    expect(battleVfxStage.emitEchoChimeVfx).toBe(battleVfxChecks.emitEchoChimeVfx);
    expect(battleVfxStage.emitLeanWindVfx).toBe(battleVfxChecks.emitLeanWindVfx);
    expect(battleVfxStage.emitPeekabooVfx).toBe(battleVfxChecks.emitPeekabooVfx);
    expect(battleVfxStage.emitTraceBrushVfx).toBe(battleVfxChecks.emitTraceBrushVfx);

    // Reference-identical re-exports through src/content/battle-parsers.ts.
    expect(battleParsers.parsePartyMember).toBe(progressionParsers.parsePartyMember);
    expect(battleParsers.partyJoinErrors).toBe(progressionParsers.partyJoinErrors);
    expect(battleParsers.partyErrors).toBe(progressionParsers.partyErrors);
    expect(battleParsers.parseStickers).toBe(progressionParsers.parseStickers);
    expect(battleParsers.parseLevels).toBe(progressionParsers.parseLevels);
    expect(battleParsers.parseTreats).toBe(progressionParsers.parseTreats);
    expect(battleParsers.parseEncoreContent).toBe(progressionParsers.parseEncoreContent);
    expect(battleParsers.parseTreatBaskets).toBe(progressionParsers.parseTreatBaskets);

    // Pixi-free and DOM-free purity for src/render/battle-vfx-checks.ts.
    const checksSrc = readFileSync("src/render/battle-vfx-checks.ts", "utf8");
    expect(checksSrc).not.toMatch(/from\s+["']pixi\.js["']/);
    expect(checksSrc).not.toMatch(/\b(document|window|HTMLElement)\b/);

    // Strict modular line budgets.
    const lineCount = (path: string): number =>
      readFileSync(path, "utf8").trimEnd().split("\n").length;

    expect(lineCount("src/render/battle-vfx-stage.ts")).toBeLessThan(460);
    expect(lineCount("src/render/battle-vfx-checks.ts")).toBeLessThan(440);
    expect(lineCount("src/content/battle-parsers.ts")).toBeLessThan(520);
    expect(lineCount("src/content/progression-parsers.ts")).toBeLessThan(400);
    expect(lineCount("src/ui/journal-field-note.ts")).toBeLessThan(650);
  });
});
