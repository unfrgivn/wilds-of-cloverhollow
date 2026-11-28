import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  queueScript,
  readBattle,
  readState,
  recording,
  renderInfo,
  resetPaused,
  step,
  walk,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

declare global {
  interface Window {
    __m135PadState?: { buttons: boolean[]; axes: number[] };
  }
}

async function installGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { buttons: Array.from({ length: 16 }, () => false), axes: [0, 0, 0, 0] };
    Object.defineProperty(window, "__m135PadState", { value: state });
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [
        {
          mapping: "standard",
          buttons: state.buttons.map((pressed) => ({ pressed, value: pressed ? 1 : 0 })),
          axes: state.axes,
        },
      ],
    });
  });
}

async function setPad(
  page: Page,
  options: { axes?: [number, number, number, number]; buttons?: number[] },
): Promise<void> {
  await page.evaluate((next) => {
    const state = window.__m135PadState;
    if (state === undefined) throw new Error("gamepad unavailable");
    state.axes = next.axes ?? [0, 0, 0, 0];
    state.buttons.fill(false);
    for (const button of next.buttons ?? []) state.buttons[button] = true;
  }, options);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function press(page: Page, key = "z"): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
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

async function captureReview(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || testInfo.project.name !== "chromium") {
    return;
  }
  await page.screenshot({
    path: `art/review/${name}.jpg`,
    type: "jpeg",
    quality: 90,
  });
}

async function diffRegionPixels(
  page: Page,
  beforePng: Buffer,
  afterPng: Buffer,
  region: { x: number; y: number; width: number; height: number },
): Promise<number> {
  return page.evaluate(
    async ({ beforeB64, afterB64, rect }) => {
      const load = async (b64: string): Promise<ImageData> => {
        const image = new Image();
        image.src = `data:image/png;base64,${b64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        if (ctx === null) throw new Error("2d context unavailable");
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(rect.x, rect.y, rect.width, rect.height);
      };
      const a = await load(beforeB64);
      const b = await load(afterB64);
      let changed = 0;
      for (let i = 0; i < a.data.length; i += 4) {
        const delta =
          Math.abs((a.data[i] ?? 0) - (b.data[i] ?? 0)) +
          Math.abs((a.data[i + 1] ?? 0) - (b.data[i + 1] ?? 0)) +
          Math.abs((a.data[i + 2] ?? 0) - (b.data[i + 2] ?? 0));
        if (delta > 32) changed += 1;
      }
      return changed;
    },
    {
      beforeB64: beforePng.toString("base64"),
      afterB64: afterPng.toString("base64"),
      rect: region,
    },
  );
}

async function walkSafe(page: Page, axis: "x" | "y", target: number): Promise<void> {
  for (let tries = 0; tries < 5; tries += 1) {
    await walk(page, axis, target);
    if ((await readBattle(page)) === null) return;
    for (let stepIdx = 0; stepIdx < 40; stepIdx += 1) {
      const battle = await readBattle(page);
      if (battle === null) break;
      if (battle.phase === "check" && battle.check !== null) await playBattleCheck(page);
      else if (battle.phase === "command" && battle.revealed >= battle.message.length) {
        await press(page, "ArrowUp");
        await press(page, "z");
      } else await press(page, "z");
    }
  }
}

async function meetWildKind(page: Page, kind: string): Promise<void> {
  for (let tries = 0; tries < 6; tries += 1) {
    const battle = await readBattle(page);
    if (battle?.critterId === kind) return;
    if (battle !== null) {
      for (let stepIdx = 0; stepIdx < 40; stepIdx += 1) {
        const cur = await readBattle(page);
        if (cur === null) break;
        if (cur.phase === "check" && cur.check !== null) await playBattleCheck(page);
        else if (cur.phase === "command" && cur.revealed >= cur.message.length) {
          await press(page, "ArrowUp");
          await press(page, "z");
        } else await press(page, "z");
      }
    }
    const target = (await readState(page)).wild.find((c) => c.kind === kind && c.mood === "chaos");
    if (target === undefined) throw new Error(`no chaos ${kind} in plaza`);
    if (target.cooldownTicks > 0) await step(page, target.cooldownTicks + 2);
    if (tries % 2 === 0) {
      await walk(page, "y", target.y);
      if ((await readBattle(page))?.critterId === kind) return;
      await walk(page, "x", target.x);
    } else {
      await walk(page, "x", target.x);
      if ((await readBattle(page))?.critterId === kind) return;
      await walk(page, "y", target.y);
    }
  }
}

test(
  "favourite treat renders visible heart/sparkle sharing theater VFX on battle stage",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });
    await pickPaused(page, "Mr. Pip's arcade");

    // Walk out of the arcade into Cloverhollow Plaza.
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

    // Walk to Cloverhollow Grocery Market and buy Fish Cracker (Raccoon's favourite).
    await walkSafe(page, "y", 860);
    await walkSafe(page, "x", 560);
    await walkSafe(page, "y", 380);
    await walkSafe(page, "x", 655);
    await press(page, "ArrowUp");
    await press(page, "z");
    await finishDialogue(page, 1);
    expect((await readState(page)).treats).toEqual({ "fish-cracker": 1 });

    // Enter wild Sneaky Raccoon battle and advance to command phase.
    await walkSafe(page, "x", 560);
    await meetWildKind(page, "raccoon");
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
    expect((await readBattle(page))?.critterId).toBe("raccoon");

    for (let action = 0; action < 40; action += 1) {
      const battle = await readBattle(page);
      if (battle === null) throw new Error("battle ended unexpectedly");
      if (battle.phase === "command" && battle.revealed >= battle.message.length) break;
      if (battle.phase === "check" && battle.check !== null) await playBattleCheck(page);
      else await press(page, "z");
    }

    const layout = (await renderInfo(page)).battle.layout;
    if (layout === null) throw new Error("missing battle layout");
    const beforeShot = await page.screenshot();

    // Give Fish Cracker and step to peak mid-arc of the sharing theater VFX.
    await page.locator(".battle-command", { hasText: "Snack" }).click();
    await step(page, 2);
    const fishItem = page.locator('.battle-treat-item[data-treat="fish-cracker"]');
    await expect(fishItem).toBeVisible();
    await fishItem.click();
    await step(page, 12);

    const afterTreat = await readBattle(page);
    expect(afterTreat?.phase).toBe("result");
    expect(afterTreat?.lastGrade).toBeNull();
    expect(afterTreat?.message).toContain("Fish Crackers! Their favourite!");

    const afterShot = await page.screenshot();
    const arcLeft = Math.max(0, Math.round(layout.fae.x + 28));
    const arcRight = Math.min(1280, Math.round(layout.critter.x - 28));
    const arcTop = Math.max(0, Math.round(layout.critter.baseline - layout.critter.height - 90));
    const arcHeight = Math.min(720 - arcTop, 200);
    const changed = await diffRegionPixels(page, beforeShot, afterShot, {
      x: arcLeft,
      y: arcTop,
      width: Math.max(60, arcRight - arcLeft),
      height: Math.max(60, arcHeight),
    });
    expect(changed, "heart & sparkle arc pixels between Fae and Raccoon").toBeGreaterThan(250);

    await captureReview(page, testInfo, "m135-snack-treat-theater");
    expect(errors).toEqual([]);
  },
);

test(
  "HUD Photo/Guide pills and Boop-a-Mole middle cap adapt cleanly between keyboard and gamepad",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await installGamepad(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "plaza-party");

    await page.evaluate(() => window.__cloverhollow?.settings.setKeyHints(true));
    await step(page, 1);

    // Overworld HUD Photo pill: P -> View -> P.
    const photoKey = page.locator('.hud-hints [data-hint="photo"] .hud-hint-key');
    await expect(photoKey).toHaveText("P");
    await setPad(page, { axes: [0, 0, 0, 0.8] });
    await step(page, 1);
    await expect(photoKey).toHaveText("View");
    await setPad(page, {});
    await page.keyboard.press("Shift");
    await step(page, 1);
    await expect(photoKey).toHaveText("P");

    // Walk into Fountain Frog battle command phase -> Field Guide pill: I -> View -> I.
    for (const [key, ticks] of [
      ["ArrowDown", 25],
      ["ArrowLeft", 15],
      ["ArrowDown", 50],
      ["ArrowLeft", 35],
      ["ArrowUp", 38],
    ] as const) {
      await hold(page, key, ticks);
    }
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
    for (let count = 0; count < 50; count += 1) {
      const battle = await readBattle(page);
      if (battle?.phase === "command" && battle.revealed >= battle.message.length) break;
      await press(page, "Enter");
    }

    const guideKey = page.locator('.hud-battle-hint [data-hint="battle-guide"] .hud-hint-key');
    await expect(guideKey).toBeVisible();
    await expect(guideKey).toHaveText("I");
    await setPad(page, { axes: [0, 0, 0, 0.8] });
    await step(page, 1);
    await expect(guideKey).toHaveText("View");
    await setPad(page, {});
    await page.keyboard.press("Shift");
    await step(page, 1);
    await expect(guideKey).toHaveText("I");

    // Boop-a-Mole middle cap: Z -> A -> Z.
    await resetPaused(page, "arcade");
    for (const segment of recording("tests/sim/scripts/arcade/mole.json")) {
      await queueScript(page, [segment]);
      await step(page, segment.ticks);
      const arcade = (await readState(page)).arcade;
      if (arcade?.game === "mole") break;
    }
    await step(page, 1);
    for (let count = 0; count < 120; count += 1) {
      const arcade = (await readState(page)).arcade;
      if (arcade?.game === "mole" && arcade.phase === "playing") break;
      await step(page, 1);
    }

    const moleKeys = page.locator(".mole-key");
    await expect(moleKeys).toHaveText(["↑", "←", "Z", "→", "↓"]);
    await setPad(page, { axes: [0, 0, 0, 0.8] });
    await step(page, 1);
    await expect(moleKeys).toHaveText(["↑", "←", "A", "→", "↓"]);
    await setPad(page, {});
    await page.keyboard.press("Shift");
    await step(page, 1);
    await expect(moleKeys).toHaveText(["↑", "←", "Z", "→", "↓"]);

    expect(errors).toEqual([]);
  },
);
