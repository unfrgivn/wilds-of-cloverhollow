import type { Area } from "../core";
import { isArcadeGameId } from "../core/arcade";
import { runInk, storyHasKnot, type InkFacts } from "../core/ink";
import { isStorySound } from "../core/sound";
import { field, record } from "./parsers";

/** Canonical dialogue portrait expressions paired with Track E3 (`# expr:`). */
export const STORY_EXPRESSIONS = [
  "neutral",
  "happy",
  "worried",
  "determined",
  "surprised",
] as const;

/** Canonical sprite action poses paired with Track E2 (`# pose:`). */
export const STORY_POSES = [
  "idle",
  "sit",
  "cheer",
  "shock",
  "tool_lantern",
  "tool_lasso",
  "tool_flute",
  "talk",
  "dash_lean",
] as const;

const EXPRESSION_SET: ReadonlySet<string> = new Set<string>(STORY_EXPRESSIONS);
const POSE_SET: ReadonlySet<string> = new Set<string>(STORY_POSES);
const POSE_TARGET_SET: ReadonlySet<string> = new Set([
  "fae",
  "maddie",
  "sue",
  "jordan",
  "party",
]);

export function parseStoryJson(value: unknown, file: string): Record<string, unknown> {
  field(record(value), file, "story");
  field(typeof value.inkVersion === "number", file, "story.inkVersion");
  field(Array.isArray(value.root), file, "story.root");
  return value;
}

// Every tag in a compiled story. Ink's JSON starts a tag with a "#" command
// and its text ("^..."); the closing "/#" can sit in an enclosing container
// (an inline conditional's tag closes after its branch), so a tag is the text
// right after its "#".
export function storyTags(story: Record<string, unknown>): string[] {
  const tags: string[] = [];
  const visit = (item: unknown): void => {
    if (!Array.isArray(item)) {
      if (record(item)) Object.values(item).forEach(visit);
      return;
    }
    item.forEach((child, index) => {
      if (child !== "#") {
        visit(child);
        return;
      }
      let text = "";
      for (const next of item.slice(index + 1)) {
        if (typeof next !== "string" || !next.startsWith("^")) break;
        text += next.slice(1);
      }
      tags.push(text.trim());
    });
  };
  visit(story.root);
  return tags;
}

// Every tag the story uses, checked (spec 7). `travel: <area>.<spawn>` must
// name a spawn that exists, `buy:` sells only `snack <price>`, and `prices`
// are the ticket counter's so a `trade` tag names one of its prizes at price.
export function storyTagErrors(
  tags: string[],
  areas: Record<string, Area>,
  prices: Record<string, number> = {},
  treatPrices: Record<string, number> = {},
): string[] {
  return tags.flatMap((tag) => {
    if (tag.startsWith("grade:"))
      return /^(great|good|miss)$/.test(tag.slice("grade:".length).trim())
        ? [] : [`invalid grade tag "${tag}"`];
    if (tag.startsWith("travel:")) {
      const [areaId, spawnId, ...extra] = tag.slice("travel:".length).trim().split(".");
      const area = areaId === undefined ? undefined : areas[areaId];
      const known = area !== undefined && spawnId !== undefined && extra.length === 0 &&
        area.spawns[spawnId] !== undefined;
      return known ? [] : [`unknown travel target in "${tag}"`];
    }
    if (tag.startsWith("buy:"))
      return /^buy:\s*snack\s+\d+$/.test(tag) ? [] : [`invalid buy tag "${tag}"`];
    if (tag.startsWith("buy-treat:")) {
      const match = /^buy-treat:\s*([a-z][a-z0-9-]*)\s+(\d+)$/.exec(tag);
      const price = match === null ? undefined : treatPrices[match[1] ?? ""];
      return price !== undefined && price === Number(match?.[2])
        ? [] : [`invalid buy-treat tag "${tag}" (not a treat at its price)`];
    }
    if (tag.startsWith("gift:")) {
      if (/^gift:\s*(snack|coins)\s+[1-9]\d*$/.test(tag)) return [];
      const match = /^gift:\s*treat\s+([a-z][a-z0-9-]*)\s+([1-9]\d*)$/.exec(tag);
      const known = match !== null && treatPrices[match[1] ?? ""] !== undefined;
      return known ? [] : [`invalid gift tag "${tag}"`];
    }
    if (tag.startsWith("feed:"))
      return /^feed:\s*snack\s+[1-9]\d*$/.test(tag) ? [] : [`invalid feed tag "${tag}"`];
    if (tag.startsWith("play:")) {
      const match = /^play:\s*([a-z][a-z0-9-]*)\s+\d+$/.exec(tag);
      return match !== null && isArcadeGameId(match[1] ?? "")
        ? [] : [`invalid play tag "${tag}"`];
    }
    if (tag.startsWith("trade:")) {
      const match = /^trade:\s*([a-z][a-z0-9-]*)\s+(\d+)$/.exec(tag);
      const price = match === null ? undefined : prices[match[1] ?? ""];
      return price !== undefined && price === Number(match?.[2])
        ? [] : [`invalid trade tag "${tag}" (not a counter prize at its price)`];
    }
    if (tag === "ending" || tag === "credits") return [];
    if (tag.startsWith("ending") || tag.startsWith("credits"))
      return [`invalid finale tag "${tag}"`];
    if (tag.startsWith("sound:")) {
      const sound = tag.slice("sound:".length).trim();
      return isStorySound(sound) ? [] : [`unknown sound in "${tag}"`];
    }
    if (tag.startsWith("expr:")) {
      const expr = tag.slice("expr:".length).trim();
      return EXPRESSION_SET.has(expr) ? [] : [`unknown expression in "${tag}"`];
    }
    if (tag.startsWith("pose:")) {
      const tokens = tag.slice("pose:".length).trim().toLowerCase().split(/\s+/);
      const valid =
        (tokens.length === 1 && POSE_SET.has(tokens[0] ?? "")) ||
        (tokens.length === 2 &&
          POSE_TARGET_SET.has(tokens[0] ?? "") &&
          POSE_SET.has(tokens[1] ?? ""));
      return valid ? [] : [`unknown pose in "${tag}"`];
    }
    return [];
  });
}

const MILO_NAME_RE = /\bMilo\b/i;

/**
 * Verifies spec §1.2 Milo secrecy across every branch of `knots` when executed
 * from a pre-reveal Ink state (`milo_revealed = false`). Any line or choice
 * mentioning "Milo" is reported as an error.
 */
export function miloSecrecyErrors(
  story: Record<string, unknown>,
  ink: string,
  knots: readonly string[],
  facts?: InkFacts,
): string[] {
  const errors: string[] = [];
  const walk = (knot: string, currentInk: string, depth: number): void => {
    let result = runInk(story, currentInk, { type: "start", knot }, facts);
    const stepLine = (stepResult: ReturnType<typeof runInk>, path: string, step: number): void => {
      if (step > 80) return;
      if (stepResult.line !== null && MILO_NAME_RE.test(stepResult.line.text)) {
        errors.push(`${path}: leaked Milo name in "${stepResult.line.text}"`);
      }
      for (const choice of stepResult.choices) {
        if (MILO_NAME_RE.test(choice)) {
          errors.push(`${path}: leaked Milo name in choice "${choice}"`);
        }
      }
      if (stepResult.ended) return;
      if (stepResult.choices.length > 0) {
        if (depth >= 4) return;
        stepResult.choices.forEach((_, index) => {
          const picked = runInk(story, stepResult.ink, { type: "choose", index }, facts);
          stepLine(picked, `${path}[${index}]`, step + 1);
        });
        return;
      }
      const next = runInk(story, stepResult.ink, { type: "next" }, facts);
      stepLine(next, path, step + 1);
    };
    stepLine(result, knot, 0);
  };
  for (const knot of knots) {
    if (!storyHasKnot(story, knot)) {
      errors.push(`${knot}: missing knot`);
      continue;
    }
    walk(knot, ink, 0);
  }
  return errors;
}

export function endingContentErrors(
  story: Record<string, unknown>,
  areas: Record<string, Area>,
): string[] {
  if (!storyTags(story).includes("ending")) return [];
  const bedroom = areas.bedroom;
  return [
    ...(bedroom === undefined ? ["ending requires area bedroom"] : []),
    ...(bedroom?.spawns.bed === undefined ? ["ending requires bedroom spawn bed"] : []),
    ...(storyHasKnot(story, "morning_start") ? [] : ["ending requires morning_start knot"]),
    ...(storyHasKnot(story, "mom") ? [] : ["ending requires mom knot"]),
  ];
}
