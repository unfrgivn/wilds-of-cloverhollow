import { expect, test } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, readHash, readState,
  renderInfo, resetPaused, step, walk,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

test("real keys: Pinecone Pass north gap stays locked before lantern", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass");
  await walk(page, "x", 1210);
  await walk(page, "y", 720);
  await walk(page, "x", 1300);
  await walk(page, "y", 560);
  await walk(page, "x", 700);
  await walk(page, "y", 310);
  await walk(page, "x", 825);
  await walk(page, "y", 170);
  await step(page, 10);
  const state = await readState(page);
  expect(state.area).toBe("pass");
  expect(state.dialogue?.knot).toBe("cavern_dark");
  expect(state.dialogue?.text).toContain("snow-dusted archway");
});

test("real keys: Crystal Cavern full loop matches Bun hash at 1280x720 and 874x402", async ({
  page,
}) => {
  const path = "tests/sim/scripts/new-game/cavern.json";
  const expectedHash = bunHash(path, "new-game");
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "new-game");

  const checkBothViewports = async (): Promise<void> => {
    const desktop = await page.locator("canvas").boundingBox();
    expect(desktop?.width).toBeGreaterThan(900);
    expect(desktop?.height).toBeGreaterThan(600);
    await page.setViewportSize({ width: 874, height: 402 });
    const phone = await page.locator("canvas").boundingBox();
    expect(phone?.width).toBeGreaterThan(600);
    expect(phone?.height).toBeGreaterThan(350);
    await page.setViewportSize({ width: 1280, height: 720 });
  };

  let arrived = false;
  let batBattle = false;
  let lanternGlow = false;
  let stepsLit = false;
  let moleBattle = false;
  let chimeRung = false;
  let springFound = false;

  await playAfter(
    page,
    "tests/sim/scripts/new-game/golden-flute.json",
    path,
    async () => {
      const state = await readState(page);
      const info = await renderInfo(page);
      if (!arrived && state.area === "cavern" && state.transition === null) {
        const steps = info.props.find((item) => item.id === "crystal-steps");
        expect(steps).toBeDefined();
        expect(steps?.state).toBe("default");
        expect(steps?.hidden).toBe(true);
        await expect(page).toHaveScreenshot("cavern-arrival-1280.png");
        await checkBothViewports();
        await page.setViewportSize({ width: 874, height: 402 });
        await expect(page).toHaveScreenshot("cavern-arrival-874.png");
        await page.setViewportSize({ width: 1280, height: 720 });
        arrived = true;
      }
      if (!batBattle && state.battle?.critterId === "bat" && state.battle.phase === "command") {
        await expect(page.locator(".battle-calm .battle-meter-label")).toContainText(/Duzzy Bat/i);
        await expect(page).toHaveScreenshot("cavern-bat-battle-1280.png");
        batBattle = true;
      }
      if (!lanternGlow && state.area === "cavern" && info.lantern.on &&
          info.lantern.glows.length > 0) {
        await expect(page).toHaveScreenshot("cavern-lantern-1280.png");
        lanternGlow = true;
      }
      if (!stepsLit && state.area === "cavern" && state.dialogue === null && !info.lantern.on) {
        const steps = info.props.find((item) => item.id === "crystal-steps");
        if (steps !== undefined && steps.state === "lit" && !steps.hidden) {
          await expect(page).toHaveScreenshot("cavern-steps-lit-1280.png");
          await checkBothViewports();
          await page.setViewportSize({ width: 874, height: 402 });
          await expect(page).toHaveScreenshot("cavern-steps-lit-874.png");
          await page.setViewportSize({ width: 1280, height: 720 });
          stepsLit = true;
        }
      }
      if (!moleBattle && state.battle?.critterId === "crystal-mole" &&
          state.battle.phase === "command") {
        await expect(page.locator(".battle-calm .battle-meter-label"))
          .toContainText(/Glimmer Mole/i);
        await expect(page).toHaveScreenshot("cavern-mole-battle-1280.png");
        moleBattle = true;
      }
      if (!chimeRung && state.area === "cavern" && state.dialogue?.knot === "cavern_chime" &&
          state.dialogue.text.includes("shimmering star crystal")) {
        chimeRung = true;
      }
      if (!springFound && state.area === "cavern" && state.dialogue?.knot === "cavern_spring" &&
          state.dialogue.text.includes("crystal pouch")) {
        springFound = true;
      }
    },
  );

  expect({
    arrived, batBattle, lanternGlow, stepsLit, moleBattle, chimeRung, springFound,
  }).toEqual({
    arrived: true,
    batBattle: true,
    lanternGlow: true,
    stepsLit: true,
    moleBattle: true,
    chimeRung: true,
    springFound: true,
  });

  const end = await readState(page);
  expect(end.area).toBe("pass");
  expect(end.stickers).toEqual(expect.arrayContaining(["cozy-bat", "gem-mole"]));
  expect(await readHash(page)).toBe(await expectedHash);
});
