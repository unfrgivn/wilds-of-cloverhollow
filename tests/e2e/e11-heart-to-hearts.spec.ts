import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  openHarness,
  readState,
  renderInfo,
  resetPaused,
  step,
  walk,
} from "./helpers";

async function setInkFlags(
  page: Page,
  flags: Record<string, boolean | number | string>,
): Promise<void> {
  const backup = await page.evaluate((nextFlags) => {
    const isObj = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value);
    const raw = window.__cloverhollow?.save.exportBackup?.();
    if (raw === undefined) return null;
    const env: unknown = JSON.parse(raw);
    if (!isObj(env) || typeof env.save !== "string") return null;
    const payload: unknown = JSON.parse(env.save);
    if (!isObj(payload) || !isObj(payload.state)) return null;
    const st = payload.state;
    if (typeof st.ink !== "string") return null;
    const inkObj: unknown = JSON.parse(st.ink);
    if (!isObj(inkObj) || !isObj(inkObj.variablesState)) return null;
    for (const [key, value] of Object.entries(nextFlags)) {
      inkObj.variablesState[key] = value;
    }
    st.ink = JSON.stringify(inkObj);
    return JSON.stringify(payload);
  }, flags);
  expect(backup).not.toBeNull();
  const imported = await page.evaluate(async (saveJson) => {
    const hook = window.__cloverhollow;
    if (hook?.save.importBackup === undefined || saveJson === null) return false;
    return hook.save.importBackup(saveJson);
  }, backup);
  expect(imported).toBe(true);
  await step(page, 2);
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function captureReviewJpeg(page: Page, filename: string): Promise<void> {
  if (process.env.E11_CAPTURE_REVIEW !== "1") return;
  mkdirSync("art/review", { recursive: true });
  await page.screenshot({
    path: `art/review/${filename}`,
    type: "jpeg",
    quality: 90,
  });
}

async function readDialogueToEnd(
  page: Page,
  options?: {
    choiceMatch?: RegExp;
    captureWhen?: { match: RegExp; file: string };
  },
): Promise<{ lines: string[]; speakers: string[] }> {
  const lines: string[] = [];
  const speakers: string[] = [];
  let captured = false;
  for (let guard = 0; guard < 120; guard += 1) {
    const state = await readState(page);
    const dlg = state.dialogue;
    if (dlg === null) break;
    if (dlg.revealed < dlg.text.length) {
      await tapKey(page, "Enter");
      continue;
    }
    if (lines[lines.length - 1] !== dlg.text) {
      lines.push(dlg.text);
      if (dlg.speaker !== null) speakers.push(dlg.speaker);
    }
    if (
      !captured &&
      options?.captureWhen !== undefined &&
      options.captureWhen.match.test(dlg.text)
    ) {
      await captureReviewJpeg(page, options.captureWhen.file);
      captured = true;
    }
    if (dlg.choices.length > 0) {
      let desired = 0;
      if (options?.choiceMatch !== undefined) {
        const idx = dlg.choices.findIndex((text) => options.choiceMatch?.test(text));
        if (idx >= 0) desired = idx;
      }
      while ((await readState(page)).dialogue?.selected !== desired) {
        await tapKey(page, "ArrowDown");
      }
      await tapKey(page, "Enter");
      continue;
    }
    await tapKey(page, "Enter");
  }
  return { lines, speakers };
}

test.describe("Elevation Track E11: Party Heart-to-Hearts & Living NPC Quests", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "triggers Fae & Maddie Heart-to-Heart in bedroom with warm heart prompt and Journal note",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "new-game");
      await setInkFlags(page, { ate_breakfast: true });

      const before = await readState(page);
      expect(before.area).toBe("bedroom");

      // Walk Fae beside the bedroom Heart-to-Heart spot (645, 485) from the right and face left.
      await walk(page, "y", 485);
      await walk(page, "x", 700);
      await tapKey(page, "ArrowLeft");

      const prompt = page.locator(".sticker-prompt");
      await expect(prompt).toBeVisible();
      await expect(prompt).toHaveClass(/is-heart/);
      await expect(prompt).toHaveAttribute("data-tone", "heart");
      await expect(prompt).toContainText("HEART");
      await captureReviewJpeg(page, "e11-heart-prompt.jpg");

      // Trigger the Heart-to-Heart with a real Enter key press.
      await tapKey(page, "Enter");
      expect((await readState(page)).dialogue?.knot).toBe("h2h_fae_maddie");

      const talk = await readDialogueToEnd(page, {
        choiceMatch: /star cape/i,
        captureWhen: { match: /own special adventures/i, file: "e11-fae-maddie-h2h.jpg" },
      });
      const joined = talk.lines.join(" ");
      expect(joined).toContain("Baby Oliver");
      expect(joined).toContain("own special adventures");
      expect(joined).toContain("tiny kitten");
      expect(joined).toContain("star cape");
      expect(joined).not.toMatch(/\bMilo\b/i);
      expect(talk.speakers).toContain("Fae");
      expect(talk.speakers).toContain("Maddie");

      const after = await readState(page);
      expect(after.coins).toBe(before.coins + 10);
      expect(after.snacks).toBe(before.snacks + 2);

      // Open Journal with real J key and confirm the heartfelt memory appears.
      await tapKey(page, "j");
      await expect(
        page.locator(".journal-note").filter({ hasText: /Heart-to-Heart Memory:.*Oliver/ }),
      ).toBeVisible();
      await tapKey(page, "j");

      expect(errors).toEqual([]);
    },
  );

  test(
    "starts Grandpa Barnaby's Star Chart in cafe and reveals Plaza constellation with lantern",
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "cafe");
      await setInkFlags(page, { has_lantern: true });

      // Walk to Grandpa Barnaby (604, 700) inside Bon Appetit Cafe.
      await walk(page, "x", 604);
      await walk(page, "y", 650);
      await tapKey(page, "ArrowDown");

      const talkPrompt = page.locator(".sticker-prompt");
      await expect(talkPrompt).toBeVisible();
      await tapKey(page, "Enter");
      expect((await readState(page)).dialogue?.knot).toBe("barnaby");

      const barnabyTalk = await readDialogueToEnd(page, {
        choiceMatch: /Star Chart/i,
      });
      expect(barnabyTalk.lines.join(" ")).toContain("invisible glow-ink");
      expect(barnabyTalk.lines.join(" ")).not.toMatch(/\bMilo\b/i);

      // Walk out the cafe door (around 290, 490) onto Cloverhollow Plaza.
      await walk(page, "y", 538);
      await walk(page, "x", 320);
      await page.keyboard.down("ArrowUp");
      await page.keyboard.down("ArrowLeft");
      for (let tick = 0; tick < 80; tick += 1) {
        await step(page, 1);
        const st = await readState(page);
        if (st.transition !== null || st.area === "plaza") break;
      }
      await page.keyboard.up("ArrowUp");
      await page.keyboard.up("ArrowLeft");
      for (let tick = 0; tick < 80; tick += 1) {
        const st = await readState(page);
        if (st.area === "plaza" && st.transition === null) break;
        await step(page, 2);
      }
      expect((await readState(page)).area).toBe("plaza");

      // Walk down the open cobblestone avenue to the Plaza Star Chart spot (1380, 880).
      await walk(page, "y", 510);
      await walk(page, "x", 1170);
      await walk(page, "y", 880);
      await walk(page, "x", 1335);
      await tapKey(page, "ArrowRight");

      // Before lantern is switched on, the star-chart glow is invisible and untargetable.
      expect((await renderInfo(page)).lantern.on).toBe(false);
      await expect(page.locator(".sticker-prompt")).toBeHidden();

      await tapKey(page, "l");
      await step(page, 2);
      const litInfo = await renderInfo(page);
      expect(litInfo.lantern.on).toBe(true);
      expect(litInfo.lantern.glows).toContain("star-chart-plaza");
      await expect(page.locator(".sticker-prompt")).toBeVisible();

      // Inspect the revealed violet constellation with real Enter.
      await tapKey(page, "Enter");
      expect((await readState(page)).dialogue?.knot).toBe("star_chart_plaza_glow");

      const glowTalk = await readDialogueToEnd(page, {
        captureWhen: { match: /CLOVER DIPPER/i, file: "e11-barnaby-star-chart.jpg" },
      });
      expect(glowTalk.lines.join(" ")).toContain("THE CLOVER DIPPER");
      expect(glowTalk.lines.join(" ")).toContain("1 of 3 Star Chart");

      // Open Journal with real J key and confirm active Star Chart progress note.
      await tapKey(page, "j");
      await expect(
        page.locator(".journal-note").filter({ hasText: /Grandpa Barnaby's Star Chart \(1\/3\)/ }),
      ).toBeVisible();
      await tapKey(page, "j");

      expect(errors).toEqual([]);
    },
  );
});
