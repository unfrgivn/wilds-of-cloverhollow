import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  arcadeView,
  blankInput,
  clawReach,
  clawView,
  cometObjectProgress,
  cookGoldenHalf,
  cookView,
  cookZone,
  createState,
  GENTLE_CLAW_REACH_SCALE,
  GENTLE_COMET_SPEED_SCALE,
  GENTLE_COOK_GOLDEN_SCALE,
  GENTLE_MOLE_UP_SCALE,
  GENTLE_SKEE_SPEED_SCALE,
  moleWindow,
  newClaw,
  newComet,
  newCook,
  newMole,
  newSkee,
  stepArcade,
  topPlush,
  type ActionFrame,
  type ClawGame,
  type CometGame,
  type CookGame,
  type MoleGame,
  type SkeeGame,
  type State,
} from "../../src/core";

const content = loadContent();
const world = content.world;
const fixture = content.fixtures.arcade;
if (fixture === undefined) throw new Error("Missing arcade fixture");

const confirmInput: ActionFrame = { ...blankInput(), confirm: true };
const idleInput = blankInput();

function stepGame(state: State, input: ActionFrame, gentleTiming: boolean): State {
  return {
    ...state,
    ...stepArcade(world, state, input, gentleTiming),
    previousInput: input,
  };
}

function parsePngMeta(path: string): {
  width: number;
  height: number;
  colorType: number;
  channels: number;
  hasTrnsChunk: boolean;
} {
  const bytes = readFileSync(path);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < sig.length; index += 1) {
    if (bytes[index] !== sig[index]) throw new Error(`${path} is not a PNG`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  const colorType = bytes[25] ?? -1;
  const channels =
    colorType === 0 ? 1
      : colorType === 2 ? 3
        : colorType === 4 ? 2
          : colorType === 6 ? 4
            : 0;
  let hasTrnsChunk = false;
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const chunkLen = view.getUint32(offset, false);
    const kind = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (kind === "tRNS") hasTrnsChunk = true;
    offset += 12 + chunkLen;
  }
  return { width, height, colorType, channels, hasTrnsChunk };
}

describe("Milestone 112: Gentle Timing across all 6 minigames", () => {
  it("widens Claw Machine grab radius, slows aiming, and favors unpinned plushes", () => {
    const claw = world.arcade.claw;
    const base = createState(world, fixture);
    expect(clawReach(claw, false)).toBe(claw.reach);
    expect(clawReach(claw, true)).toBeCloseTo(claw.reach * GENTLE_CLAW_REACH_SCALE, 5);

    // pup-plush is at (480, 275), level 2 (unpinned); drop 56 units away (between
    // normal reach 48 and gentle reach 64.8).
    const offX = 480 + 56;
    const offZ = 275;
    expect(topPlush(claw, base, offX, offZ, false)?.prize).not.toBe("pup-plush");
    expect(topPlush(claw, base, offX, offZ, true)?.prize).toBe("pup-plush");

    // Verify stepArcade grabbing outcome and clawView reach match.
    const dropping: ClawGame = {
      ...newClaw(claw),
      phase: "grabbing",
      phaseTicks: claw.grabTicks - 1,
      x: offX,
      z: offZ,
    };
    const state: State = { ...base, arcade: dropping };
    const normalView = clawView(world, state, dropping, false);
    const gentleView = clawView(world, state, dropping, true);
    expect(gentleView.reach).toBeGreaterThan(normalView.reach);

    const normalGrab = stepGame(state, idleInput, false).arcade;
    const gentleGrab = stepGame(state, idleInput, true).arcade;
    expect(normalGrab?.game).toBe("claw");
    expect(gentleGrab?.game).toBe("claw");
    if (normalGrab?.game === "claw" && gentleGrab?.game === "claw") {
      expect(normalGrab.outcome).not.toBe("grabbed");
      expect(gentleGrab.outcome).toBe("grabbed");
      expect(gentleGrab.target).toBe("pup-plush");
    }

    // Sliding advances slower under gentleTiming for steadier aiming.
    const slidingState: State = {
      ...base,
      arcade: { ...newClaw(claw), phase: "sliding" },
      previousInput: confirmInput,
    };
    const normalSlide = stepGame(slidingState, confirmInput, false).arcade;
    const gentleSlide = stepGame(slidingState, confirmInput, true).arcade;
    if (normalSlide?.game === "claw" && gentleSlide?.game === "claw") {
      expect(gentleSlide.x - claw.railLeft).toBeLessThan(normalSlide.x - claw.railLeft);
    }
  });

  it("slows Skee-Ball aim sweep and power fill by 0.72x under gentleTiming", () => {
    const skee = world.arcade.skee;
    const base: State = { ...createState(world, fixture), arcade: newSkee(skee) };

    let normalAim = base;
    let gentleAim = base;
    for (let tick = 0; tick < 10; tick += 1) {
      normalAim = stepGame(normalAim, idleInput, false);
      gentleAim = stepGame(gentleAim, idleInput, true);
    }
    const nAimGame = normalAim.arcade;
    const gAimGame = gentleAim.arcade;
    expect(nAimGame?.game).toBe("skee");
    expect(gAimGame?.game).toBe("skee");
    if (nAimGame?.game === "skee" && gAimGame?.game === "skee") {
      const startX = -skee.board.width / 2;
      expect(gAimGame.aim - startX).toBeCloseTo(
        (nAimGame.aim - startX) * GENTLE_SKEE_SPEED_SCALE,
        5,
      );
    }

    // Powering phase climbs at 0.72x speed and aligns with skeeView.power.fill.
    const winding: SkeeGame = { ...newSkee(skee), phase: "winding", aim: 0 };
    let normalPower: State = { ...base, arcade: winding };
    let gentlePower: State = { ...base, arcade: winding };
    for (let tick = 0; tick < 20; tick += 1) {
      normalPower = stepGame(normalPower, confirmInput, false);
      gentlePower = stepGame(gentlePower, confirmInput, true);
    }
    const nView = arcadeView(world, normalPower, false);
    const gView = arcadeView(world, gentlePower, true);
    expect(nView?.game).toBe("skee");
    expect(gView?.game).toBe("skee");
    if (nView?.game === "skee" && gView?.game === "skee") {
      expect(nView.power).not.toBeNull();
      expect(gView.power).not.toBeNull();
      if (nView.power !== null && gView.power !== null) {
        expect(gView.power.fill).toBeCloseTo(
          nView.power.fill * GENTLE_SKEE_SPEED_SCALE,
          5,
        );
      }
    }
  });

  it("extends Boop-a-Mole stay-up ticks by +35% under gentleTiming", () => {
    const mole = world.arcade.mole;
    expect(moleWindow(mole, 0, true)).toBe(
      Math.round(moleWindow(mole, 0, false) * GENTLE_MOLE_UP_SCALE),
    );
    expect(moleWindow(mole, mole.moles - 1, true)).toBe(
      Math.round(moleWindow(mole, mole.moles - 1, false) * GENTLE_MOLE_UP_SCALE),
    );

    const [round, seeded] = newMole(mole, createState(world, fixture));
    const upGame: MoleGame = {
      ...round,
      phase: "playing",
      stage: "up",
      stageTicks: 0,
    };
    const normalUpTicks = moleWindow(mole, 0, false);
    let normalState: State = { ...seeded, arcade: upGame };
    let gentleState: State = { ...seeded, arcade: upGame };
    for (let tick = 0; tick < normalUpTicks; tick += 1) {
      normalState = stepGame(normalState, idleInput, false);
      gentleState = stepGame(gentleState, idleInput, true);
    }
    expect(normalState.arcade?.game).toBe("mole");
    expect(gentleState.arcade?.game).toBe("mole");
    if (normalState.arcade?.game === "mole" && gentleState.arcade?.game === "mole") {
      expect(normalState.arcade.stage).toBe("ducking");
      expect(gentleState.arcade.stage).toBe("up");
    }
  });

  it("slows Comet Cruise scroll speed by 0.78x and widens star pickup tolerance by +22%", () => {
    const comet = world.arcade.comet;
    const [round, seeded] = newComet(comet, createState(world, fixture));
    const playing: CometGame = { ...round, phase: "playing", phaseTicks: 0, elapsed: 0 };

    // Scroll speed check: elapsed advances by 0.78x per tick under gentleTiming.
    let normalScroll: State = { ...seeded, arcade: playing };
    let gentleScroll: State = { ...seeded, arcade: playing };
    for (let tick = 0; tick < 25; tick += 1) {
      normalScroll = stepGame(normalScroll, idleInput, false);
      gentleScroll = stepGame(gentleScroll, idleInput, true);
    }
    if (normalScroll.arcade?.game === "comet" && gentleScroll.arcade?.game === "comet") {
      expect(gentleScroll.arcade.elapsed).toBeCloseTo(
        normalScroll.arcade.elapsed * GENTLE_COMET_SPEED_SCALE,
        5,
      );
    }

    // Star pickup tolerance check: a star just entering the rocket's row
    // (progress ~0.92, well before 1.0) is collected under gentleTiming but not yet normally.
    const firstStar = playing.objects.find((item) => item.kind === "star");
    expect(firstStar).toBeDefined();
    if (firstStar === undefined) return;
    const nearElapsed = firstStar.spawn + comet.travelFirst * 0.92;
    const nearGame: CometGame = {
      ...playing,
      lane: firstStar.lane,
      from: firstStar.lane,
      elapsed: nearElapsed,
    };
    expect(cometObjectProgress(comet, firstStar, nearElapsed)).toBeLessThan(1);
    const normalTick = stepGame({ ...seeded, arcade: nearGame }, idleInput, false).arcade;
    const gentleTick = stepGame({ ...seeded, arcade: nearGame }, idleInput, true).arcade;
    if (normalTick?.game === "comet" && gentleTick?.game === "comet") {
      expect(normalTick.caught).toBe(0);
      expect(gentleTick.caught).toBe(1);
    }
  });

  it("widens Microwave Cooking golden band by +35% on both cookView and stepCook", () => {
    const cook = world.arcade.cook;
    expect(cookGoldenHalf(cook, "nuggets", false)).toBe(cook.golden);
    expect(cookGoldenHalf(cook, "nuggets", true)).toBeCloseTo(
      cook.golden * GENTLE_COOK_GOLDEN_SCALE,
      5,
    );

    // 72 seconds (144 ticks) for Dino nuggets (target 60s):
    // normal golden is [50s, 70s] -> "over"; gentle golden is [46.5s, 73.5s] -> "golden"!
    const cookedTicks = 144;
    expect(cookZone(cook, "nuggets", cookedTicks, false)).toBe("over");
    expect(cookZone(cook, "nuggets", cookedTicks, true)).toBe("golden");

    const dingGame: CookGame = {
      ...newCook("nuggets"),
      phase: "ding",
      phaseTicks: cook.dingTicks - 1,
      cooked: cookedTicks,
    };
    const normalView = cookView(world, dingGame, false);
    const gentleView = cookView(world, dingGame, true);
    expect(normalView.zone).toBe("over");
    expect(gentleView.zone).toBe("golden");
    expect(normalView.darkness).toBeGreaterThan(0);
    expect(gentleView.darkness).toBe(0);
    expect(gentleView.goldenWindow.start).toBeLessThan(normalView.goldenWindow.start);
    expect(gentleView.goldenWindow.end).toBeGreaterThan(normalView.goldenWindow.end);
    expect(gentleView.goldenWindow.start).toBeGreaterThanOrEqual(0);
    expect(gentleView.goldenWindow.end).toBeLessThanOrEqual(1);

    const startState: State = { ...createState(world, fixture), arcade: dingGame };
    const normalResult = stepGame(startState, idleInput, false);
    const gentleResult = stepGame(startState, idleInput, true);
    expect(normalResult.snacks - startState.snacks).toBe(cook.snacks.over);
    expect(gentleResult.snacks - startState.snacks).toBe(cook.snacks.golden);
  });
});

describe("Milestone 112: Storybook iOS App Icon, Launch Splash & PWA Icon Kit", () => {
  it("ships exact-size opaque brand icons and launch splashes on disk", () => {
    const appIconPath = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";
    expect(existsSync(appIconPath)).toBe(true);
    const appIcon = parsePngMeta(appIconPath);
    expect(appIcon.width).toBe(1024);
    expect(appIcon.height).toBe(1024);
    // Apple App Store requirement: strictly opaque RGB (colorType 2, 3 channels, no tRNS).
    expect(appIcon.colorType).toBe(2);
    expect(appIcon.channels).toBe(3);
    expect(appIcon.hasTrnsChunk).toBe(false);

    const splashes = [
      "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
      "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png",
      "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png",
    ];
    for (const splashPath of splashes) {
      expect(existsSync(splashPath)).toBe(true);
      const meta = parsePngMeta(splashPath);
      expect(meta.width).toBe(2732);
      expect(meta.height).toBe(2732);
      expect(meta.channels).toBe(3);
    }

    const pwa512Path = "public/icons/icon-512.png";
    expect(existsSync(pwa512Path)).toBe(true);
    const pwa512 = parsePngMeta(pwa512Path);
    expect(pwa512.width).toBe(512);
    expect(pwa512.height).toBe(512);
    expect(pwa512.channels).toBe(3);

    const touch180Path = "public/icons/apple-touch-icon.png";
    expect(existsSync(touch180Path)).toBe(true);
    const touch180 = parsePngMeta(touch180Path);
    expect(touch180.width).toBe(180);
    expect(touch180.height).toBe(180);
    expect(touch180.channels).toBe(3);

    expect(existsSync("art/review/m112-brand-icons.jpg")).toBe(true);
  });

  it("references the PNG icons cleanly in manifest.webmanifest and index.html", () => {
    const manifestRaw: unknown = JSON.parse(
      readFileSync("public/manifest.webmanifest", "utf8"),
    );
    expect(typeof manifestRaw).toBe("object");
    expect(manifestRaw).not.toBeNull();
    if (typeof manifestRaw !== "object" || manifestRaw === null || !("icons" in manifestRaw)) {
      throw new Error("manifest.webmanifest missing icons");
    }
    const icons = manifestRaw.icons;
    expect(Array.isArray(icons)).toBe(true);
    if (!Array.isArray(icons)) return;
    const hasPng512 = icons.some(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        "src" in entry &&
        entry.src === "icons/icon-512.png" &&
        "sizes" in entry &&
        entry.sizes === "512x512" &&
        "type" in entry &&
        entry.type === "image/png",
    );
    const hasSvg = icons.some(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        "type" in entry &&
        entry.type === "image/svg+xml",
    );
    expect(hasPng512).toBe(true);
    expect(hasSvg).toBe(true);

    const html = readFileSync("index.html", "utf8");
    expect(html).toContain(
      '<link rel="apple-touch-icon" sizes="180x180" href="./icons/apple-touch-icon.png">',
    );
  });
});
