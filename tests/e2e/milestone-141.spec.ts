import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, readState, renderInfo, step } from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function loadAndOpenMicrowave(page: Page): Promise<number> {
  await page.goto("./?qa=kitchen");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.evaluate(() => window.__cloverhollow?.pause());
  await step(page, 1);

  // Walk to the clubhouse fridge/microwave at (585, 390) from (687, 493).
  await page.keyboard.down("ArrowLeft");
  await page.keyboard.down("ArrowUp");
  await step(page, 20);
  await page.keyboard.up("ArrowUp");
  await step(page, 10);
  await page.keyboard.up("ArrowLeft");
  await hold(page, "ArrowUp", 1);
  await step(page, 1);
  await expect(page.locator(".sticker-prompt")).toBeVisible();

  const beforeSnacks = (await readState(page)).snacks;
  for (let count = 0; count < 20; count += 1) {
    const current = await readState(page);
    if (current.arcade?.game === "cook") return beforeSnacks;
    await tapKey(page, "Enter");
  }
  throw new Error("Expected Clubhouse Microwave to open");
}

test(
  "Clubhouse Microwave exits ready on Escape/KeyX and live canvas recovers from WebGL context loss",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 720 });

    // Open free Clubhouse Microwave and exit ready cleanly via real Escape.
    const snacksBeforeEscape = await loadAndOpenMicrowave(page);
    const openedFirst = await readState(page);
    expect(openedFirst.arcade?.game).toBe("cook");
    expect(openedFirst.arcade?.phase).toBe("ready");
    await expect(page.locator("html")).toHaveAttribute("data-arcade", "open");
    await expect(page.locator("html")).toHaveAttribute("data-arcade-game", "cook");

    await tapKey(page, "Escape");
    const afterEscape = await readState(page);
    expect(afterEscape.arcade).toBeNull();
    expect(afterEscape.snacks).toBe(snacksBeforeEscape);
    await expect(page.locator("html")).not.toHaveAttribute("data-arcade", "open");

    // Re-open free Clubhouse Microwave and exit ready cleanly via real KeyX.
    const snacksBeforeKeyX = await loadAndOpenMicrowave(page);
    const openedSecond = await readState(page);
    expect(openedSecond.arcade?.game).toBe("cook");
    expect(openedSecond.arcade?.phase).toBe("ready");

    await tapKey(page, "KeyX");
    const afterKeyX = await readState(page);
    expect(afterKeyX.arcade).toBeNull();
    expect(afterKeyX.snacks).toBe(snacksBeforeKeyX);
    await expect(page.locator("html")).not.toHaveAttribute("data-arcade", "open");

    // Dispatch synthetic webglcontextlost -> webglcontextrestored on the live canvas.
    const lossResult = await page.evaluate(() => {
      const canvas = document.querySelector("#app canvas");
      if (canvas === null) throw new Error("Missing #app canvas");
      const lost = new Event("webglcontextlost", { cancelable: true });
      canvas.dispatchEvent(lost);
      const restored = new Event("webglcontextrestored");
      canvas.dispatchEvent(restored);
      return { defaultPrevented: lost.defaultPrevented };
    });
    expect(lossResult.defaultPrevented).toBe(true);

    // Step after restore (awaits serialized ensureArea) and verify Fae still moves cleanly.
    await step(page, 2);
    const infoAfterRestore = await renderInfo(page);
    expect(infoAfterRestore.area).toBe("clubhouse");

    const posBefore = (await readState(page)).player;
    await hold(page, "ArrowRight", 12);
    const posAfter = (await readState(page)).player;
    expect(posAfter.x).toBeGreaterThan(posBefore.x);

    expect(errors).toEqual([]);
  },
);
