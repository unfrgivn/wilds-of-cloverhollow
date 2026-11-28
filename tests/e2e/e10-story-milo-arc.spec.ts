import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import type { State } from "../../src/core";
import { inkVariable } from "../../src/core/ink";
import { openHarness, readState, renderInfo, resetPaused, step } from "./helpers";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const rawStory: unknown = JSON.parse(readFileSync("public/assets/story/main.ink.json", "utf8"));
if (!isRecord(rawStory)) {
  throw new Error("Compiled story JSON must be an object");
}
const compiledStory = rawStory;

function readInkFlag(state: State, key: string): unknown {
  return inkVariable(compiledStory, state.ink, key);
}

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

async function playCutscene(page: Page, id: string): Promise<boolean> {
  return page.evaluate(async (cutsceneId) => {
    const fn = window.__cloverhollow?.cutscene?.play;
    if (fn === undefined) throw new Error("cutscene hook unavailable");
    return fn(cutsceneId);
  }, id);
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function stepUntilDialogueKnot(
  page: Page,
  knot: string,
  maxTicks = 400,
): Promise<void> {
  for (let i = 0; i < maxTicks; i += 1) {
    const state = await readState(page);
    if (state.dialogue?.knot === knot) return;
    if (state.cutscene === undefined) {
      throw new Error(`Cutscene ended before dialogue knot ${knot}`);
    }
    await step(page, 1);
  }
  throw new Error(`Cutscene did not open dialogue knot ${knot}`);
}

async function stepUntilCutsceneEnds(page: Page, maxTicks = 600): Promise<void> {
  for (let i = 0; i < maxTicks; i += 1) {
    const state = await readState(page);
    if (state.cutscene === undefined) return;
    await step(page, 1);
  }
  throw new Error("Cutscene did not finish within tick budget");
}

async function captureReviewShot(
  page: Page,
  testInfo: TestInfo,
  filename: string,
): Promise<void> {
  if (testInfo.project.name !== "chromium") return;
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((item) => item.effect?.getComputedTiming().iterations !== Infinity)
        .map((item) => item.finished.catch(() => undefined)),
    );
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });
  });
  mkdirSync("art/review", { recursive: true });
  await page.screenshot({
    path: `art/review/${filename}`,
    type: "jpeg",
    quality: 90,
  });
}

async function advanceUntilDialogueMatches(
  page: Page,
  predicate: (dialogue: NonNullable<State["dialogue"]>) => boolean,
  maxPresses = 30,
): Promise<NonNullable<State["dialogue"]>> {
  for (let guard = 0; guard < maxPresses; guard += 1) {
    const state = await readState(page);
    const dlg = state.dialogue;
    if (dlg === null) throw new Error("Dialogue closed before target line");
    if (dlg.revealed < dlg.text.length) {
      await tapKey(page, "z");
      continue;
    }
    if (predicate(dlg)) return dlg;
    await tapKey(page, "z");
  }
  throw new Error("Dialogue did not reach target line within press budget");
}

async function finishDialogueWithKeys(
  page: Page,
  pickSecondChoice = false,
): Promise<{ pickedSecond: boolean }> {
  let pickedSecond = false;
  for (let guard = 0; guard < 60; guard += 1) {
    const state = await readState(page);
    const dlg = state.dialogue;
    if (dlg === null) return { pickedSecond };
    if (dlg.revealed < dlg.text.length) {
      await tapKey(page, "z");
      continue;
    }
    if (pickSecondChoice && dlg.choices.length > 1 && !pickedSecond) {
      await tapKey(page, "ArrowDown");
      pickedSecond = true;
    }
    await tapKey(page, "z");
  }
  throw new Error("Dialogue did not finish within press budget");
}

test.describe("Elevation Track E10: Milo Foreshadowing Arc & Mini-Boss Vignettes", () => {
  test.describe.configure({ mode: "parallel" });
  test(
    "plays Milo foreshadowing beats 1 & 2 with real keys and logs non-spoiler Journal clues",
    { tag: "@smoke" },
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);

      // Beat 1: Classroom sketch cutscene + Milo expression portrait + choice navigation.
      await resetPaused(page, "classroom");
      expect(await playCutscene(page, "milo-school-sketch")).toBe(true);
      await stepUntilDialogueKnot(page, "milo_foreshadow_school");

      await advanceUntilDialogueMatches(
        page,
        (dlg) => dlg.speaker === "Milo" && dlg.choices.length > 1,
      );
      await expect(page.locator(".sticker-dialogue")).toBeVisible();
      await expect(page.locator(".sticker-portrait")).toBeVisible();
      await expect(page.locator(".sticker-speaker")).toHaveText("Milo");
      await captureReviewShot(page, testInfo, "e10-milo-school-sketch.jpg");

      const schoolResult = await finishDialogueWithKeys(page, true);
      expect(schoolResult.pickedSecond).toBe(true);
      await stepUntilCutsceneEnds(page);

      const afterSchool = await readState(page);
      expect(afterSchool.cutscene).toBeUndefined();
      expect(afterSchool.cutscenesSeen).toContain("milo-school-sketch");
      expect(readInkFlag(afterSchool, "milo_beat_school")).toBe(true);

      // Beat 2: Plaza stray raccoon cutscene with temp:milo actor onscreen.
      await resetPaused(page, "plaza");
      await setInkFlags(page, { milo_beat_school: true, milo_revealed: false });
      expect(await playCutscene(page, "milo-plaza-raccoon")).toBe(true);
      await stepUntilDialogueKnot(page, "milo_foreshadow_plaza");

      await advanceUntilDialogueMatches(page, (dlg) => dlg.speaker === "Milo");
      const plazaInfo = await renderInfo(page);
      expect(plazaInfo.cutscene?.id).toBe("milo-plaza-raccoon");
      expect(plazaInfo.cutscene?.tempActors.some((actor) => actor.id === "milo")).toBe(true);
      expect(
        plazaInfo.drawOrder.some((item) => item.label === "cutscene:temp:milo"),
      ).toBe(true);
      await expect(page.locator(".sticker-portrait")).toBeVisible();
      await expect(page.locator(".sticker-speaker")).toHaveText("Milo");
      await captureReviewShot(page, testInfo, "e10-milo-plaza-raccoon.jpg");

      const plazaResult = await finishDialogueWithKeys(page, true);
      expect(plazaResult.pickedSecond).toBe(true);
      await stepUntilCutsceneEnds(page);

      const afterPlaza = await readState(page);
      expect(afterPlaza.cutscene).toBeUndefined();
      expect(afterPlaza.cutscenesSeen).toContain("milo-plaza-raccoon");
      expect(readInkFlag(afterPlaza, "milo_beat_plaza")).toBe(true);
      expect(readInkFlag(afterPlaza, "milo_revealed")).toBe(false);

      // Open Fae's Journal with real 'j' key and confirm Quiet Clues omit Milo's name.
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeVisible();

      const quietClueNotes = page.locator(".journal-note").filter({ hasText: "Quiet Clue:" });
      await expect(quietClueNotes.first()).toBeVisible();
      const clueCount = await quietClueNotes.count();
      expect(clueCount).toBeGreaterThanOrEqual(2);

      const allNoteTexts = await page.locator(".journal-note").allTextContents();
      for (const noteText of allNoteTexts) {
        expect(noteText).not.toMatch(/\bMilo\b/i);
      }

      await captureReviewShot(page, testInfo, "e10-journal-clues.jpg");
      await tapKey(page, "j");
      await expect(page.locator(".journal-book")).toBeHidden();
      expect(errors).toEqual([]);
    },
  );

  test(
    "plays empathetic mini-boss stress vignettes for Ms. Rowan and Mrs. Flurry with real keys",
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);

      // Mini-boss vignette: Ms. Rowan in east-hall with Fizzy Ms. Rowan onscreen + {shake} text.
      await resetPaused(page, "east-hall");
      await setInkFlags(page, { art_teacher_out: true, art_open: false });

      const hallInfo = await renderInfo(page);
      expect(hallInfo.critters.some((critter) => critter.id === "art-teacher")).toBe(true);

      expect(await playCutscene(page, "miniboss-ms-rowan")).toBe(true);
      await stepUntilDialogueKnot(page, "vignette_ms_rowan");

      await advanceUntilDialogueMatches(
        page,
        (dlg) => dlg.speaker === "Ms. Rowan" && dlg.text.includes("{shake}"),
      );
      await expect(page.locator(".sticker-dialogue")).toBeVisible();
      await expect(page.locator(".sticker-portrait")).toBeVisible();
      await expect(page.locator(".sticker-speaker")).toHaveText("Ms. Rowan");
      expect(await page.locator(".sticker-text-revealed .rt-shake").count()).toBeGreaterThan(0);
      await captureReviewShot(page, testInfo, "e10-miniboss-ms-rowan.jpg");

      await finishDialogueWithKeys(page, false);
      await stepUntilCutsceneEnds(page);

      const afterRowan = await readState(page);
      expect(afterRowan.cutscene).toBeUndefined();
      expect(afterRowan.cutscenesSeen).toContain("miniboss-ms-rowan");
      expect(readInkFlag(afterRowan, "vignette_rowan_seen")).toBe(true);

      // Mini-boss vignette: Mrs. Flurry in Pinecone Pass with keeper_back active.
      await resetPaused(page, "pass");
      await setInkFlags(page, { keeper_back: true, lodge_open: false });

      const passInfo = await renderInfo(page);
      expect(passInfo.critters.some((critter) => critter.id === "lodge-keeper")).toBe(true);

      expect(await playCutscene(page, "miniboss-mrs-flurry")).toBe(true);
      await stepUntilDialogueKnot(page, "vignette_mrs_flurry");

      await finishDialogueWithKeys(page, false);
      await stepUntilCutsceneEnds(page);

      const afterFlurry = await readState(page);
      expect(afterFlurry.cutscene).toBeUndefined();
      expect(afterFlurry.cutscenesSeen).toContain("miniboss-mrs-flurry");
      expect(readInkFlag(afterFlurry, "vignette_flurry_seen")).toBe(true);
      expect(errors).toEqual([]);
    },
  );
});
