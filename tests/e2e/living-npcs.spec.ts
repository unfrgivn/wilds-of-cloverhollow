import { expect, test, type Page } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState,
  renderInfo, resetPaused, step, walk,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

function relativeLuminance(rgb: [number, number, number]): number {
  const channel = (value: number): number => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function parseRgb(color: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  if (match === null) throw new Error(`Could not parse color: ${color}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

async function openQaPaused(page: Page, pack: string): Promise<void> {
  await page.goto(`./?qa=${pack}`);
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await step(page, 2);
}

async function assertChatterContrast(page: Page): Promise<void> {
  const chatter = page.locator(".npc-chatter");
  await expect(chatter).toBeVisible();
  await expect.poll(
    () => chatter.evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity)),
    { timeout: 2_000 },
  ).toBeGreaterThan(0.95);
  const styles = await chatter.evaluate((node) => {
    const speaker = node.querySelector(".npc-chatter-speaker");
    const text = node.querySelector(".npc-chatter-text");
    const boxStyle = getComputedStyle(node);
    return {
      bg: boxStyle.backgroundColor,
      speakerColor: speaker === null ? "" : getComputedStyle(speaker).color,
      textColor: text === null ? "" : getComputedStyle(text).color,
    };
  });
  const bgRgb = parseRgb(styles.bg);
  expect(contrastRatio(parseRgb(styles.textColor), bgRgb)).toBeGreaterThanOrEqual(8.5);
  expect(contrastRatio(parseRgb(styles.speakerColor), bgRgb)).toBeGreaterThanOrEqual(8.5);
}

async function assertChatterInViewport(
  page: Page,
  width: number,
  height: number,
): Promise<void> {
  const box = await page.locator(".npc-chatter").boundingBox();
  if (box === null) throw new Error("Expected .npc-chatter bounding box");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(box.y + box.height).toBeLessThanOrEqual(height);
}

async function stepUntilChatter(
  page: Page,
  predicate: (chatter: {
    npcId: string;
    speakerName: string;
    text: string;
    tone: string;
  }) => boolean,
  maxSteps = 420,
): Promise<{ npcId: string; speakerName: string; text: string; tone: string }> {
  for (let tick = 0; tick < maxSteps; tick += 4) {
    const info = await renderInfo(page);
    const chatter = info.npcLife.chatter;
    if (chatter !== null && predicate(chatter)) {
      for (let settle = 0; settle < 16; settle += 2) {
        const opacity = await page.locator(".npc-chatter").evaluate((node) =>
          node instanceof HTMLElement ? Number.parseFloat(node.style.opacity || "0") : 0,
        );
        if (opacity >= 0.99) break;
        await step(page, 2);
      }
      const settled = (await renderInfo(page)).npcLife.chatter;
      if (settled !== null && predicate(settled)) return settled;
    }
    await step(page, 4);
  }
  throw new Error("Timed out waiting for matching NPC chatter bubble");
}

async function holdThroughDoor(
  page: Page,
  key: string,
  targetArea: string,
): Promise<void> {
  await page.keyboard.down(key);
  for (let tick = 0; tick < 100; tick += 1) {
    const state = await readState(page);
    if (state.area === targetArea && state.transition === null) break;
    await step(page, 2);
  }
  await page.keyboard.up(key);
  for (let tick = 0; tick < 40; tick += 1) {
    const state = await readState(page);
    if (state.area === targetArea && state.transition === null) break;
    await step(page, 2);
  }
}

async function finishDialogue(page: Page, choiceText?: string): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const state = await readState(page);
    const dialogue = state.dialogue;
    if (dialogue === null) return;
    if (dialogue.revealed >= dialogue.text.length && dialogue.choices.length > 0) {
      if (choiceText !== undefined) {
        const target = dialogue.choices.indexOf(choiceText);
        if (target >= 0 && dialogue.selected !== target) {
          await page.keyboard.press("ArrowDown");
          await step(page, 2);
          continue;
        }
      }
      await page.keyboard.press("z");
      await step(page, 2);
      continue;
    }
    await page.keyboard.press("z");
    await step(page, 2);
  }
  throw new Error("Dialogue did not finish");
}

function assertNpcsRendered(
  npcs: { id: string; frame: string }[],
  expectedIds: readonly string[],
): void {
  for (const id of expectedIds) {
    const entry = npcs.find((npc) => npc.id === id);
    expect(entry, `missing NPC sprite ${id}`).toBeDefined();
    expect(entry?.frame, `empty frame for ${id}`).not.toBe("");
  }
}

test(
  "real keys: Living NPCs tour across bay, plaza, and park matches Bun hash",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const path = "tests/sim/scripts/new-game/living-npcs.json";
    const expectedHash = bunHash(path, "new-game");
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");

    let bayNpcsChecked = false;
    let salPortraitChecked = false;
    let plazaNpcsChecked = false;
    let floraPortraitChecked = false;
    let parkNpcsChecked = false;

    await playAfter(
      page,
      "tests/sim/scripts/new-game/golden-bay.json",
      path,
      async () => {
        const state = await readState(page);
        const info = await renderInfo(page);

        if (!bayNpcsChecked && state.area === "bay" && state.transition === null) {
          assertNpcsRendered(info.npcs, ["kai", "nora", "sal"]);
          bayNpcsChecked = true;
        }

        if (
          !salPortraitChecked &&
          state.area === "bay" &&
          state.dialogue?.knot === "npc_sal" &&
          state.dialogue.speaker === "Captain Sal"
        ) {
          await expect(page.locator(".sticker-portrait")).toBeVisible();
          await expect(page.locator(".sticker-speaker")).toHaveText("Captain Sal");
          salPortraitChecked = true;
        }

        if (!plazaNpcsChecked && state.area === "plaza" && state.transition === null) {
          assertNpcsRendered(info.npcs, ["flora", "gus", "sammy"]);
          plazaNpcsChecked = true;
        }

        if (
          !floraPortraitChecked &&
          state.area === "plaza" &&
          state.dialogue?.knot === "npc_flora" &&
          state.dialogue.speaker === "Flora"
        ) {
          await expect(page.locator(".sticker-portrait")).toBeVisible();
          await expect(page.locator(".sticker-speaker")).toHaveText("Flora");
          floraPortraitChecked = true;
        }

        if (!parkNpcsChecked && state.area === "park" && state.transition === null) {
          assertNpcsRendered(info.npcs, ["hazel", "pippa"]);
          parkNpcsChecked = true;
        }
      },
    );

    expect({
      bayNpcsChecked,
      salPortraitChecked,
      plazaNpcsChecked,
      floraPortraitChecked,
      parkNpcsChecked,
    }).toEqual({
      bayNpcsChecked: true,
      salPortraitChecked: true,
      plazaNpcsChecked: true,
      floraPortraitChecked: true,
      parkNpcsChecked: true,
    });

    const end = await readState(page);
    expect(end.area).toBe("park");
    expect(end.coins).toBe(53);
    expect(end.snacks).toBe(7);
    expect(await readHash(page)).toBe(await expectedHash);
    expect(errors).toEqual([]);
  },
);

test(
  "organic NPC intelligence: relocation, chatter contrast, lantern awe, and flute music delight",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });

    // 1. Dynamic relocation (before calming Mr. Pip): Sammy waits in Plaza with Flora & Gus.
    await openQaPaused(page, "fountain-frog");
    expect((await readState(page)).area).toBe("plaza");
    const plazaBeforeIds = (await renderInfo(page)).npcs.map((npc) => npc.id);
    expect(plazaBeforeIds).toEqual(expect.arrayContaining(["flora", "gus", "sammy"]));

    // 2. Chatter bubble, neighbor banter, >= 8.5:1 contrast, safe-area clamping & journal hiding.
    await openQaPaused(page, "flute");
    expect((await readState(page)).area).toBe("park");
    await walk(page, "x", 455);
    await walk(page, "y", 535);
    await walk(page, "x", 375);

    const banter = await stepUntilChatter(
      page,
      (bubble) => bubble.tone === "banter" && bubble.npcId === "pippa",
    );
    expect(banter.speakerName).toBe("Pippa");
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-tone", "banter");
    await assertChatterContrast(page);
    await assertChatterInViewport(page, 1280, 720);

    await page.setViewportSize({ width: 874, height: 402 });
    await step(page, 2);
    await assertChatterInViewport(page, 874, 402);
    await page.setViewportSize({ width: 1280, height: 720 });
    await step(page, 2);

    // Opening the journal hides chatter immediately; Escape restores it cleanly.
    await page.keyboard.press("j");
    await step(page, 2);
    await expect(page.locator(".journal-book")).toBeVisible();
    await expect(page.locator(".npc-chatter")).toBeHidden();
    await page.keyboard.press("Escape");
    await step(page, 2);
    await expect(page.locator(".journal-book")).toBeHidden();
    await expect(page.locator(".npc-chatter")).toBeVisible();

    // 3. Live Blacklight Lantern awe reaction (L key), prompt yielding & live Ink reaction.
    await page.keyboard.press("l");
    await step(page, 16);
    expect((await readState(page)).lantern).toBe(true);

    const lanternInfo = await renderInfo(page);
    const pippaLantern = lanternInfo.npcLife.npcs.find((npc) => npc.id === "pippa");
    expect(pippaLantern?.attention).toBe("lantern-awe");
    expect(pippaLantern?.emote).toBe("sparkle");
    await expect(page.locator(".npc-chatter")).toBeVisible();
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-tone", "lantern");
    await expect(page.locator(".npc-chatter-text")).toContainText("glowing clover");
    await assertChatterContrast(page);

    // Walk into TALK range of Pippa -> .sticker-prompt appears and .npc-chatter yields!
    await walk(page, "y", 520);
    await walk(page, "x", 352);
    await page.keyboard.down("ArrowLeft");
    await step(page, 2);
    await page.keyboard.up("ArrowLeft");
    await step(page, 2);
    await expect(page.locator(".sticker-prompt")).toBeVisible();
    await expect(page.locator(".npc-chatter")).toBeHidden();

    // Talk while lantern is ON -> Ink dialogue shows live lanternOn() reaction line!
    await page.keyboard.press("z");
    await step(page, 4);
    const lanternDialogue = (await readState(page)).dialogue;
    expect(lanternDialogue?.knot).toBe("npc_pippa");
    expect(lanternDialogue?.text).toContain("blacklight lantern");
    await expect(page.locator(".sticker-portrait")).toBeVisible();
    await finishDialogue(page, "Ask what she spotted in the park");

    // Step back out of TALK range and switch lantern OFF.
    await walk(page, "x", 375);
    await walk(page, "y", 535);
    await page.keyboard.press("l");
    await step(page, 4);
    expect((await readState(page)).lantern).toBe(false);

    // 4. Live Flute music delight reaction (F key -> "Just play").
    await page.keyboard.press("f");
    await step(page, 4);
    expect((await readState(page)).dialogue?.knot).toBe("flute");
    await finishDialogue(page, "Just play");
    await step(page, 16);

    const musicInfo = await renderInfo(page);
    const pippaMusic = musicInfo.npcLife.npcs.find((npc) => npc.id === "pippa");
    const hazelMusic = musicInfo.npcLife.npcs.find((npc) => npc.id === "hazel");
    expect(pippaMusic?.attention).toBe("music-delight");
    expect(pippaMusic?.emote).toBe("note");
    expect(hazelMusic?.attention).toBe("music-delight");
    expect(hazelMusic?.emote).toBe("note");
    await expect(page.locator(".npc-chatter")).toBeVisible();
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-tone", "music");
    await assertChatterContrast(page);

    // 5. Dynamic relocation (after calming Mr. Pip): walk from Park -> Plaza -> Arcade.
    await walk(page, "y", 850);
    await walk(page, "x", 300);
    await holdThroughDoor(page, "ArrowDown", "plaza");
    expect((await readState(page)).area).toBe("plaza");
    const plazaAfterIds = (await renderInfo(page)).npcs.map((npc) => npc.id);
    expect(plazaAfterIds).not.toContain("sammy");
    expect(plazaAfterIds).toEqual(expect.arrayContaining(["flora", "gus"]));

    await walk(page, "x", 1300);
    await walk(page, "y", 560);
    await walk(page, "x", 1412);
    await holdThroughDoor(page, "ArrowUp", "arcade");
    expect((await readState(page)).area).toBe("arcade");
    assertNpcsRendered((await renderInfo(page)).npcs, ["sammy", "poppy"]);
    const arcadeBanter = await stepUntilChatter(
      page,
      (bubble) =>
        bubble.tone === "banter" &&
        (bubble.npcId === "sammy" || bubble.npcId === "poppy"),
    );
    expect(["Sammy", "Poppy"]).toContain(arcadeBanter.speakerName);
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-tone", "banter");
    await assertChatterContrast(page);
    await assertChatterInViewport(page, 1280, 720);

    expect(errors).toEqual([]);
  },
);

test(
  "wave-3 residents, neighbor banter duos, snack-sharing, and Misty Path Star-Watcher Sage",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });

    // 1. Misty Path — Star-Watcher Sage reacts to Fae's Blacklight Lantern (real L key).
    await openQaPaused(page, "mist");
    expect((await readState(page)).area).toBe("mist");
    assertNpcsRendered((await renderInfo(page)).npcs, ["sage"]);

    await page.keyboard.press("l");
    await step(page, 24);
    expect((await readState(page)).lantern).toBe(true);

    const mistInfo = await renderInfo(page);
    const sageLantern = mistInfo.npcLife.npcs.find((npc) => npc.id === "sage");
    expect(sageLantern?.attention).toBe("lantern-awe");
    expect(sageLantern?.emote).toBe("sparkle");
    await expect(page.locator(".npc-chatter")).toBeVisible();
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-tone", "lantern");
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-npc", "sage");
    await assertChatterContrast(page);
    await assertChatterInViewport(page, 1280, 720);

    // 2. Mountain Lodge fireside duo (Otis & Clara) banter + real-key snack sharing to Otis.
    await openQaPaused(page, "lodge");
    expect((await readState(page)).area).toBe("lodge");
    assertNpcsRendered((await renderInfo(page)).npcs, ["otis", "clara"]);

    const lodgeBanter = await stepUntilChatter(
      page,
      (bubble) =>
        bubble.tone === "banter" &&
        (bubble.npcId === "otis" || bubble.npcId === "clara"),
    );
    expect(["Otis", "Clara"]).toContain(lodgeBanter.speakerName);
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-tone", "banter");
    await assertChatterContrast(page);
    await assertChatterInViewport(page, 1280, 720);

    const beforeSnack = await readState(page);
    expect(beforeSnack.snacks).toBeGreaterThan(0);

    await walk(page, "x", 600);
    await walk(page, "y", 645);
    await page.keyboard.down("ArrowDown");
    await step(page, 2);
    await page.keyboard.up("ArrowDown");
    await step(page, 2);

    await page.keyboard.press("z");
    await step(page, 4);
    expect((await readState(page)).dialogue?.knot).toBe("npc_otis");
    await finishDialogue(page, "Share a cozy snack!");
    await step(page, 4);

    const afterSnack = await readState(page);
    expect(afterSnack.snacks).toBe(beforeSnack.snacks - 1);
    expect(afterSnack.coins).toBe(beforeSnack.coins + 8);

    // 3. Art Room duo (Maya & Theo) rendered after opening the art room via golden-art.
    await openHarness(page);
    await resetPaused(page, "new-game");
    await playAfter(
      page,
      "tests/sim/scripts/new-game/golden-field.json",
      "tests/sim/scripts/new-game/golden-art.json",
    );
    expect((await readState(page)).area).toBe("art-room");
    assertNpcsRendered((await renderInfo(page)).npcs, ["maya", "theo"]);

    await walk(page, "x", 600);
    const artBanter = await stepUntilChatter(
      page,
      (bubble) =>
        bubble.tone === "banter" &&
        (bubble.npcId === "maya" || bubble.npcId === "theo"),
    );
    expect(["Maya", "Theo"]).toContain(artBanter.speakerName);
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-tone", "banter");
    await assertChatterContrast(page);
    await assertChatterInViewport(page, 1280, 720);

    expect(errors).toEqual([]);
  },
);

test(
  "shop regulars, journal neighborhood errands, and post-finale celebration",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await openQaPaused(page, "fountain-frog");
    expect((await readState(page)).area).toBe("plaza");

    // 1. Start Mailman Gus's Postal Chain & verify Fae's Journal NOTES records it cleanly.
    await walk(page, "x", 600);
    await walk(page, "y", 390);
    await walk(page, "x", 495);
    await page.keyboard.down("ArrowUp");
    await step(page, 2);
    await page.keyboard.up("ArrowUp");
    await step(page, 2);
    await page.keyboard.press("z");
    await step(page, 4);
    expect((await readState(page)).dialogue?.knot).toBe("npc_gus");
    await finishDialogue(page, "Offer to help deliver mail to the bay");
    await step(page, 4);

    await page.keyboard.press("j");
    await step(page, 2);
    await expect(page.locator(".journal-book")).toBeVisible();
    await expect(page.locator(".journal-book")).toContainText("Seashell Postcard to Captain Sal");
    await page.keyboard.press("Escape");
    await step(page, 2);

    // 2. Enter Cloverhollow Grocery Market: verify Marigold + Pippin banter & gift.
    await walk(page, "y", 400);
    await walk(page, "x", 700);
    await holdThroughDoor(page, "ArrowUp", "market");
    expect((await readState(page)).area).toBe("market");
    assertNpcsRendered((await renderInfo(page)).npcs, ["marigold", "pippin"]);

    const marketBanter = await stepUntilChatter(
      page,
      (bubble) =>
        bubble.tone === "banter" &&
        (bubble.npcId === "marigold" || bubble.npcId === "pippin"),
    );
    expect(["Mrs. Marigold", "Grocer Pippin"]).toContain(marketBanter.speakerName);
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-tone", "banter");
    await assertChatterContrast(page);
    await assertChatterInViewport(page, 1280, 720);

    const coinsBeforeMarigold = (await readState(page)).coins;
    await walk(page, "y", 640);
    await walk(page, "x", 470);
    await page.keyboard.down("ArrowRight");
    await step(page, 2);
    await page.keyboard.up("ArrowRight");
    await step(page, 2);
    await page.keyboard.press("z");
    await step(page, 4);
    expect((await readState(page)).dialogue?.knot).toBe("npc_marigold");
    await expect(page.locator(".sticker-speaker")).toHaveText("Mrs. Marigold");
    await expect(page.locator(".sticker-portrait")).toBeVisible();
    await finishDialogue(page, "Help Mrs. Marigold pick a ripe orchard apple");
    await step(page, 4);
    const afterMarigold = await readState(page);
    expect(afterMarigold.coins).toBe(coinsBeforeMarigold + 6);
    expect(afterMarigold.treats?.["orchard-apple"]).toBe(1);

    // 3. Exit to Plaza and enter Sweet Scoop Ice Cream Parlor: Danny + Penny banter & gift.
    await walk(page, "y", 540);
    await walk(page, "x", 200);
    await holdThroughDoor(page, "ArrowUp", "plaza");
    expect((await readState(page)).area).toBe("plaza");
    await walk(page, "y", 400);
    await walk(page, "x", 938);
    await holdThroughDoor(page, "ArrowUp", "parlor");
    expect((await readState(page)).area).toBe("parlor");
    assertNpcsRendered((await renderInfo(page)).npcs, ["danny", "penny"]);

    const parlorBanter = await stepUntilChatter(
      page,
      (bubble) =>
        bubble.tone === "banter" &&
        (bubble.npcId === "danny" || bubble.npcId === "penny"),
    );
    expect(["Danny", "Scooper Penny"]).toContain(parlorBanter.speakerName);
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-tone", "banter");
    await assertChatterContrast(page);
    await assertChatterInViewport(page, 1280, 720);

    const coinsBeforeDanny = (await readState(page)).coins;
    await walk(page, "y", 695);
    await walk(page, "x", 488);
    await page.keyboard.down("ArrowRight");
    await step(page, 2);
    await page.keyboard.up("ArrowRight");
    await step(page, 2);
    await page.keyboard.press("z");
    await step(page, 4);
    expect((await readState(page)).dialogue?.knot).toBe("npc_danny");
    await expect(page.locator(".sticker-speaker")).toHaveText("Danny");
    await expect(page.locator(".sticker-portrait")).toBeVisible();
    await finishDialogue(page, "Trade ice-cream flavor tips with Danny");
    await step(page, 4);
    const afterDanny = await readState(page);
    expect(afterDanny.coins).toBe(coinsBeforeDanny + 6);
    expect(afterDanny.treats?.["berry-cone"]).toBe(1);

    // 4. Post-finale celebration pass (forest_calm): festive banter, warm chatter & emotes.
    await walk(page, "x", 360);
    await walk(page, "y", 600);
    const finaleBackup = await page.evaluate(() => {
      const raw = window.__cloverhollow?.save.exportBackup?.();
      if (raw === undefined) return null;
      const isObj = (v: unknown): v is Record<string, unknown> =>
        typeof v === "object" && v !== null && !Array.isArray(v);
      const env: unknown = JSON.parse(raw);
      if (!isObj(env) || typeof env.save !== "string") return null;
      const payload: unknown = JSON.parse(env.save);
      if (!isObj(payload) || !isObj(payload.state)) return null;
      const st = payload.state;
      if (!isObj(st.critters) || typeof st.ink !== "string") return null;
      st.critters["hooded-kid"] = "calm";
      const inkObj: unknown = JSON.parse(st.ink);
      if (!isObj(inkObj) || !isObj(inkObj.variablesState)) return null;
      inkObj.variablesState.forest_fizzy = false;
      st.ink = JSON.stringify(inkObj);
      return JSON.stringify(payload);
    });
    expect(finaleBackup).not.toBeNull();
    await openHarness(page);
    const imported = await page.evaluate(async (saveJson) => {
      const hook = window.__cloverhollow;
      if (hook?.save.importBackup === undefined || saveJson === null) return false;
      return hook.save.importBackup(saveJson);
    }, finaleBackup);
    expect(imported).toBe(true);
    await step(page, 60);

    expect((await renderInfo(page)).npcLife.stage).toBe("forest_calm");
    const finaleBanter = await stepUntilChatter(
      page,
      (bubble) =>
        bubble.tone === "banter" &&
        (bubble.text.includes("Victory Dream Sundaes") || bubble.text.includes("Milo")),
    );
    expect(["Danny", "Scooper Penny"]).toContain(finaleBanter.speakerName);

    // Walk within Danny's greet/celebration range & verify warm finale chatter + sparkle emote.
    await walk(page, "y", 700);
    await walk(page, "x", 420);
    const finaleWarm = await stepUntilChatter(
      page,
      (bubble) => bubble.tone === "warm" && bubble.npcId === "danny",
      480,
    );
    expect(finaleWarm.text).toContain("Victory Rainbow Sundae");
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-tone", "warm");
    await assertChatterContrast(page);
    const dannyLife = (await renderInfo(page)).npcLife.npcs.find((n) => n.id === "danny");
    expect(dannyLife?.emote).toBe("sparkle");

    expect(errors).toEqual([]);
  },
);

test(
  "party companion overworld banter and interactive tool micro-events",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });

    // 1. Live Sue & Jordan partyBanter in Clubhouse (?qa=clubhouse) with contrast & clamping.
    await openQaPaused(page, "clubhouse");
    expect((await readState(page)).area).toBe("clubhouse");
    const clubBanter = await stepUntilChatter(
      page,
      (bubble) => bubble.npcId === "sue" || bubble.npcId === "jordan",
      420,
    );
    expect(["Sue", "Jordan"]).toContain(clubBanter.speakerName);
    await assertChatterContrast(page);
    await assertChatterInViewport(page, 1280, 720);
    const clubParty = (await renderInfo(page)).npcLife.party;
    expect(clubParty.find((m) => m.id === "sue")?.attention).toBe("party-chat");
    expect(clubParty.find((m) => m.id === "jordan")?.attention).toBe("party-chat");

    await page.setViewportSize({ width: 874, height: 402 });
    await step(page, 2);
    await assertChatterInViewport(page, 874, 402);
    await page.setViewportSize({ width: 1280, height: 720 });
    await step(page, 2);

    // 2. Meadow Park Flute Concert micro-event (?qa=flute -> F -> "Just play").
    await openQaPaused(page, "flute");
    expect((await readState(page)).area).toBe("park");
    await walk(page, "x", 455);
    await walk(page, "y", 535);
    await walk(page, "x", 375);

    await page.keyboard.press("f");
    await step(page, 4);
    expect((await readState(page)).dialogue?.knot).toBe("flute");
    await finishDialogue(page, "Just play");
    await step(page, 22);

    const parkInfo = await renderInfo(page);
    expect(parkInfo.npcLife.activeToolEventId).toBe("park-flute-concert");
    expect(parkInfo.npcLife.chatter?.npcId).toBe("pippa");
    expect(parkInfo.npcLife.npcs.find((n) => n.id === "pippa")?.attention).toBe("music-delight");
    expect(parkInfo.npcLife.npcs.find((n) => n.id === "hazel")?.attention).toBe("music-delight");
    expect(parkInfo.npcLife.party.find((m) => m.id === "sue")).toMatchObject({
      attention: "music-delight", emote: "note",
    });
    expect(parkInfo.npcLife.party.find((m) => m.id === "jordan")).toMatchObject({
      attention: "music-delight", emote: "note",
    });
    await expect(page.locator(".npc-chatter")).toBeVisible();
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-tone", "music");
    await assertChatterContrast(page);
    await assertChatterInViewport(page, 1280, 720);

    // 3. Crystal Cavern Blacklight Crystal Resonance micro-event (L key, Pebble -> Gemma).
    await openHarness(page);
    await resetPaused(page, "cavern");
    expect((await readState(page)).area).toBe("cavern");
    assertNpcsRendered((await renderInfo(page)).npcs, ["pebble", "gemma"]);

    await page.keyboard.press("l");
    await step(page, 24);
    expect((await readState(page)).lantern).toBe(true);

    const cavernTurn0 = await renderInfo(page);
    expect(cavernTurn0.npcLife.activeToolEventId).toBe("cavern-crystal-resonance");
    expect(cavernTurn0.npcLife.chatter?.npcId).toBe("pebble");
    expect(cavernTurn0.npcLife.party.find((m) => m.id === "sue")).toMatchObject({
      attention: "lantern-awe", emote: "sparkle",
    });
    expect(cavernTurn0.npcLife.party.find((m) => m.id === "jordan")).toMatchObject({
      attention: "lantern-awe", emote: "sparkle",
    });
    await expect(page.locator(".npc-chatter")).toBeVisible();
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-tone", "lantern");
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-npc", "pebble");
    await assertChatterContrast(page);
    await assertChatterInViewport(page, 1280, 720);

    // Step into turn 1 and confirm Gemma replies smoothly.
    await step(page, 100);
    const cavernTurn1 = await renderInfo(page);
    expect(cavernTurn1.npcLife.activeToolEventId).toBe("cavern-crystal-resonance");
    expect(cavernTurn1.npcLife.chatter?.npcId).toBe("gemma");
    await expect(page.locator(".npc-chatter")).toHaveAttribute("data-npc", "gemma");

    expect(errors).toEqual([]);
  },
);
