import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, resetPaused, step } from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 2);
}

async function runQaCommands(page: Page, commands: readonly string[]): Promise<void> {
  await page.keyboard.press("`");
  await expect(page.locator(".qa-console")).toBeVisible();
  for (const command of commands) {
    await page.keyboard.type(command);
    await page.keyboard.press("Enter");
  }
  await page.keyboard.press("Escape");
  await expect(page.locator(".qa-console")).toBeHidden();
  await step(page, 2);
}

async function unlockEncoreFlag(page: Page): Promise<void> {
  const ok = await page.evaluate(async () => {
    const isObj = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v);
    const raw = window.__cloverhollow?.save.exportBackup?.();
    if (raw === undefined) return false;
    const env: unknown = JSON.parse(raw);
    if (!isObj(env) || typeof env.save !== "string") return false;
    const payload: unknown = JSON.parse(env.save);
    if (!isObj(payload) || !isObj(payload.state)) return false;
    const st = payload.state;
    if (typeof st.ink !== "string") return false;
    const inkObj: unknown = JSON.parse(st.ink);
    if (!isObj(inkObj) || !isObj(inkObj.variablesState)) return false;
    inkObj.variablesState.milo_revealed = true;
    st.ink = JSON.stringify(inkObj);
    const res = await window.__cloverhollow?.save.importBackup?.(JSON.stringify(payload));
    return res === true;
  });
  expect(ok).toBe(true);
  await step(page, 2);
}

async function settleAnimations(page: Page, selector: string): Promise<void> {
  await page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (root === null) return;
    await Promise.all(
      root
        .getAnimations({ subtree: true })
        .filter((anim) => anim.effect?.getComputedTiming().iterations !== Infinity)
        .map((anim) => anim.finished.catch(() => undefined)),
    );
  }, selector);
}

async function openFieldTreasures(page: Page): Promise<void> {
  await tapKey(page, "j");
  await expect(page.locator(".journal-book")).toBeVisible();
  await page.locator(".journal-map-tab").click();
  await expect(page.locator(".journal-book")).toHaveAttribute("data-journal-page", "map");
  await page.locator(".journal-treasures-btn").click();
  await expect(page.locator(".journal-treasures-card")).toBeVisible();
  await settleAnimations(page, ".journal-treasures-backdrop");
}

test.describe("Milestone 241: Field Treasures & Soundtrack Album Touch Parity", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "enforces >= 44 px touch targets on all 6 Field Treasures launchers & Album toolbar at 874x402",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 874, height: 402 });
      await page.goto("./?touch=1");
      await page.waitForFunction(() => Boolean(window.__cloverhollow));
      await expect(page.locator("html")).toHaveAttribute("data-touch", "on");

      await resetPaused(page, "plaza");
      await unlockEncoreFlag(page);
      await runQaCommands(page, ["keepsakes on"]);
      await openFieldTreasures(page);

      const launcherMetrics = await page.evaluate(() => {
        const card = document.querySelector<HTMLElement>(".journal-treasures-card");
        if (card === null) return null;
        const cardRect = card.getBoundingClientRect();
        const selectors = [
          ".journal-ribbons-btn",
          ".journal-weather-btn",
          ".journal-hearts-btn",
          ".journal-encore-btn",
          ".journal-album-btn",
          ".journal-postcards-btn",
        ];
        const pills = selectors.map((sel) => {
          const el = card.querySelector<HTMLElement>(sel);
          const rect = el?.getBoundingClientRect();
          return {
            sel,
            visible: el !== null && !el.hidden && rect !== undefined && rect.width > 0,
            height: rect?.height ?? 0,
            horizontallyInside:
              rect !== undefined &&
              rect.left >= cardRect.left - 1 &&
              rect.right <= cardRect.right + 1,
          };
        });
        return {
          noHorizontalOverflow: card.scrollWidth <= card.clientWidth + 1,
          pills,
        };
      });

      expect(launcherMetrics).not.toBeNull();
      expect(launcherMetrics?.noHorizontalOverflow).toBe(true);
      expect(launcherMetrics?.pills).toHaveLength(6);
      for (const pill of launcherMetrics?.pills ?? []) {
        expect(pill.visible, `${pill.sel} visible`).toBe(true);
        expect(pill.height, `${pill.sel} height`).toBeGreaterThanOrEqual(44);
        expect(pill.horizontallyInside, `${pill.sel} horizontally inside`).toBe(true);
      }

      // Open Soundtrack Album and select a track so Area Theme reset button is visible too.
      await page.locator(".journal-album-btn").click();
      const albumCard = page.locator(".journal-jukebox-card");
      await expect(albumCard).toBeVisible();
      await settleAnimations(page, ".journal-jukebox-overlay");

      await albumCard.locator(".journal-album-track").nth(1).click();
      await expect(albumCard.locator(".journal-album-reset")).toBeVisible();

      const albumMetrics = await page.evaluate(() => {
        const card = document.querySelector<HTMLElement>(".journal-jukebox-card");
        if (card === null) return null;
        const cardRect = card.getBoundingClientRect();
        const selectors = [
          ".journal-album-filter",
          ".journal-album-shuffle",
          ".journal-album-home-btn",
          ".journal-album-reset",
        ];
        const controls = selectors.flatMap((sel) =>
          [...card.querySelectorAll<HTMLElement>(sel)]
            .filter((el) => !el.hidden)
            .map((el) => {
              const rect = el.getBoundingClientRect();
              return {
                sel,
                label: (el.textContent ?? "").trim(),
                height: rect.height,
                horizontallyInside:
                  rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1,
              };
            }),
        );
        return {
          noHorizontalOverflow: card.scrollWidth <= card.clientWidth + 1,
          controls,
        };
      });

      expect(albumMetrics).not.toBeNull();
      expect(albumMetrics?.noHorizontalOverflow).toBe(true);
      // 6 category filters + Shuffle + Home Record + Area Theme reset = 9 controls.
      expect(albumMetrics?.controls.length).toBeGreaterThanOrEqual(9);
      for (const control of albumMetrics?.controls ?? []) {
        expect(control.height, `${control.sel} (${control.label}) height`).toBeGreaterThanOrEqual(
          44,
        );
        expect(
          control.horizontallyInside,
          `${control.sel} (${control.label}) horizontally inside`,
        ).toBe(true);
      }

      expect(errors).toEqual([]);
    },
  );
});
