import { execFile } from "node:child_process";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  openHarness,
  readHash,
  readState,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

type BunPlazaHoodOutput = {
  hash: string;
  tick: number;
  seen: boolean;
};

function isBunPlazaHoodOutput(value: unknown): value is BunPlazaHoodOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    "hash" in value &&
    typeof value.hash === "string" &&
    "tick" in value &&
    typeof value.tick === "number" &&
    "seen" in value &&
    typeof value.seen === "boolean"
  );
}

function runBunPlazaHoodSim(): Promise<BunPlazaHoodOutput> {
  return new Promise((resolve, reject) => {
    execFile(
      "bun",
      ["tools/sim/cutscene-plaza-hood.ts", "--json"],
      { encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error !== null) {
          reject(new Error(stderr || error.message));
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(stdout);
        } catch (err: unknown) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        if (!isBunPlazaHoodOutput(parsed)) {
          reject(new Error(`Unexpected sim output: ${stdout}`));
          return;
        }
        resolve(parsed);
      },
    );
  });
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

async function stepUntilCutsceneStep(
  page: Page,
  targetStepIndex: number,
  maxTicks = 400,
): Promise<void> {
  for (let i = 0; i < maxTicks; i += 1) {
    const state = await readState(page);
    if (state.cutscene === undefined) {
      throw new Error(`Cutscene ended before stepIndex ${targetStepIndex}`);
    }
    if (state.cutscene.stepIndex >= targetStepIndex) return;
    await step(page, 1);
  }
  throw new Error(`Cutscene did not reach stepIndex ${targetStepIndex}`);
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

async function stepUntilCutsceneEnds(page: Page, maxTicks = 500): Promise<void> {
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
  await page.screenshot({
    path: `art/review/${filename}`,
    type: "jpeg",
    quality: 90,
  });
}

test(
  "plaza-hood-sighting renders hooded-kid beat, matches Bun sim hash, and captures review shot",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "plaza");

    expect(await playCutscene(page, "plaza-hood-sighting")).toBe(true);

    // Step to stepIndex 2 (fountain confrontation: toss + purple-fizz + sparkle emote).
    await stepUntilCutsceneStep(page, 2);
    await step(page, 6);

    const datasetCutscene = await page.evaluate(
      () => document.documentElement.dataset.cutscene,
    );
    expect(datasetCutscene).toBe("open");

    const info = await renderInfo(page);
    expect(info.cutscene).not.toBeNull();
    expect(info.cutscene?.id).toBe("plaza-hood-sighting");
    expect(info.cutscene?.letterboxPx).toBe(24);
    expect(info.cutscene?.camera).not.toBeNull();
    expect(info.cutscene?.tempActors.some((actor) => actor.id === "hooded-kid")).toBe(true);
    expect(info.cutscene?.effects.some((effect) => effect.kind === "purple-fizz")).toBe(true);
    expect(info.cutscene?.emotes.some((emote) => emote.kind === "sparkle")).toBe(true);
    expect(info.drawOrder.some((item) => item.label === "cutscene:temp:hooded-kid")).toBe(true);

    await captureReviewShot(page, testInfo, "e4-plaza-hood-sighting.jpg");

    await stepUntilCutsceneEnds(page);
    const done = await readState(page);
    expect(done.cutscene).toBeUndefined();
    expect(done.cutscenesSeen).toContain("plaza-hood-sighting");
    const datasetAfter = await page.evaluate(
      () => document.documentElement.dataset.cutscene,
    );
    expect(datasetAfter).toBeUndefined();

    const bunSim = await runBunPlazaHoodSim();
    expect(bunSim.seen).toBe(true);
    expect(await readHash(page)).toBe(bunSim.hash);
    expect(done.tick).toBe(bunSim.tick);
    expect(errors).toEqual([]);
  },
);

test(
  "sue-bay-intro pauses for real-key Sue dialogue, resumes cutscene, and recruits Sue",
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "bay");

    expect(await playCutscene(page, "sue-bay-intro")).toBe(true);

    // Step to stepIndex 8 (Sue has run to Fae near the bay and both exchange wave/heart emotes).
    await stepUntilCutsceneStep(page, 8);
    await step(page, 6);

    const midInfo = await renderInfo(page);
    expect(midInfo.cutscene?.id).toBe("sue-bay-intro");
    expect(midInfo.cutscene?.letterboxPx).toBe(24);
    await captureReviewShot(page, testInfo, "e4-sue-bay-intro.jpg");

    // Advance into Sue's Ink knot (stepIndex 9).
    await stepUntilDialogueKnot(page, "sue");

    // Advance Sue's full Ink conversation using real keyboard presses (z, ArrowDown, z).
    let selectedSecondChoice = false;
    for (let guard = 0; guard < 40; guard += 1) {
      const state = await readState(page);
      const dialogue = state.dialogue;
      if (dialogue === null) break;
      if (dialogue.revealed < dialogue.text.length) {
        await tapKey(page, "z");
        continue;
      }
      if (dialogue.choices.length > 1 && !selectedSecondChoice) {
        await tapKey(page, "ArrowDown");
        selectedSecondChoice = true;
      }
      await tapKey(page, "z");
    }
    expect(selectedSecondChoice).toBe(true);

    // Immediately after dialogue closes, cutscene has resumed and Sue joined the party.
    const resumed = await readState(page);
    expect(resumed.dialogue).toBeNull();
    expect(resumed.cutscene?.id).toBe("sue-bay-intro");
    expect(resumed.cutscene?.dialogueWaiting).toBe(false);
    expect(resumed.party.some((member) => member.id === "sue")).toBe(true);

    await stepUntilCutsceneEnds(page);
    const done = await readState(page);
    expect(done.cutscene).toBeUndefined();
    expect(done.cutscenesSeen).toContain("sue-bay-intro");
    expect(done.party.some((member) => member.id === "sue")).toBe(true);
    expect(errors).toEqual([]);
  },
);

test(
  "dawn-wakeup snaps letterbox in Reduced Motion and skips cleanly on hold-cancel (x)",
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "new-game");

    await page.evaluate(() => {
      window.__cloverhollow?.settings.setReducedMotion(true);
    });
    expect(await playCutscene(page, "dawn-wakeup")).toBe(true);

    // Reduced Motion snaps cinema bars to 24px immediately on tick 1.
    await step(page, 1);
    const reducedInfo = await renderInfo(page);
    expect(reducedInfo.cutscene?.id).toBe("dawn-wakeup");
    expect(reducedInfo.cutscene?.letterboxPx).toBe(24);

    // Disable Reduced Motion and advance to stepIndex 2 once Maddie hops beside Fae.
    await page.evaluate(() => {
      window.__cloverhollow?.settings.setReducedMotion(false);
    });
    await stepUntilCutsceneStep(page, 2);
    await step(page, 6);

    const hopInfo = await renderInfo(page);
    expect(hopInfo.cutscene?.letterboxPx).toBe(24);
    expect(hopInfo.cutscene?.emotes.some((emote) => emote.kind === "heart")).toBe(true);
    await captureReviewShot(page, testInfo, "e4-dawn-wakeup.jpg");

    // Hold real 'x' key for 35 ticks to deterministically skip the cutscene to completion.
    await page.keyboard.down("x");
    await step(page, 35);
    await page.keyboard.up("x");

    const done = await readState(page);
    expect(done.cutscene).toBeUndefined();
    expect(done.cutscenesSeen).toContain("dawn-wakeup");
    expect(errors).toEqual([]);
  },
);

test(
  "jordan-pass-intro renders pinecone beat, plays Jordan Ink knot with real keys, recruits Jordan",
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "pass");

    expect(await playCutscene(page, "jordan-pass-intro")).toBe(true);

    // Step to stepIndex 5 (Jordan right near Fae with pinecone-burst + wave emote).
    await stepUntilCutsceneStep(page, 5);
    await step(page, 5);

    const midInfo = await renderInfo(page);
    expect(midInfo.cutscene?.id).toBe("jordan-pass-intro");
    expect(midInfo.cutscene?.letterboxPx).toBe(24);
    expect(
      midInfo.cutscene?.effects.some((effect) => effect.kind === "pinecone-burst"),
    ).toBe(true);
    await captureReviewShot(page, testInfo, "e4-jordan-pass-intro.jpg");

    // Step to Jordan's Ink conversation and finish with real 'z' presses.
    await stepUntilDialogueKnot(page, "jordan");
    for (let guard = 0; guard < 40; guard += 1) {
      const state = await readState(page);
      if (state.dialogue === null) break;
      await tapKey(page, "z");
    }

    const afterTalk = await readState(page);
    expect(afterTalk.dialogue).toBeNull();
    expect(afterTalk.party.some((member) => member.id === "jordan")).toBe(true);

    await stepUntilCutsceneEnds(page);
    const done = await readState(page);
    expect(done.cutscene).toBeUndefined();
    expect(done.cutscenesSeen).toContain("jordan-pass-intro");
    expect(done.party.some((member) => member.id === "jordan")).toBe(true);
    expect(errors).toEqual([]);
  },
);
