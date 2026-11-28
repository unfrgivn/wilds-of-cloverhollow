import { expect, test, type Page } from "@playwright/test";
import type { MusicDebugInfo } from "../../src/platform/audio";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  readBattle,
  readState,
  resetPaused,
  step,
} from "./helpers";

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function readMusic(page: Page): Promise<MusicDebugInfo> {
  const info = await page.evaluate(() => window.__cloverhollow?.sound.music());
  if (info === undefined) throw new Error("hook unavailable");
  return info;
}

test(
  "title screen plays Watercolor Morning, gameplay plays Home, and dialogue ducks it",
  { tag: "@smoke" },
  async ({ page }) => {
    await openHarness(page);
    await expect.poll(async () => (await readMusic(page)).track).toBe("title");
    expect((await readMusic(page)).title).toBe("Watercolor Morning");
    expect((await readMusic(page)).ambience).toBe("none");
    expect((await readMusic(page)).duck).toBe(false);

    // Start a fresh game with a real key press (which also unlocks Web Audio).
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => window.__cloverhollow?.boot.title())).toBeNull();
    await expect.poll(async () => (await readMusic(page)).track).toBe("home");
    await expect.poll(async () => (await readMusic(page)).playing).toBe(true);
    expect((await readMusic(page)).title).toBe("Cloverhollow Town");

    // Reset paused into bedroom so we can walk deterministically to the window.
    await resetPaused(page, "new-game");
    expect((await readMusic(page)).duck).toBe(false);
    await hold(page, "ArrowRight", 28);
    await hold(page, "ArrowUp", 18);
    await page.keyboard.press("z");
    await step(page, 2);
    expect((await readState(page)).dialogue).not.toBeNull();
    expect((await readMusic(page)).duck).toBe(true);
  },
);

test(
  "battle switches soundtrack to Fizzy Calm-Down! and returns to town on calm",
  { tag: "@smoke" },
  async ({ page }) => {
    test.setTimeout(longFlowTimeout);
    await openHarness(page);
    await resetPaused(page, "plaza");
    expect(await readMusic(page)).toMatchObject({
      track: "home",
      ambience: "town-breeze",
      duck: false,
      title: "Cloverhollow Town",
    });

    for (const [key, ticks] of [
      ["ArrowDown", 25],
      ["ArrowLeft", 15],
      ["ArrowDown", 50],
      ["ArrowLeft", 35],
    ] as const) {
      await hold(page, key, ticks);
    }
    expect(await readBattle(page)).not.toBeNull();
    expect(await readMusic(page)).toMatchObject({
      track: "battle",
      ambience: "none",
      duck: false,
      title: "Fizzy Calm-Down!",
    });

    for (let action = 0; action < 150; action += 1) {
      const battle = await readBattle(page);
      if (battle === null) break;
      if (battle.phase === "check" && battle.check !== null) await playBattleCheck(page);
      else {
        await page.keyboard.down("Enter");
        await step(page, 1);
        await page.keyboard.up("Enter");
        await step(page, 1);
      }
    }
    expect((await readState(page)).critters["fountain-frog"]).toBe("calm");
    expect(await readMusic(page)).toMatchObject({
      track: "home",
      ambience: "town-breeze",
      duck: false,
      title: "Cloverhollow Town",
    });
  },
);

test(
  "journal OPTIONS tab controls music and ambience, persists on reload, and renders cleanly",
  { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "plaza");

    // Open journal and flip twice with ArrowRight: notes -> map -> options.
    await page.keyboard.press("j");
    await step(page, 2);
    const book = page.locator(".journal-book");
    await expect(book).toHaveAttribute("data-journal-page", "notes");
    expect((await readMusic(page)).duck).toBe(true);

    await page.keyboard.press("ArrowRight");
    await expect(book).toHaveAttribute("data-journal-page", "map");
    await page.keyboard.press("ArrowRight");
    await expect(book).toHaveAttribute("data-journal-page", "options");

    await expect(page.locator(".journal-now-playing")).toHaveText("♫ Cloverhollow Town");
    await expect(page).toHaveScreenshot("journal-options-1280.png");

    // Toggle music off & back on via click.
    const musicToggle = page.locator(".journal-opt-music");
    await expect(musicToggle).toHaveText("on");
    await musicToggle.click();
    await expect.poll(async () => (await readMusic(page)).muted).toBe(true);
    await expect(musicToggle).toHaveText("off");
    await musicToggle.click();
    await expect.poll(async () => (await readMusic(page)).muted).toBe(false);
    await expect(musicToggle).toHaveText("on");

    // Adjust music volume with keyboard without flipping journal pages, then click.
    const musicSlider = page.locator(".journal-music-slider");
    await musicSlider.focus();
    await page.keyboard.press("Home");
    await expect.poll(async () => (await readMusic(page)).level).toBe(0.25);
    await expect(book).toHaveAttribute("data-journal-page", "options");
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await readMusic(page)).level).toBe(0.5);
    await expect(book).toHaveAttribute("data-journal-page", "options");
    await musicSlider.click();
    await expect.poll(async () => (await readMusic(page)).level).toBe(0.75);
    await musicSlider.click();
    await expect.poll(async () => (await readMusic(page)).level).toBe(1);

    // Toggle ambience off and keep music muted = false, level = 1, ambienceMuted = true.
    const ambienceToggle = page.locator(".journal-opt-ambience");
    await expect(ambienceToggle).toHaveText("on");
    await ambienceToggle.click();
    await expect.poll(async () => (await readMusic(page)).ambienceMuted).toBe(true);
    await expect(ambienceToggle).toHaveText("off");

    // Also mute music before reload so both toggles + volume persistence are verified.
    await musicToggle.click();
    await expect.poll(async () => (await readMusic(page)).muted).toBe(true);

    // Reload and verify preferences persisted in Capacitor Preferences.
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await expect.poll(async () => (await readMusic(page)).muted).toBe(true);
    await expect.poll(async () => (await readMusic(page)).level).toBe(1);
    await expect.poll(async () => (await readMusic(page)).ambienceMuted).toBe(true);

    // Restore clean defaults for subsequent tests sharing storage if any.
    await resetPaused(page, "plaza");
    await page.keyboard.press("j");
    await step(page, 2);
    await page.locator(".journal-options-tab").click();
    await expect(book).toHaveAttribute("data-journal-page", "options");
    await page.locator(".journal-opt-music").click();
    await page.locator(".journal-opt-ambience").click();
  },
);

test(
  "journal OPTIONS fits phone landscape touch layout with insets",
  { tag: "@smoke" },
  async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 874, height: 402 },
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("./?touch=1");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "plaza");
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--safe-right", "62px");
      document.documentElement.style.setProperty("--safe-bottom", "21px");
      document.documentElement.style.setProperty("--safe-left", "62px");
    });

    await page.keyboard.press("j");
    await step(page, 2);
    const optionsTab = page.locator(".journal-options-tab");
    const tabBounds = await optionsTab.boundingBox();
    if (tabBounds === null) throw new Error("options bookmark has no bounds");
    await page.touchscreen.tap(
      tabBounds.x + tabBounds.width / 2,
      tabBounds.y + tabBounds.height / 2,
    );
    await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "options");
    await expect(page).toHaveScreenshot("journal-options-874.png");

    // Tap music toggle and ambience toggle with real touch taps.
    const musicToggle = page.locator(".journal-opt-music");
    const musicBounds = await musicToggle.boundingBox();
    if (musicBounds === null) throw new Error("music toggle has no bounds");
    await page.touchscreen.tap(
      musicBounds.x + musicBounds.width / 2,
      musicBounds.y + musicBounds.height / 2,
    );
    await expect.poll(async () => (await readMusic(page)).muted).toBe(true);
    await context.close();
  },
);

test(
  "cafe, cavern, and hills play their bespoke themes and ambience beds",
  { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);

    // Unlock Web Audio with a real Enter key press on the title screen.
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => window.__cloverhollow?.boot.title())).toBeNull();

    // Bon Appetit Café -> Cinnamon Waltz + cafe-murmur; real keys open journal OPTIONS & duck it.
    await resetPaused(page, "cafe");
    expect(await readMusic(page)).toMatchObject({
      track: "cafe",
      ambience: "cafe-murmur",
      duck: false,
      title: "Cinnamon Waltz",
      playing: true,
    });
    await page.keyboard.press("j");
    await step(page, 2);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".journal-now-playing")).toHaveText("♫ Cinnamon Waltz");
    expect((await readMusic(page)).duck).toBe(true);
    await page.keyboard.press("j");
    await step(page, 2);
    expect((await readMusic(page)).duck).toBe(false);

    // Crystal Cavern -> Crystal Echoes + cavern-drips; step with real keys to verify live loop.
    await resetPaused(page, "cavern");
    await hold(page, "ArrowUp", 10);
    expect(await readMusic(page)).toMatchObject({
      track: "cavern",
      ambience: "cavern-drips",
      duck: false,
      title: "Crystal Echoes",
      playing: true,
    });

    // Clover Hills -> Clover Meadow + town-breeze; step with real keys to verify live loop.
    await resetPaused(page, "hills");
    await hold(page, "ArrowRight", 10);
    expect(await readMusic(page)).toMatchObject({
      track: "hills",
      ambience: "town-breeze",
      duck: false,
      title: "Clover Meadow",
      playing: true,
    });
  },
);

test(
  "lodge, clubhouse, sanctuary, interiors, and expansion areas play bespoke themes; " +
    "Jukebox cycles all 35 tracks",
  { tag: "@smoke" },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);

    // Unlock Web Audio with a real Enter key press on the title screen.
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => window.__cloverhollow?.boot.title())).toBeNull();

    // Cloverhollow Grocery Market -> Pippin's Basket Waltz + cafe-murmur ambience.
    await resetPaused(page, "market");
    await hold(page, "ArrowRight", 8);
    expect(await readMusic(page)).toMatchObject({
      track: "market",
      ambience: "cafe-murmur",
      duck: false,
      title: "Pippin's Basket Waltz",
      playing: true,
    });

    // Sweet Scoop Ice Cream Parlor -> Sweet Scoop Rag + cafe-murmur ambience.
    await resetPaused(page, "parlor");
    await hold(page, "ArrowRight", 8);
    expect(await readMusic(page)).toMatchObject({
      track: "parlor",
      ambience: "cafe-murmur",
      duck: false,
      title: "Sweet Scoop Rag",
      playing: true,
    });

    // Sue's Beach Cottage -> Sea-Glass Sunroom + ocean ambience.
    await resetPaused(page, "sue-cottage");
    await hold(page, "ArrowRight", 8);
    expect(await readMusic(page)).toMatchObject({
      track: "cottage",
      ambience: "ocean",
      duck: false,
      title: "Sea-Glass Sunroom",
      playing: true,
    });

    // Jordan's Mountain Cabin -> Timber & Tea + hearth ambience.
    await resetPaused(page, "jordan-cabin");
    await hold(page, "ArrowRight", 8);
    expect(await readMusic(page)).toMatchObject({
      track: "cabin",
      ambience: "hearth",
      duck: false,
      title: "Timber & Tea",
      playing: true,
    });

    // Pinecone Lodge -> Hearth & Cocoa + hearth ambience.
    await resetPaused(page, "lodge");
    await hold(page, "ArrowUp", 8);
    expect(await readMusic(page)).toMatchObject({
      track: "lodge",
      ambience: "hearth",
      duck: false,
      title: "Hearth & Cocoa",
      playing: true,
    });

    // Secret Clubhouse -> Our Secret Treehouse + none ambience.
    await resetPaused(page, "clubhouse");
    await hold(page, "ArrowRight", 8);
    expect(await readMusic(page)).toMatchObject({
      track: "clubhouse",
      ambience: "none",
      duck: false,
      title: "Our Secret Treehouse",
      playing: true,
    });

    // Milo's Sketch Loft -> Paper Plane Sketchbook + none ambience.
    await resetPaused(page, "milo-house");
    await hold(page, "ArrowRight", 8);
    expect(await readMusic(page)).toMatchObject({
      track: "loft",
      ambience: "none",
      duck: false,
      title: "Paper Plane Sketchbook",
      playing: true,
    });

    // Rosie's Flower Cottage -> Rosie's Flower Window + none ambience.
    await resetPaused(page, "rosie-cottage");
    await hold(page, "ArrowRight", 8);
    expect(await readMusic(page)).toMatchObject({
      track: "bloom",
      ambience: "none",
      duck: false,
      title: "Rosie's Flower Window",
      playing: true,
    });

    // Starlight Island -> Starlight Beacon + ocean ambience.
    await resetPaused(page, "island");
    await hold(page, "ArrowRight", 8);
    expect(await readMusic(page)).toMatchObject({
      track: "island",
      ambience: "ocean",
      duck: false,
      title: "Starlight Beacon",
      playing: true,
    });

    // Alpine Summit Overlook -> Above the Pines + mountain-wind ambience.
    await resetPaused(page, "summit");
    await hold(page, "ArrowUp", 8);
    expect(await readMusic(page)).toMatchObject({
      track: "summit",
      ambience: "mountain-wind",
      duck: false,
      title: "Above the Pines",
      playing: true,
    });

    // Ms. Willow's Music Room -> Ms. Willow's Recital + none ambience.
    await resetPaused(page, "music");
    await hold(page, "ArrowRight", 8);
    expect(await readMusic(page)).toMatchObject({
      track: "melody",
      ambience: "none",
      duck: false,
      title: "Ms. Willow's Recital",
      playing: true,
    });

    // Wildlife Sanctuary -> Meadow of Friends + forest ambience.
    await resetPaused(page, "sanctuary");
    await hold(page, "ArrowUp", 8);
    expect(await readMusic(page)).toMatchObject({
      track: "sanctuary",
      ambience: "forest",
      duck: false,
      title: "Meadow of Friends",
      playing: true,
    });

    // Open journal OPTIONS and cycle cleanly through all 35 jukebox tracks back to sanctuary.
    await page.keyboard.press("j");
    await step(page, 2);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const nowPlaying = page.locator(".journal-now-playing");
    await expect(nowPlaying).toHaveText("♫ Meadow of Friends");

    const nextBtn = page.locator(".journal-jukebox-next");
    const visited: string[] = [];
    let prevTrack = "sanctuary";
    for (let i = 0; i < 35; i += 1) {
      await nextBtn.click();
      await expect.poll(async () => (await readMusic(page)).track).not.toBe(prevTrack);
      const info = await readMusic(page);
      prevTrack = info.track;
      visited.push(info.track);
      expect(info.duck).toBe(false);
      await expect(nowPlaying).toHaveText(`♫ ${info.title}`);
    }
    expect(new Set(visited).size).toBe(35);
    expect(visited).toContain("melody");
    expect(visited).toContain("canvas");
    expect(visited).toContain("encore");
    expect(visited).toContain("hearts");
    expect(visited).toContain("road");
    expect(visited).toContain("market");
    expect(visited).toContain("parlor");
    expect(visited).toContain("loft");
    expect(visited).toContain("bloom");
    expect(visited).toContain("cottage");
    expect(visited).toContain("island");
    expect(visited).toContain("cabin");
    expect(visited).toContain("summit");
    expect(visited).toContain("taco");
    expect(visited).toContain("sanctuary");
    expect(visited).toContain("festival");
    expect(visited).toContain("lodge");
    expect(visited).toContain("clubhouse");
    expect(visited).toContain("fishing");
    expect(visited.at(-1)).toBe("sanctuary");

    // Closing journal returns to live area theme cleanly.
    await page.keyboard.press("j");
    await step(page, 2);
    expect(await readMusic(page)).toMatchObject({
      track: "sanctuary",
      ambience: "forest",
      duck: false,
      title: "Meadow of Friends",
    });
  },
);
