import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { createState, inkFacts, runInk } from "../../src/core";
import {
  applyExpressionProsody,
  blipFrequency,
  dialogueProsody,
  expressionVoiceModifier,
  NEUTRAL_PROSODY,
  type VoiceExpression,
} from "../../src/platform/voices";
import { buildSoundContext } from "../../src/shell/feedback";
import {
  buildDialogueView,
  extractInkCurrentTags,
  extractInkExpression,
  resolveDialogueSpeakerSide,
} from "../../src/shell/view-models";
import { parseAtlasJson } from "../../src/ui/atlas";
import {
  cropPortraitFrame,
  EXPRESSION_CAST_IDS,
  expressionPortraitSource,
  isPortraitExpression,
  parseExpressionTag,
  PORTRAIT_EXPRESSIONS,
  PORTRAITS_ATLAS,
  resolveExpressionTag,
  speakerPortraitSource,
  type PortraitExpression,
} from "../../src/ui/portraits";
import {
  MAX_PAUSE_BEATS,
  parseRichText,
  resolveRichTextProgress,
  stripRichText,
} from "../../src/ui/rich-text";

const content = loadContent();
const world = content.world;
const newGameFixture = content.fixtures["new-game"];
if (newGameFixture === undefined) throw new Error("Missing new-game fixture");

describe("E3: Art Wave A2 Multi-Expression Portrait Atlas & Fallback", () => {
  it("ships all 10 core cast x 5 expressions in an optimized <=2048px WebP atlas", () => {
    const jsonDisk = join(process.cwd(), "public", PORTRAITS_ATLAS);
    expect(existsSync(jsonDisk)).toBe(true);
    const atlas = parseAtlasJson(JSON.parse(readFileSync(jsonDisk, "utf8")), PORTRAITS_ATLAS);
    expect(atlas.meta.image).toBe("portraits.webp");
    expect(existsSync(join(process.cwd(), "public/assets/portraits/portraits.webp"))).toBe(true);
    expect(atlas.meta.size?.w).toBeLessThanOrEqual(2048);
    expect(atlas.meta.size?.h).toBeLessThanOrEqual(2048);

    for (const castId of EXPRESSION_CAST_IDS) {
      for (const expr of PORTRAIT_EXPRESSIONS) {
        const key = `${castId}_${expr}`;
        const frame = atlas.frames[key]?.frame;
        expect(frame, `missing frame ${key}`).toBeDefined();
        if (frame === undefined) continue;
        expect(frame.w).toBe(200);
        expect(frame.h).toBe(200);
        expect(frame.x + frame.w).toBeLessThanOrEqual(atlas.meta.size?.w ?? 0);
        expect(frame.y + frame.h).toBeLessThanOrEqual(atlas.meta.size?.h ?? 0);
        const cropped = cropPortraitFrame(frame, "bust");
        expect(cropped.w).toBe(cropped.h);
        expect(cropped.w).toBeGreaterThanOrEqual(170);
        expect(cropped.x).toBeGreaterThanOrEqual(frame.x);
        expect(cropped.y).toBeGreaterThanOrEqual(frame.y);
        expect(cropped.x + cropped.w).toBeLessThanOrEqual(frame.x + frame.w);
        expect(cropped.y + cropped.h).toBeLessThanOrEqual(frame.y + frame.h);
      }
    }

    const recipePath = join(process.cwd(), "art/recipes/portraits-expressions.json");
    expect(existsSync(recipePath)).toBe(true);
    const recipe: unknown = JSON.parse(readFileSync(recipePath, "utf8"));
    expect(typeof recipe).toBe("object");
    expect(existsSync(join(process.cwd(), "art/review/e3-portraits-cast-a.jpg"))).toBe(true);
    expect(existsSync(join(process.cwd(), "art/review/e3-portraits-cast-b.jpg"))).toBe(true);
    expect(existsSync(join(process.cwd(), "art/review/e3-portraits-medallions.jpg"))).toBe(true);
  });

  it("parses # expr: tags cleanly and extracts tags from serialized Ink state", () => {
    for (const expr of PORTRAIT_EXPRESSIONS) {
      expect(isPortraitExpression(expr)).toBe(true);
      expect(parseExpressionTag([`expr: ${expr}`])).toBe(expr);
      expect(parseExpressionTag([`  EXPR:${expr.toUpperCase()}  `])).toBe(expr);
    }
    expect(isPortraitExpression("sleepy")).toBe(false);
    expect(parseExpressionTag(["speaker: Fae"])).toBeNull();
    expect(parseExpressionTag(["expr: unknown"])).toBeNull();
    expect(parseExpressionTag(["expr: happy", "expr: surprised"])).toBe("surprised");
    expect(resolveExpressionTag([])).toBe("neutral");
    expect(resolveExpressionTag(["expr: invalid"], "worried")).toBe("worried");

    const base = createState(world, newGameFixture);
    const opened = runInk(
      world.story,
      base.ink,
      { type: "start", knot: "window" },
      inkFacts(world, base),
    );
    expect(extractInkCurrentTags(opened.ink)).toContain("speaker: Fae");
    expect(extractInkExpression(opened.ink)).toBe("neutral");

    const syntheticInk = JSON.stringify({
      currentFlowName: "DEFAULT_FLOW",
      flows: {
        DEFAULT_FLOW: {
          outputStream: [
            "^Look at that! ",
            "#",
            "^speaker: Sue",
            "/#",
            "#",
            "^expr: determined",
            "/#",
            "\n",
          ],
        },
      },
    });
    expect(extractInkCurrentTags(syntheticInk)).toEqual(["speaker: Sue", "expr: determined"]);
    expect(extractInkExpression(syntheticInk)).toBe("determined");
    expect(extractInkCurrentTags("{malformed")).toEqual([]);
    expect(extractInkExpression(undefined)).toBe("neutral");
  });

  it("resolves core cast bust portraits and falls back to sprite crops for other NPCs", () => {
    const coreSpeakers: readonly [string, string][] = [
      ["Fae", "fae"],
      ["Maddie", "maddie"],
      ["Sue", "sue"],
      ["Jordan", "jordan"],
      ["Milo", "milo"],
      ["Mom", "mom"],
      ["Dad", "dad"],
      ["Grandpa Barnaby", "barnaby"],
      ["Ms. Maple", "teacher"],
      ["Nurse Holly", "nurse"],
      ["Nurse Clover", "nurse"],
    ];
    for (const [speaker, castId] of coreSpeakers) {
      for (const expr of PORTRAIT_EXPRESSIONS) {
        expect(expressionPortraitSource(speaker, expr)).toEqual({
          atlas: PORTRAITS_ATLAS,
          frame: `${castId}_${expr}`,
          cropMode: "bust",
        });
        expect(speakerPortraitSource(world, speaker, expr)).toEqual({
          atlas: PORTRAITS_ATLAS,
          frame: `${castId}_${expr}`,
          cropMode: "bust",
        });
      }
    }

    // NPCs and critters without an expression sheet gracefully fall back to existing sprite crops.
    const fallbackSpeakers = [
      "Rosie",
      "Chef Bea",
      "Ranger Fern",
      "Fountain Frog",
      "Lavender Fairy",
    ];
    for (const speaker of fallbackSpeakers) {
      expect(expressionPortraitSource(speaker, "happy")).toBeNull();
      const baseCrop = speakerPortraitSource(world, speaker);
      expect(baseCrop).not.toBeNull();
      expect(speakerPortraitSource(world, speaker, "happy")).toEqual(baseCrop);
      expect(speakerPortraitSource(world, speaker, "worried")).toEqual(baseCrop);
    }

    expect(speakerPortraitSource(world, "Sign", "happy")).toBeNull();
    expect(speakerPortraitSource(world, null, "happy")).toBeNull();
  });

  it("projects speakerSide and expression cleanly in buildDialogueView", () => {
    const state = createState(world, newGameFixture);
    const leftTalkState = {
      ...state,
      player: { x: 400, y: 400 },
      dialogue: {
        knot: "mom",
        speaker: "Mom",
        text: "Breakfast is ready!",
        revealed: 10,
        choices: [],
        selected: 0,
        ended: false,
        partnerPoint: { x: 520, y: 400 },
      },
    };
    const seenCalls: { speaker: string | null; expression?: PortraitExpression }[] = [];
    const view = buildDialogueView({
      world,
      state: leftTalkState,
      battle: null,
      arcadeState: null,
      levelUpNotice: null,
      tags: ["expr: happy"],
      speakerPortrait: (speaker, expression) => {
        seenCalls.push({ speaker, expression });
        return null;
      },
    });
    expect(view?.expression).toBe("happy");
    expect(view?.speakerSide).toBe("right");
    expect(seenCalls).toEqual([{ speaker: "Mom", expression: "happy" }]);

    // When Fae responds while standing left of Mom, tail points left.
    expect(resolveDialogueSpeakerSide(world, leftTalkState, "Fae", false)).toBe("left");
    // In battle Talk, party speaks from left and foe from right.
    expect(resolveDialogueSpeakerSide(world, leftTalkState, "Fae", true)).toBe("left");
    expect(resolveDialogueSpeakerSide(world, leftTalkState, "Hooded Kid", true)).toBe("right");
    // Signs and narration emit no speech tail.
    expect(resolveDialogueSpeakerSide(world, leftTalkState, "Sign", false)).toBeNull();
    expect(resolveDialogueSpeakerSide(world, leftTalkState, null, false)).toBeNull();
  });
});

describe("E3: Pure XSS-Safe Kinetic Rich-Text Tokenizer", () => {
  it("keeps plain lines on the fast path with zero markup overhead", () => {
    const parsed = parseRichText("Morning sun over Cloverhollow.");
    expect(parsed.hasMarkup).toBe(false);
    expect(parsed.plain).toBe("Morning sun over Cloverhollow.");
    expect(parsed.pauses).toEqual([]);
    expect(parsed.totalBeats).toBe(parsed.plain.length);
    expect(resolveRichTextProgress(parsed, 7)).toEqual({
      visibleChars: 7,
      inPause: false,
      complete: false,
    });
    expect(resolveRichTextProgress(parsed, parsed.raw.length)).toEqual({
      visibleChars: parsed.plain.length,
      inPause: false,
      complete: true,
    });
  });

  it("tokenizes all kinetic effects, nested colors, and leaves unknown/HTML text literal", () => {
    const line =
      "{color:berry}{shake}Whoa!{/shake} {/color}{wave}Sparkles{/wave} " +
      "{pop}everywhere{/pop} {whisper}shh...{/whisper} " +
      "{color:teal}bay{/color} {color:gold}star{/color} {color:lavender}mist{/color}";
    const parsed = parseRichText(line);
    expect(parsed.hasMarkup).toBe(true);
    expect(parsed.plain).toBe("Whoa! Sparkles everywhere shh... bay star mist");
    expect(stripRichText(line)).toBe(parsed.plain);

    const whoa = parsed.spans.find((s) => s.text === "Whoa!");
    expect(whoa?.style).toEqual({
      shake: true,
      wave: false,
      pop: false,
      whisper: false,
      color: "berry",
    });
    const waveSpan = parsed.spans.find((s) => s.text === "Sparkles");
    expect(waveSpan?.style.wave).toBe(true);
    const popSpan = parsed.spans.find((s) => s.text === "everywhere");
    expect(popSpan?.style.pop).toBe(true);
    const whisperSpan = parsed.spans.find((s) => s.text === "shh...");
    expect(whisperSpan?.style.whisper).toBe(true);
    expect(parsed.spans.find((s) => s.text === "bay")?.style.color).toBe("teal");
    expect(parsed.spans.find((s) => s.text === "star")?.style.color).toBe("gold");
    expect(parsed.spans.find((s) => s.text === "mist")?.style.color).toBe("lavender");

    // Nested colors restore outer color cleanly on close.
    const nested = parseRichText("{color:teal}sea {color:gold}gold{/color} breeze{/color}");
    expect(nested.spans.map((s) => [s.text, s.style.color])).toEqual([
      ["sea ", "teal"],
      ["gold", "gold"],
      [" breeze", "teal"],
    ]);

    // Unknown tags and HTML payloads stay strictly literal text, never interpreted.
    const xss = parseRichText("<script>alert(1)</script> {unknown} {color:neon}ok");
    expect(xss.hasMarkup).toBe(false);
    expect(xss.plain).toBe("<script>alert(1)</script> {unknown} {color:neon}ok");

    // Source files strictly ban innerHTML / insertAdjacentHTML.
    const richTextSource = readFileSync("src/ui/rich-text.ts", "utf8");
    const stickerSource = readFileSync("src/ui/sticker.ts", "utf8");
    expect(richTextSource).not.toMatch(/\.innerHTML\b|insertAdjacentHTML/);
    expect(stickerSource).not.toMatch(/\.innerHTML\b|insertAdjacentHTML/);
  });

  it("holds reveal during {pause:N} beats and completes immediately on full reveal", () => {
    const parsed = parseRichText("Wait...{pause:12} Look!");
    expect(parsed.plain).toBe("Wait... Look!");
    expect(parsed.pauses).toEqual([{ plainIndex: 7, beats: 12 }]);
    expect(parsed.totalBeats).toBe(13 + 12);

    const before = resolveRichTextProgress(parsed, 4);
    expect(before.visibleChars).toBeLessThan(7);
    expect(before.inPause).toBe(false);

    const midPauseA = resolveRichTextProgress(parsed, 8);
    const midPauseB = resolveRichTextProgress(parsed, 14);
    expect(midPauseA).toEqual({ visibleChars: 7, inPause: true, complete: false });
    expect(midPauseB).toEqual({ visibleChars: 7, inPause: true, complete: false });

    const afterPause = resolveRichTextProgress(parsed, 20);
    expect(afterPause.visibleChars).toBeGreaterThan(7);
    expect(afterPause.visibleChars).toBeLessThan(parsed.plain.length);
    expect(afterPause.inPause).toBe(false);

    const done = resolveRichTextProgress(parsed, parsed.raw.length);
    expect(done).toEqual({ visibleChars: parsed.plain.length, inPause: false, complete: true });

    // Extreme pause counts are bounded safely.
    const huge = parseRichText("Hi{pause:9999}!");
    expect(huge.pauses[0]?.beats).toBe(MAX_PAUSE_BEATS);
  });

  it("wires stripped rich text, pause silence, and expression into buildSoundContext", () => {
    const base = createState(world, newGameFixture);
    const inkWithExpr = JSON.stringify({
      currentFlowName: "DEFAULT_FLOW",
      flows: {
        DEFAULT_FLOW: {
          outputStream: ["^Wait... ", "#", "^expr: surprised", "/#", "\n"],
        },
      },
    });
    const ctx = buildSoundContext({
      ink: inkWithExpr,
      battle: null,
      dialogue: {
        knot: "window",
        speaker: "Fae",
        text: "Wait...{pause:12} Look!",
        revealed: 10,
        choices: [],
        selected: 0,
        ended: false,
      },
    });
    expect(ctx.speaker).toBe("Fae");
    expect(ctx.text).toBe("Wait... Look!");
    expect(ctx.revealed).toBe(7);
    expect(ctx.expression).toBe("surprised");
    expect(ctx.inPause).toBe(true);
    expect(base.dialogue).toBeNull();
  });
});

describe("E3: Mood-Tuned Expressive Voices", () => {
  it("keeps neutral/omitted expression bit-identical and modulates all 4 expressive moods", () => {
    const neutralRef = applyExpressionProsody(NEUTRAL_PROSODY, "neutral");
    expect(neutralRef).toBe(NEUTRAL_PROSODY);
    expect(applyExpressionProsody(NEUTRAL_PROSODY, undefined)).toBe(NEUTRAL_PROSODY);

    const baseEven = blipFrequency("Fae", 4, "a");
    const baseOdd = blipFrequency("Fae", 5, "a");
    expect(baseEven).not.toBeNull();
    expect(baseOdd).not.toBeNull();
    if (baseEven === null || baseOdd === null) return;

    expect(blipFrequency("Fae", 4, "a", NEUTRAL_PROSODY, "neutral")).toEqual(baseEven);

    // Happy: brighter pitch, upbeat odd-step lift, buoyant upward glide, snappier duration.
    const happyEven = blipFrequency("Fae", 4, "a", NEUTRAL_PROSODY, "happy");
    const happyOdd = blipFrequency("Fae", 5, "a", NEUTRAL_PROSODY, "happy");
    expect(happyEven?.frequency).toBeGreaterThan(baseEven.frequency);
    expect((happyOdd?.frequency ?? 0) / baseOdd.frequency).toBeGreaterThan(
      (happyEven?.frequency ?? 0) / baseEven.frequency,
    );
    expect(happyEven?.gain).toBeGreaterThan(baseEven.gain);
    expect(happyEven?.endFrequency).toBeGreaterThan(happyEven?.frequency ?? 0);
    expect(happyEven?.duration).toBeLessThan(baseEven.duration);

    // Worried: softer gain, lower pitch, descending inflection, gentler longer duration.
    const worried = blipFrequency("Fae", 4, "a", NEUTRAL_PROSODY, "worried");
    expect(worried?.frequency).toBeLessThan(baseEven.frequency);
    expect(worried?.gain).toBeLessThan(baseEven.gain);
    expect(worried?.endFrequency).toBeLessThan(worried?.frequency ?? 0);
    expect(worried?.duration).toBeGreaterThan(baseEven.duration);

    // Surprised: crisp upward chirp (highest pitch & glide, quickest duration).
    const surprised = blipFrequency("Fae", 4, "a", NEUTRAL_PROSODY, "surprised");
    expect(surprised?.frequency).toBeGreaterThan(happyEven?.frequency ?? 0);
    expect(surprised?.endFrequency).toBeGreaterThan(surprised?.frequency ?? 0);
    expect(surprised?.duration).toBeLessThan(happyEven?.duration ?? 1);

    // Determined: steady warm cadence (grounded pitch, confident gain, dampened glide on Maddie).
    const determinedFae = blipFrequency("Fae", 4, "a", NEUTRAL_PROSODY, "determined");
    expect(determinedFae?.frequency).toBeLessThan(baseEven.frequency);
    expect(determinedFae?.gain).toBeGreaterThan(baseEven.gain);
    expect(determinedFae?.duration).toBeGreaterThan(baseEven.duration);

    const maddieBase = blipFrequency("Maddie", 4, "a");
    const maddieDet = blipFrequency("Maddie", 4, "a", NEUTRAL_PROSODY, "determined");
    expect(maddieBase?.endFrequency).toBeDefined();
    expect(maddieDet?.endFrequency).toBeDefined();
    const baseGlideRatio = (maddieBase?.endFrequency ?? 0) / (maddieBase?.frequency ?? 1);
    const detGlideRatio = (maddieDet?.endFrequency ?? 0) / (maddieDet?.frequency ?? 1);
    expect(detGlideRatio).toBeLessThan(baseGlideRatio);

    // Clamping holds even when layered on top of exclamations and whispers.
    const moods: readonly VoiceExpression[] = [
      "neutral",
      "happy",
      "worried",
      "determined",
      "surprised",
    ];
    for (const mood of moods) {
      expect(expressionVoiceModifier(mood).pitchScale).toBeGreaterThan(0.8);
      const layered = applyExpressionProsody(dialogueProsody("WHOA REALLY!", 6), mood);
      expect(layered.pitchScale).toBeLessThanOrEqual(1.28);
      expect(layered.pitchScale).toBeGreaterThanOrEqual(0.82);
      expect(layered.gainScale).toBeLessThanOrEqual(1.25);
      expect(layered.gainScale).toBeGreaterThanOrEqual(0.62);
    }
  });
});
