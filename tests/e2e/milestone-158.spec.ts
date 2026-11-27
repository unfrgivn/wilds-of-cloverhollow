import { expect, test, type Page } from "@playwright/test";
import { peekabooStatus, serializeSave, setInkVariables } from "../../src/core";
import {
  longFlowTimeout,
  openHarness,
  playBattleCheck,
  queueScript,
  readBattle,
  readState,
  recording,
  resetPaused,
  step,
  walk,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

const fluteScript = "tests/sim/scripts/new-game/golden-flute.json";
const fluteBattleMenuTick = 20438;
const bayPath = "tests/sim/scripts/bay/bay.json";
const bayLeanStartTick = 652;

async function replayTo(page: Page, path: string, targetTick: number): Promise<void> {
  const upTo: ReturnType<typeof recording> = [];
  let ticks = 0;
  for (const segment of recording(path)) {
    if (ticks >= targetTick) break;
    const take = Math.min(segment.ticks, targetTick - ticks);
    upTo.push({ frame: segment.frame, ticks: take });
    ticks += take;
  }
  await queueScript(page, upTo);
  await step(page, targetTick);
}

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function holdKey(page: Page, key: string, ticks: number): Promise<void> {
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

async function continueFromSave(page: Page, encodedSave: string): Promise<void> {
  await page.evaluate((encoded) => {
    localStorage.setItem("CapacitorStorage.cloverhollow-save", encoded);
  }, encodedSave);
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.__cloverhollow?.boot.title()))
    .toBeNull();
  await page.evaluate(() => window.__cloverhollow?.pause());
  await step(page, 2);
}

async function finishDialogue(page: Page): Promise<void> {
  for (let count = 0; count < 40; count += 1) {
    const dialogue = (await readState(page)).dialogue;
    if (dialogue === null) return;
    await tapKey(page, "Enter");
  }
  expect((await readState(page)).dialogue).toBeNull();
}

test(
  "real keys: Rainbow Lasso arc, Shape Trace watercolor brush, and Soothed confetti render cleanly",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);

    // 1. Rainbow Lasso arc (R key during battle command phase).
    await resetPaused(page, "new-game");
    await replayTo(page, fluteScript, fluteBattleMenuTick);
    expect((await readBattle(page))?.phase).toBe("command");
    await expect(page.locator(".battle-lasso-btn")).toBeVisible();

    await tapKey(page, "r");
    const launched = await readBattle(page);
    expect(launched?.phase).toBe("command");
    expect(launched?.lassoUsed).toBe(true);
    expect(launched?.lassoSteady).toBe(true);
    expect(launched?.message.toLowerCase()).toContain("lasso");

    const remaining = Math.max(0, 12 - (launched?.phaseTicks ?? 0));
    if (remaining > 0) await step(page, remaining);
    const peak = await readBattle(page);
    expect(peak?.phase).toBe("command");
    expect(peak?.phaseTicks).toBe(12);

    // 2. Soothed victory confetti shower on Fountain Frog (leaving reward intact).
    await resetPaused(page, "plaza");
    for (const [key, ticks] of [
      ["ArrowDown", 25],
      ["ArrowLeft", 15],
      ["ArrowDown", 50],
      ["ArrowLeft", 35],
    ] as const) {
      await holdKey(page, key, ticks);
    }
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");

    for (let action = 0; action < 100; action += 1) {
      const battle = await readBattle(page);
      if (battle === null) throw new Error("battle ended before soothed");
      if (battle.phase === "soothed") break;
      if (battle.phase === "check" && battle.check !== null) {
        await playBattleCheck(page);
        await step(page, 1);
        continue;
      }
      await tapKey(page, "Enter");
    }

    const enteredSoothed = await readBattle(page);
    expect(enteredSoothed?.phase).toBe("soothed");
    if (enteredSoothed !== null && enteredSoothed.revealed < enteredSoothed.message.length) {
      await tapKey(page, "Enter");
    }
    const afterReveal = await readBattle(page);
    expect(afterReveal?.phase).toBe("soothed");
    const toPeak = Math.max(0, 12 - (afterReveal?.phaseTicks ?? 0));
    if (toPeak > 0) await step(page, toPeak);
    expect((await readBattle(page))?.phase).toBe("soothed");

    await tapKey(page, "Enter");
    expect((await readBattle(page))?.phase).toBe("reward");
    await expect(page.locator(".battle-reward")).toBeVisible();

    // 3. Shape Trace watercolor brush choreography on Ms. Rowan (East Hall).
    await resetPaused(page, "east-hall");
    const baseState = await readState(page);
    const withRowan = serializeSave({
      ...baseState,
      ink: setInkVariables(baseState.ink, { art_teacher_out: true }),
    });
    await continueFromSave(page, withRowan);
    await walk(page, "x", 920);
    await walk(page, "y", 540);
    await walk(page, "x", 1020);
    await walk(page, "y", 500);
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");

    for (let guard = 0; guard < 80; guard += 1) {
      const battle = await readBattle(page);
      if (battle === null) throw new Error("battle ended before trace check");
      if (battle.phase === "check" && battle.check?.kind === "trace") break;
      if (battle.phase === "check" && battle.check !== null) {
        await playBattleCheck(page);
        await step(page, 1);
        continue;
      }
      await tapKey(page, "Enter");
    }

    const startTrace = await readBattle(page);
    expect(startTrace?.check?.kind).toBe("trace");
    await expect(page.locator(".battle-trace")).toBeVisible();
    const initialCheck = startTrace?.check;
    if (initialCheck?.kind !== "trace") throw new Error("expected trace check state");

    let heldX: string | null = null;
    let heldY: string | null = null;
    let paintedEnough = false;
    for (let active = initialCheck, ticks = 0; ticks < 160; ticks += 1) {
      if (active.checkpoint >= 4 && active.results.some((result) => result === "pending")) {
        paintedEnough = true;
        break;
      }
      if (!active.results.includes("pending")) break;
      const target = active.path.points[active.checkpoint];
      if (target === undefined) break;
      const dx = target.x - active.brush.x;
      const dy = target.y - active.brush.y;
      const near = Math.hypot(dx, dy) <= active.spec.reachRadius;
      const nextX = near || dx === 0 ? null : dx < 0 ? "ArrowLeft" : "ArrowRight";
      const nextY = near || dy === 0 ? null : dy < 0 ? "ArrowUp" : "ArrowDown";
      if (heldX !== nextX) {
        if (heldX !== null) await page.keyboard.up(heldX);
        if (nextX !== null) await page.keyboard.down(nextX);
        heldX = nextX;
      }
      if (heldY !== nextY) {
        if (heldY !== null) await page.keyboard.up(heldY);
        if (nextY !== null) await page.keyboard.down(nextY);
        heldY = nextY;
      }
      await step(page, 1);
      const current = (await readBattle(page))?.check;
      if (current?.kind !== "trace") break;
      active = current;
    }
    if (heldX !== null) await page.keyboard.up(heldX);
    if (heldY !== null) await page.keyboard.up(heldY);

    expect(paintedEnough).toBe(true);
    expect(errors).toEqual([]);
  },
);

test(
  "real keys: Echo Chimes, Wind-Gust Lean, and Starry Owl Peekaboo VFX render cleanly",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);

    // 4. Echo Chimes (Lamb in Clover Hills).
    await page.evaluate(async () => {
      const hook = window.__cloverhollow;
      if (hook === undefined) throw new Error("hook unavailable");
      await hook.reset({ seed: 8, fixture: "hills-calm" });
    });
    await walk(page, "x", 450);
    await walk(page, "y", 850);
    await expect.poll(async () => (await readBattle(page))?.critterId).toBe("lamb");
    for (let i = 0; i < 60; i += 1) {
      const battle = await readBattle(page);
      if (battle?.phase === "check" && battle.check?.kind === "echo") break;
      if (battle?.phase === "check" && battle.check?.side === "critter") {
        await playBattleCheck(page);
        continue;
      }
      await page.keyboard.down("Enter");
      await step(page, 1);
      await page.keyboard.up("Enter");
      const after = await readBattle(page);
      if (after?.phase === "check" && after.check?.kind === "echo") break;
      await step(page, 1);
    }
    await step(page, 8);
    const litDemo = await readBattle(page);
    expect(litDemo?.check?.kind).toBe("echo");
    if (litDemo?.check?.kind !== "echo") return;
    expect(litDemo.check.activeNote).not.toBeNull();
    await expect(page.locator(".battle-echo")).toBeVisible();

    const { demoTicks, gapTicks, notes } = litDemo.check.spec;
    const demoEnd = notes * (demoTicks + gapTicks);
    const remainingDemo = Math.max(0, demoEnd + 1 - litDemo.check.tick);
    if (remainingDemo > 0) await step(page, remainingDemo);
    await expect(page.locator(".battle-echo")).toHaveAttribute("data-phase", "input");
    const echoKeys: readonly string[] = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"];
    for (const note of litDemo.check.sequence) {
      const key = echoKeys[note];
      if (key === undefined) continue;
      await page.keyboard.down(key);
      await step(page, 1);
      await page.keyboard.up(key);
      const current = await readBattle(page);
      if (current?.phase !== "check") break;
      await step(page, 1);
    }
    expect((await readBattle(page))?.lastGrade).toBe("great");

    // 5. Wind-Gust Lean (Flappy Bluebird in Bubblegum Bay).
    await resetPaused(page, "bay");
    await replayTo(page, bayPath, bayLeanStartTick);
    expect((await readBattle(page))?.check?.kind).toBe("lean");
    await step(page, 62);
    await expect(page.locator(".battle-lean-puff").first()).toHaveClass(/is-blowing/);
    await expect(page.locator(".battle-lean-swoosh:visible")).toHaveCount(3);
    await playBattleCheck(page);
    expect((await readBattle(page))?.phase).toBe("burstResult");

    // 6. Starry Owl Peekaboo Freeze (Whispering Woods).
    await pickPaused(page, "The clubhouse fix-up");
    await walk(page, "x", 650);
    await walk(page, "y", 560);
    for (let i = 0; i < 60; i += 1) {
      const state = await readState(page);
      if (state.area === "woods" && state.transition === null) break;
      await step(page, 2);
    }
    expect((await readState(page)).area).toBe("woods");
    await walk(page, "y", 820);
    await walk(page, "x", 1400);
    await expect(page.locator(".sticker-prompt")).toBeVisible();
    await tapKey(page, "Enter");
    await finishDialogue(page);
    await walk(page, "x", 1470);
    await walk(page, "y", 680);
    await expect.poll(async () => (await readBattle(page))?.critterId).toBe("moon-owl");
    for (let i = 0; i < 60; i += 1) {
      const battle = await readBattle(page);
      if (battle?.phase === "check" && battle.check?.kind === "peekaboo") break;
      if (battle?.phase === "check" && battle.check?.side === "critter") {
        await playBattleCheck(page);
        continue;
      }
      await tapKey(page, "Enter");
    }

    await page.keyboard.down("Enter");
    await step(page, 14);
    await page.keyboard.up("Enter");
    const safeBattle = await readBattle(page);
    expect(safeBattle?.check?.kind).toBe("peekaboo");
    if (safeBattle?.check?.kind !== "peekaboo") return;
    expect(safeBattle.check.progress).toBeGreaterThan(0);
    expect(peekabooStatus(safeBattle.check)).toBe("safe");

    const firstPeek = safeBattle.check.spec.peeks[0];
    if (firstPeek === undefined) throw new Error("missing peek window");
    const toWarning = Math.max(
      1,
      firstPeek.start - safeBattle.check.spec.warningTicks + 4 - safeBattle.check.tick,
    );
    await step(page, toWarning);
    const warnCheck = (await readBattle(page))?.check;
    expect(warnCheck?.kind).toBe("peekaboo");
    if (warnCheck?.kind !== "peekaboo") return;
    expect(peekabooStatus(warnCheck)).toBe("warning");

    const toWatching = Math.max(1, firstPeek.start + 6 - warnCheck.tick);
    await step(page, toWatching);
    const watchCheck = (await readBattle(page))?.check;
    expect(watchCheck?.kind).toBe("peekaboo");
    if (watchCheck?.kind !== "peekaboo") return;
    expect(peekabooStatus(watchCheck)).toBe("watching");
    await expect(page.locator(".battle-peekaboo-badge")).toHaveAttribute(
      "data-status",
      "watching",
    );

    expect(errors).toEqual([]);
  },
);
