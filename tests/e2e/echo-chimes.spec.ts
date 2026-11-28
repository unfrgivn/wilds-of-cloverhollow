import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout, openHarness, playBattleCheck, readBattle, readState, renderInfo, step, walk,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function resetHills(page: Page, seed: number): Promise<void> {
  await page.evaluate(async (nextSeed) => {
    const hook = window.__cloverhollow;
    if (hook === undefined) throw new Error("hook unavailable");
    await hook.reset({ seed: nextSeed, fixture: "hills-calm" });
  }, seed);
}

async function enterLambBurst(page: Page, seed: number): Promise<void> {
  await resetHills(page, seed);
  for (let tries = 0; tries < 5 && (await readBattle(page)) === null; tries += 1) {
    const lamb = (await readState(page)).wild.find((critter) => critter.kind === "lamb");
    if (lamb === undefined) throw new Error("no lamb spawned in hills");
    await walk(page, "y", lamb.y);
    if ((await readBattle(page)) !== null) break;
    await walk(page, "x", lamb.x);
  }
  await expect.poll(async () => (await readBattle(page))?.critterId).toBe("lamb");
  for (let i = 0; i < 60; i += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "check" && battle.check?.side === "fae") return;
    if (battle?.phase === "check" && battle.check?.side === "critter") {
      await playBattleCheck(page);
      continue;
    }
    await page.keyboard.down("Enter");
    await step(page, 1);
    await page.keyboard.up("Enter");
    const afterPress = await readBattle(page);
    if (afterPress?.phase === "check" && afterPress.check?.side === "fae") return;
    await step(page, 1);
  }
  throw new Error("did not reach lamb burst check");
}

test("real keys: Echo Chimes burst against Bouncy Lamb plays chimes and achieves GREAT!", {
  tag: "@smoke",
}, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await enterLambBurst(page, 8);

  const startBattle = await readBattle(page);
  expect(startBattle?.check?.kind).toBe("echo");
  if (startBattle?.check?.kind !== "echo") return;
  const startEnergy = startBattle.energy;
  const sequence = startBattle.check.sequence;
  const info = await renderInfo(page);
  expect(info.battle.check?.kind).toBe("echo");

  const beforeSoundCount = await page.evaluate(
    () => window.__cloverhollow?.sound.log().length ?? 0,
  );
  await expect(page.locator(".battle-echo")).toBeVisible();
  await expect(page.locator(".battle-echo-phase")).toHaveText("LISTEN...");

  const { demoTicks, gapTicks, notes } = startBattle.check.spec;
  const demoEnd = notes * (demoTicks + gapTicks);
  await step(page, demoEnd + 1);

  const chimeNames: readonly string[] = [
    "chime-red", "chime-yellow", "chime-green", "chime-blue",
  ];
  const expectedChimes = sequence.map((note) => chimeNames[note]);
  const demoLog = await page.evaluate(
    (offset) => (window.__cloverhollow?.sound.log() ?? []).slice(offset).map((item) => item.cue),
    beforeSoundCount,
  );
  expect(demoLog.filter((cue) => cue.startsWith("chime-"))).toEqual(expectedChimes);

  await expect(page.locator(".battle-echo")).toHaveAttribute("data-phase", "input");
  await expect(page.locator(".battle-echo-phase")).toHaveText("YOUR TURN!");

  const keys: readonly string[] = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"];
  const beforeEchoCount = await page.evaluate(
    () => window.__cloverhollow?.sound.log().length ?? 0,
  );
  for (const note of sequence) {
    const key = keys[note];
    if (key === undefined) continue;
    await page.keyboard.down(key);
    await step(page, 1);
    await page.keyboard.up(key);
    const current = await readBattle(page);
    if (current?.phase !== "check") break;
    await step(page, 1);
  }

  const echoLog = await page.evaluate(
    (offset) => (window.__cloverhollow?.sound.log() ?? []).slice(offset).map((item) => item.cue),
    beforeEchoCount,
  );
  expect(echoLog.filter((cue) => cue.startsWith("chime-"))).toEqual(expectedChimes);

  const done = await readBattle(page);
  expect(done?.phase).toBe("burstResult");
  expect(done?.lastGrade).toBe("great");
  expect(done?.energy).toBe(startEnergy);
  await expect(page.locator(".battle-grade")).toHaveText("GREAT!");
});

test("touch chime stickers play Echo Chimes burst on phone", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 874, height: 402 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await enterLambBurst(page, 8);

  const startBattle = await readBattle(page);
  expect(startBattle?.check?.kind).toBe("echo");
  if (startBattle?.check?.kind !== "echo") return;
  const startEnergy = startBattle.energy;
  const sequence = startBattle.check.sequence;

  await expect(page.locator(".touch-stick")).toBeHidden();
  const { demoTicks, gapTicks, notes } = startBattle.check.spec;
  await step(page, notes * (demoTicks + gapTicks) + 1);
  await expect(page.locator(".battle-echo")).toHaveAttribute("data-phase", "input");

  for (const note of sequence) {
    const chime = page.locator(`.battle-echo-chime[data-note="${note}"]`);
    const box = await chime.boundingBox();
    if (box === null) throw new Error(`missing chime ${note}`);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await step(page, 1);
    const current = await readBattle(page);
    if (current?.phase !== "check") break;
    await step(page, 1);
  }

  const done = await readBattle(page);
  expect(done?.phase).toBe("burstResult");
  expect(done?.lastGrade).toBe("great");
  expect(done?.energy).toBe(startEnergy);
  await context.close();
});
