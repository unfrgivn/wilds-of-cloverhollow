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
