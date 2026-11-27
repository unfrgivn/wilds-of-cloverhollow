import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { areaConnectionErrors } from "../../src/content/area-checks";
import { loadContent, parseCharacters, parsePartyMember } from "../../src/content/load";
import {
  blankInput,
  createState,
  levelUpLine,
  soundCues,
  step,
  type Area,
  type State,
} from "../../src/core";
import { dialogueFacing } from "../../src/render/animation";
import { atlasImagePath, parseAtlasJson } from "../../src/ui/atlas";
import { decodeRgbaImage, type RgbaImage } from "./decode-image";

const content = loadContent();
const { world } = content;

function frameCentroids(
  image: RgbaImage,
  rect: { x: number; y: number; w: number; h: number },
): { opaque: { x: number; y: number }; weighted: { x: number; y: number } } {
  let sx = 0;
  let sy = 0;
  let count = 0;
  let wsx = 0;
  let wsy = 0;
  let wsum = 0;
  for (let y = 0; y < rect.h; y += 1) {
    for (let x = 0; x < rect.w; x += 1) {
      const alpha = image.rgba[((rect.y + y) * image.width + (rect.x + x)) * 4 + 3] ?? 0;
      if (alpha > 16) {
        sx += x;
        sy += y;
        count += 1;
      }
      if (alpha > 0) {
        wsx += x * alpha;
        wsy += y * alpha;
        wsum += alpha;
      }
    }
  }
  if (count === 0 || wsum === 0) throw new Error("empty frame");
  return {
    opaque: { x: sx / count, y: sy / count },
    weighted: { x: wsx / wsum, y: wsy / wsum },
  };
}

describe("Milestone 70 polish checks", () => {
  it("keeps every critter's auraCentre within 6 px of its chaos_aura_01 centroid", () => {
    const cache = new Map<string, RgbaImage>();
    for (const critter of Object.values(world.critters)) {
      const atlasPath = `public/${critter.atlas}`;
      const sheet = parseAtlasJson(JSON.parse(readFileSync(atlasPath, "utf8")), atlasPath);
      const imagePath = atlasImagePath(atlasPath, sheet);
      let image = cache.get(imagePath);
      if (image === undefined) {
        image = decodeRgbaImage(imagePath);
        cache.set(imagePath, image);
      }
      const rect = sheet.frames.chaos_aura_01?.frame;
      if (rect === undefined) throw new Error(`${atlasPath}: missing chaos_aura_01`);
      const { opaque, weighted } = frameCentroids(image, rect);
      const distance = Math.min(
        Math.hypot(opaque.x - critter.auraCentre.x, opaque.y - critter.auraCentre.y),
        Math.hypot(weighted.x - critter.auraCentre.x, weighted.y - critter.auraCentre.y),
      );
      expect(
        distance,
        `${critter.id}: auraCentre (${critter.auraCentre.x},${critter.auraCentre.y}) vs ` +
          `opaque (${opaque.x.toFixed(1)},${opaque.y.toFixed(1)}) / ` +
          `weighted (${weighted.x.toFixed(1)},${weighted.y.toFixed(1)})`,
      ).toBeLessThanOrEqual(6);
    }
  });

  it("ensures every area's NPCs are reachable and rejects an out-of-reach NPC", () => {
    expect(areaConnectionErrors(
      world.areas, world.tunables, world.critters, world.party,
    )).toEqual([]);
    const enchanted = world.areas.enchanted;
    if (enchanted === undefined) throw new Error("enchanted area missing");
    const broken: Area = {
      ...enchanted,
      npcs: [
        ...enchanted.npcs,
        {
          id: "ghost-npc",
          point: { x: 1600, y: 100 },
          facing: "down",
          footprint: [[1590, 90], [1610, 90], [1610, 110], [1590, 110]],
          knot: "fairy_peach",
          prompt: "Talk",
        },
      ],
    };
    const errors = areaConnectionErrors(
      { enchanted: broken }, world.tunables, world.critters, world.party,
    );
    expect(errors).toContain("enchanted: npc ghost-npc is unreachable");
  }, 30_000);

  it("turns Fae toward the active NPC or calm critter in dialogueFacing", () => {
    const enchantedFixture = content.fixtures["new-game"];
    if (enchantedFixture === undefined) throw new Error("new-game fixture missing");
    const base = createState(world, { ...enchantedFixture, area: "enchanted", spawn: "mist" });
    expect(dialogueFacing(world, base)).toBeNull();
    const talkingToNpc: State = {
      ...base,
      player: { x: 800, y: 620 },
      facing: "down",
      dialogue: {
        knot: "fairy_lavender", speaker: "Fairy", text: "Hi!", revealed: 3,
        choices: [], selected: 0, ended: false,
      },
    };
    expect(dialogueFacing(world, talkingToNpc)).toBe("right");

    const plazaFixture = content.fixtures.plaza;
    if (plazaFixture === undefined) throw new Error("plaza fixture missing");
    const plaza = createState(world, plazaFixture);
    const calmFrog: State = {
      ...plaza,
      critters: { ...plaza.critters, "fountain-frog": "calm" },
      player: { x: 1015, y: 880 },
      facing: "left",
      dialogue: {
        knot: "frog_calm", speaker: "Fountain Frog", text: "Ribbit!", revealed: 7,
        choices: [], selected: 0, ended: false,
      },
    };
    expect(dialogueFacing(world, calmFrog)).toBe("up");
  });

  it("omits zero stat deltas in levelUpLine and emits stride footsteps and cook cues", () => {
    expect(levelUpLine("Fae", 1, 2, { power: 2, magic: 0, life: 0, guard: 0 })).toBe(
      "Fae reached level 2! Power +2.",
    );
    expect(levelUpLine("Sue", 1, 2, { power: 0, magic: 1, life: 1, guard: 1 }, true)).toBe(
      "Sue reached level 2! Magic +1.",
    );

    const harness = content.fixtures.harness;
    if (harness === undefined) throw new Error("harness fixture missing");
    let state = createState(world, harness);
    const stepTicks: number[] = [];
    for (let tick = 1; tick <= 40; tick += 1) {
      const next = step(world, state, { ...blankInput(), move: { x: 1, y: 0 } }).state;
      if (soundCues(state, next, world).includes("footstep-grass")) stepTicks.push(tick);
      state = next;
    }
    expect(stepTicks).toEqual([16, 32]);

    const ready: State = {
      ...createState(world, harness),
      arcade: {
        game: "cook", dish: "mac", phase: "ready", phaseTicks: 0,
        cooked: 0, message: "", revealed: 0,
      },
    };
    const cooking = step(world, ready, { ...blankInput(), confirm: true }).state;
    expect(soundCues(ready, cooking, world)).toContain("cook-start");
    const paused = step(world, cooking, blankInput()).state;
    expect(soundCues(cooking, paused, world)).toContain("cook-frozen");
    let heated = step(world, paused, { ...blankInput(), confirm: true }).state;
    const frozenTicks = world.arcade.cook.dishes.mac.frozen * world.arcade.cook.ticksPerSecond;
    while (heated.arcade?.game === "cook" && heated.arcade.cooked < frozenTicks)
      heated = step(world, heated, { ...blankInput(), confirm: true }).state;
    const ding = step(world, heated, blankInput()).state;
    expect(soundCues(heated, ding, world)).toContain("cook-ding");
  });

  it("validates optional positive scale on PartyContent and CharacterContent", () => {
    expect(world.party.sue?.scale).toBe(0.46);
    expect(world.party.jordan?.scale).toBe(0.46);
    expect(world.characters.rosie?.scale).toBe(0.47);
    const rawParty = JSON.parse(readFileSync("content/party/sue.json", "utf8"));
    expect(parsePartyMember({ ...rawParty, scale: 0.45 }, "test").scale).toBe(0.45);
    expect(() => parsePartyMember({ ...rawParty, scale: 0 }, "test")).toThrow(/scale/);
    expect(() => parsePartyMember({ ...rawParty, scale: -0.5 }, "test")).toThrow(/scale/);
    expect(() => parsePartyMember({ ...rawParty, scale: Number.NaN }, "test")).toThrow(/scale/);

    const rawChars = {
      test: { atlas: "assets/characters/sue/sue.json", idleTicks: [32], scale: 0.48 },
    };
    expect(parseCharacters(rawChars, "test").test?.scale).toBe(0.48);
    expect(() => parseCharacters({
      test: { atlas: "assets/characters/sue/sue.json", idleTicks: [32], scale: 0 },
    }, "test")).toThrow(/scale/);
    expect(() => parseCharacters({
      test: { atlas: "assets/characters/sue/sue.json", idleTicks: [32], scale: -1 },
    }, "test")).toThrow(/scale/);
  });
});
