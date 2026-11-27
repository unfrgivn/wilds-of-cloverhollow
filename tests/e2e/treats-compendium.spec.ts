import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  longFlowTimeout,
  playBattleCheck,
  readBattle,
  readState,
  step,
  walk,
} from "./helpers";

async function press(page: Page, key = "z"): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function pickPaused(page: Page, label: string): Promise<void> {
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.evaluate(() => window.__cloverhollow?.pause());
  await page.keyboard.press("q");
  await step(page, 2);
  await page.locator(".qa-option", { hasText: label }).click();
  await step(page, 2);
  await expect(page.locator(".qa-badge")).toContainText(label);
}

async function captureReview(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium")
    return;
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
  });
}

async function finishDialogue(page: Page, choiceIndex: number): Promise<void> {
  for (let count = 0; count < 40; count += 1) {
    const dialogue = (await readState(page)).dialogue;
    if (dialogue === null) return;
    if (dialogue.revealed < dialogue.text.length) {
      await press(page, "z");
      continue;
    }
    if (dialogue.choices.length > 0) {
      for (let stepDown = 0; stepDown < choiceIndex; stepDown += 1) {
        await press(page, "ArrowDown");
      }
      await press(page, "z");
      continue;
    }
    await press(page, "z");
  }
  expect((await readState(page)).dialogue).toBeNull();
}

test.describe("plaza specialty shops, Treat Tray, and Journal Compendium", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "real keys: buy treats at Grocery & Ice Cream, inspect Field Note Card, use Favourite Treat",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await pickPaused(page, "Mr. Pip's arcade");

      // Walk out the arcade door into Cloverhollow Plaza.
      await page.keyboard.down("ArrowLeft");
      await page.keyboard.down("ArrowUp");
      for (let tries = 0; tries < 20; tries += 1) {
        await step(page, 4);
        if ((await readState(page)).transition !== null) break;
      }
      await page.keyboard.up("ArrowLeft");
      await page.keyboard.up("ArrowUp");
      for (let wait = 0; wait < 20; wait += 1) {
        if ((await readState(page)).transition === null) break;
        await step(page, 4);
      }
      expect((await readState(page)).area).toBe("plaza");
      const startCoins = (await readState(page)).coins;
      expect(startCoins).toBeGreaterThanOrEqual(18);

      // Walk south around the fountain, then north to the Grocery Market (655, 345).
      await walk(page, "y", 860);
      await walk(page, "x", 560);
      await walk(page, "y", 380);
      await walk(page, "x", 655);
      await press(page, "ArrowUp");
      await expect(page.locator(".sticker-prompt")).toContainText("TALK");

      // Talk to Grocer and buy Fish Cracker (8 coins, choice index 1).
      await press(page, "z");
      await finishDialogue(page, 1);
      expect((await readState(page)).coins).toBe(startCoins - 8);
      expect((await readState(page)).treats).toEqual({ "fish-cracker": 1 });

      // Walk around to the Ice Cream Shop (895, 340).
      await walk(page, "x", 560);
      await walk(page, "y", 860);
      await walk(page, "x", 1180);
      await walk(page, "y", 435);
      await walk(page, "x", 920);
      await walk(page, "y", 375);
      await walk(page, "x", 895);
      await press(page, "ArrowUp");
      await expect(page.locator(".sticker-prompt")).toContainText("TALK");

      // Talk to Scoops and buy Berry Swirl Cone (10 coins, choice index 0).
      await press(page, "z");
      await finishDialogue(page, 0);
      expect((await readState(page)).coins).toBe(startCoins - 18);
      expect((await readState(page)).treats).toEqual({
        "fish-cracker": 1,
        "berry-cone": 1,
      });

      // Open Journal -> verify backpack treats strip & inspect Fountain Frog Field Note Card.
      await press(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();
      const treatsStrip = page.locator(".journal-treats-strip");
      await expect(treatsStrip).toBeVisible();
      await expect(treatsStrip).toContainText("Fish Cracker ×1");
      await expect(treatsStrip).toContainText("Berry Swirl Cone ×1");

      const frogSlot = page.locator(
        '.journal-stickers:not(.journal-prizes) .journal-slot[aria-label="Inspect Fountain Frog"]',
      );
      await expect(frogSlot).toBeVisible();
      await frogSlot.click();

      const fieldNote = page.locator(".journal-field-note");
      await expect(fieldNote).toBeVisible();
      await expect(fieldNote.locator(".journal-field-name")).toHaveText("Fountain Frog");
      await expect(fieldNote.locator(".journal-field-sub")).toHaveText("Lv 2 · Fizzy Frog");
      await expect(fieldNote.locator(".journal-field-lands")).toContainText("Cloverhollow");
      await expect(fieldNote.locator(".journal-field-feelings")).toContainText("Bored");
      await expect(fieldNote.locator(".journal-field-feelings")).toContainText("Curious");
      await expect(fieldNote.locator(".journal-field-feelings")).toContainText("Zoomy");
      await expect(fieldNote.locator(".journal-field-love-pill")).toHaveCount(3);
      await expect(fieldNote.locator(".journal-field-loves")).toContainText("Fish Cracker");
      await expect(fieldNote.locator(".journal-field-loves")).toContainText("Berry Swirl Cone");
      await expect(fieldNote.locator(".journal-field-loves")).toContainText("Sea-Salt Taffy");

      // Verify Field Note Card stays inside .journal-book with >= 44px close button.
      for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
        await page.setViewportSize(size);
        await step(page, 1);
        const geom = await page.evaluate(() => {
          const book = document.querySelector(".journal-book")?.getBoundingClientRect();
          const card = document.querySelector<HTMLElement>(".journal-field-note");
          const close = document.querySelector(".journal-field-close")?.getBoundingClientRect();
          if (!book || !card || !close) return null;
          const rect = card.getBoundingClientRect();
          return {
            inside: rect.left >= book.left && rect.right <= book.right &&
              rect.top >= book.top && rect.bottom <= book.bottom,
            noScroll: card.scrollHeight <= card.clientHeight + 1,
            closeSize: Math.min(close.width, close.height),
          };
        });
        expect(geom, `${size.width}x${size.height} field note geometry`).toEqual({
          inside: true,
          noScroll: true,
          closeSize: 44,
        });
        await captureReview(page, testInfo, `treats-journal-field-note-${size.width}`);
      }
      await page.setViewportSize({ width: 1280, height: 720 });

      // Escape dismisses ONLY the Field Note Card; Journal stays open until J.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(fieldNote).toBeHidden();
      await expect(page.locator(".journal-book")).toBeVisible();
      await press(page, "j");
      await expect(page.locator(".journal-book")).toBeHidden();

      // Walk left into the wild Sneaky Raccoon to enter a real battle!
      await walk(page, "x", 760);
      if ((await readBattle(page)) === null) await walk(page, "y", 395);
      await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
      expect((await readBattle(page))?.critterId).toBe("raccoon");

      // Advance intro (and any opening burst) to the command menu.
      for (let action = 0; action < 40; action += 1) {
        const battle = await readBattle(page);
        if (battle === null) throw new Error("battle ended unexpectedly");
        if (battle.phase === "command" && battle.revealed >= battle.message.length) break;
        if (battle.phase === "check" && battle.check !== null) await playBattleCheck(page);
        else await press(page, "z");
      }

      const snackBtn = page.locator(".battle-command", { hasText: "Snack" });
      await expect(snackBtn.locator(".battle-command-detail")).toHaveText("×4");
      await snackBtn.click();
      await step(page, 2);

      const tray = page.locator(".battle-treat-tray");
      await expect(tray).toBeVisible();
      const fishItem = tray.locator('.battle-treat-item[data-treat="fish-cracker"]');
      await expect(fishItem).toBeVisible();
      await expect(fishItem.locator(".battle-treat-fav")).toBeVisible();
      await expect(fishItem.locator(".battle-treat-fav")).toHaveText("Fav!");
      const coneItem = tray.locator('.battle-treat-item[data-treat="berry-cone"]');
      await expect(coneItem.locator(".battle-treat-fav")).toBeHidden();

      // Check Treat Tray geometry on desktop & phone (no HUD/dialogue overlap, >= 44px targets).
      for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
        await page.setViewportSize(size);
        await step(page, 1);
        const geom = await page.evaluate(() => {
          const trayNode = document.querySelector(".battle-treat-tray")?.getBoundingClientRect();
          const items = [...document.querySelectorAll(".battle-treat-item")]
            .map((node) => node.getBoundingClientRect());
          const hud = [...document.querySelectorAll(".battle-meter")]
            .map((node) => node.getBoundingClientRect());
          const dialogue = document.querySelector(".sticker-dialogue")?.getBoundingClientRect();
          if (!trayNode || !dialogue) return null;
          const overlaps = (a: DOMRect, b: DOMRect): boolean =>
            a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          return {
            touchSized: items.length === 4 && items.every((rect) => rect.height >= 44),
            clearOfHud: hud.every((meter) => !overlaps(trayNode, meter)),
            clearOfDialogue: !overlaps(trayNode, dialogue),
            onScreen: trayNode.left >= 0 && trayNode.right <= window.innerWidth &&
              trayNode.top >= 0 && trayNode.bottom <= window.innerHeight,
          };
        });
        expect(geom, `${size.width}x${size.height} treat tray geometry`).toEqual({
          touchSized: true,
          clearOfHud: true,
          clearOfDialogue: true,
          onScreen: true,
        });
        await captureReview(page, testInfo, `treats-battle-tray-${size.width}`);
      }
      await page.setViewportSize({ width: 1280, height: 720 });

      // Give Fish Cracker to the Sneaky Raccoon -> big calm jump & favourite message!
      const calmBefore = (await readBattle(page))?.calm ?? 0;
      await fishItem.click();
      await step(page, 2);
      const afterTreat = await readBattle(page);
      expect(afterTreat?.phase).toBe("result");
      expect((afterTreat?.calm ?? 0) - calmBefore).toBeGreaterThanOrEqual(45);
      expect(afterTreat?.message).toContain("Fish Crackers! Their favourite!");
      expect((await readState(page)).treats).toEqual({ "berry-cone": 1 });
    },
  );
});
