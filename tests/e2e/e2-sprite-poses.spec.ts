import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout,
  readHash,
  readState,
  renderInfo,
  resetPaused,
  step,
  walk,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function openQaPaused(page: Page, pack: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`./?qa=${pack}`);
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.evaluate(() => window.__cloverhollow?.pause());
  await step(page, 2);
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function captureReview(
  page: Page,
  projectName: string,
  filename: string,
): Promise<void> {
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS !== "1" || projectName !== "chromium") return;
  await page.screenshot({
    path: `art/review/${filename}`,
    type: "jpeg",
    quality: 90,
  });
}

test(
  "real keys: tool poses, #pose:cheer, resting sit, Maddie idle cycle, and Paper-Flip",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    // 1. Tool Pose: Blacklight Lantern toggle in Pinecone Pass (with Sue, Jordan, Maddie)
    await openQaPaused(page, "lantern");
    // Step clear of nearby NPC TALK prompts so the lantern prop is unobstructed.
    await page.keyboard.down("ArrowLeft");
    await step(page, 22);
    await page.keyboard.up("ArrowLeft");
    await step(page, 2);
    const beforeLantern = await renderInfo(page);
    expect(beforeLantern.area).toBe("pass");
    if (beforeLantern.lantern.on) {
      await tapKey(page, "l");
      await step(page, 2);
    }
    expect((await renderInfo(page)).lantern.on).toBe(false);

    await tapKey(page, "l");
    await step(page, 2);
    const withLantern = await renderInfo(page);
    expect(withLantern.lantern.on).toBe(true);
    expect(withLantern.animation).toBe("pose_tool_lantern");
    await captureReview(page, testInfo.project.name, "e2-gameplay-lantern.jpg");

    await tapKey(page, "l");
    await step(page, 2);
    const afterLantern = await renderInfo(page);
    expect(afterLantern.lantern.on).toBe(false);
    expect(afterLantern.animation.startsWith("idle_")).toBe(true);

    // 2. Tool Pose: Painted Flute play in Music Room
    await openQaPaused(page, "music");
    await tapKey(page, "f");
    await step(page, 4);
    const withFlute = await renderInfo(page);
    expect(withFlute.dialogue.open).toBe(true);
    expect(withFlute.animation).toBe("pose_tool_flute");

    // 3. Tool Pose: Rainbow Lasso micro-event in School Gym
    await openQaPaused(page, "gym");
    await step(page, 54);
    let sawLassoPose = false;
    for (let i = 0; i < 12; i += 1) {
      const info = await renderInfo(page);
      if (info.animation === "pose_tool_lasso") {
        sawLassoPose = true;
        break;
      }
      await step(page, 6);
    }
    expect(sawLassoPose).toBe(true);

    // 4. Maddie long-idle state machine (stretch -> groom -> nap) on open Plaza stone
    //    so her silhouette, Zzz emote, and ground shadow are 100% unobstructed.
    await resetPaused(page, "plaza");
    await walk(page, "y", 740);
    await walk(page, "x", 920);
    await step(page, 6);

    // Advance until Maddie crosses 120 stillTicks (stretch), 180 (groom), 240 (nap).
    const readMaddie = async (): Promise<{ stillTicks: number; animation: string }> => {
      const [state, info] = await Promise.all([readState(page), renderInfo(page)]);
      const member = state.party.find((item) => item.id === "maddie");
      const frame = info.party.find((item) => item.id === "maddie");
      return {
        stillTicks: member?.stillTicks ?? 0,
        animation: frame?.animation ?? "",
      };
    };

    let sawStretch = false;
    let sawGroom = false;
    let sawNap = false;
    for (let iter = 0; iter < 60; iter += 1) {
      const maddie = await readMaddie();
      if (
        maddie.stillTicks >= 120 &&
        maddie.stillTicks < 180 &&
        maddie.animation === "pose_stretch"
      ) {
        if (!sawStretch) {
          sawStretch = true;
          await captureReview(page, testInfo.project.name, "e2-gameplay-maddie-stretch.jpg");
        }
      }
      if (
        maddie.stillTicks >= 180 &&
        maddie.stillTicks < 240 &&
        maddie.animation === "pose_groom"
      ) {
        sawGroom = true;
      }
      if (maddie.stillTicks >= 240 && maddie.animation === "pose_nap") {
        sawNap = true;
        await captureReview(page, testInfo.project.name, "e2-gameplay-maddie-nap.jpg");
        break;
      }
      await step(page, 6);
    }
    expect({ sawStretch, sawGroom, sawNap }).toEqual({
      sawStretch: true,
      sawGroom: true,
      sawNap: true,
    });

    // Cozy Resting on the Clubhouse beanbag -> Fae, Sue, and Jordan switch to pose_sit
    await openQaPaused(page, "clubhouse");
    await walk(page, "y", 470);
    await walk(page, "x", 790);
    await step(page, 2);
    await tapKey(page, "z");
    await step(page, 24);
    const restingInfo = await renderInfo(page);
    expect(restingInfo.resting).toBe("clubhouse-beanbag");
    expect(restingInfo.animation).toBe("pose_sit");
    expect(restingInfo.party.find((item) => item.id === "sue")?.animation).toBe("pose_sit");
    expect(restingInfo.party.find((item) => item.id === "jordan")?.animation).toBe("pose_sit");
    await captureReview(page, testInfo.project.name, "e2-gameplay-resting-sit.jpg");

    // Moving stands Fae right back up
    await page.keyboard.down("ArrowLeft");
    await step(page, 2);
    await page.keyboard.up("ArrowLeft");
    await step(page, 2);
    expect((await renderInfo(page)).resting).toBeNull();

    // Pet Maddie in Plaza -> Fae and Maddie both switch to pose_cheer with zero core hash drift
    await resetPaused(page, "plaza");
    const plazaStart = await readState(page);
    const maddiePos = plazaStart.party.find((item) => item.id === "maddie");
    if (maddiePos === undefined) throw new Error("Expected Maddie in plaza party");
    const dx = maddiePos.x - plazaStart.player.x;
    const dy = maddiePos.y - plazaStart.player.y;
    const faceKey = Math.abs(dx) >= Math.abs(dy)
      ? (dx < 0 ? "ArrowLeft" : "ArrowRight")
      : (dy < 0 ? "ArrowUp" : "ArrowDown");
    await page.keyboard.down(faceKey);
    await step(page, 2);
    await page.keyboard.up(faceKey);
    await step(page, 1);
    await tapKey(page, "z");
    await step(page, 4);
    const petInfo = await renderInfo(page);
    expect(petInfo.petting).toBe("maddie");
    expect(petInfo.animation).toBe("pose_cheer");
    expect(petInfo.party.find((item) => item.id === "maddie")?.animation).toBe("pose_cheer");
    const petHash = await readHash(page);

    await resetPaused(page, "plaza");
    await page.keyboard.down(faceKey);
    await step(page, 2);
    await page.keyboard.up(faceKey);
    await step(page, 7);
    expect(await readHash(page)).toBe(petHash);

    // 5. Ink # pose: cheer dialogue tag reaction (live Pixi pose rendering)
    await openQaPaused(page, "music");
    // Step into the open center of the Music Room so all 4 cheering sprites clear the card.
    await page.keyboard.down("ArrowUp");
    await step(page, 28);
    await page.keyboard.up("ArrowUp");
    await page.keyboard.down("ArrowRight");
    await step(page, 18);
    await page.keyboard.up("ArrowRight");
    await step(page, 14);
    await tapKey(page, "f");
    await step(page, 30);
    await page.evaluate(() => window.__cloverhollow?.previewDialogueTags?.(["pose: party cheer"]));
    await step(page, 1);
    const cheerDialogueInfo = await renderInfo(page);
    expect(cheerDialogueInfo.dialogue.open).toBe(true);
    expect(cheerDialogueInfo.animation).toBe("pose_cheer");
    const partyAnim = (id: string): string | undefined =>
      cheerDialogueInfo.party.find((item) => item.id === id)?.animation;
    expect(partyAnim("sue")).toBe("pose_cheer");
    expect(partyAnim("jordan")).toBe("pose_cheer");
    expect(partyAnim("maddie")).toBe("pose_cheer");
    await captureReview(page, testInfo.project.name, "e2-gameplay-pose-cheer.jpg");

    // Closing dialogue clears preview tags and returns cleanly to idle
    for (let i = 0; i < 8; i += 1) {
      if (!(await renderInfo(page)).dialogue.open) break;
      await tapKey(page, "Enter");
      await step(page, 2);
    }
    expect((await renderInfo(page)).dialogue.open).toBe(false);
    expect((await renderInfo(page)).animation.startsWith("idle_")).toBe(true);

    // 6. Snappy Paper-Flip Horizontal Turns:
    //    (a) Disabled in paused harness snapshots (scaleX === 1)
    await openQaPaused(page, "clubhouse");
    await page.keyboard.down("ArrowLeft");
    await step(page, 4);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.down("ArrowRight");
    await step(page, 3);
    await page.keyboard.up("ArrowRight");
    expect((await renderInfo(page)).paperFlipScaleX).toBe(1);

    //    (b) Active in live running play (scaleX dips < 0.95 during flip, then settles to 1)
    await page.evaluate(() => {
      window.__cloverhollow?.settings.setReducedMotion(false);
      window.__cloverhollow?.resume();
    });
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(120);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.down("ArrowRight");
    const observedScales = await page.evaluate(async () => {
      const samples: number[] = [];
      for (let i = 0; i < 24; i += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const scale = window.__cloverhollow?.renderInfo().paperFlipScaleX ?? 1;
        samples.push(scale);
      }
      return samples;
    });
    await page.keyboard.up("ArrowRight");
    const minLiveScale = Math.min(...observedScales);
    expect(minLiveScale).toBeLessThan(0.95);
    expect(minLiveScale).toBeGreaterThanOrEqual(0.16);
    await expect
      .poll(async () => (await renderInfo(page)).paperFlipScaleX, { timeout: 2_000 })
      .toBe(1);

    //    (c) Strictly disabled under Reduced Motion even in live running play
    await page.evaluate(() => {
      window.__cloverhollow?.settings.setReducedMotion(true);
    });
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(120);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.down("ArrowRight");
    const reducedScales = await page.evaluate(async () => {
      const samples: number[] = [];
      for (let i = 0; i < 16; i += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const scale = window.__cloverhollow?.renderInfo().paperFlipScaleX ?? 1;
        samples.push(scale);
      }
      return samples;
    });
    await page.keyboard.up("ArrowRight");
    expect(reducedScales.every((scale) => scale === 1)).toBe(true);

    await page.evaluate(() => {
      window.__cloverhollow?.settings.setReducedMotion(false);
      window.__cloverhollow?.pause();
    });
    expect(errors).toEqual([]);
  },
);
