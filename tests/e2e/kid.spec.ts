import { expect, test, type Page } from "@playwright/test";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, queueScript, readBattle, readHash,
  readState, recording, renderInfo, resetPaused, step,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

const forest = "tests/sim/scripts/pass-party/forest.json";
const path = "tests/sim/scripts/pass-party/kid.json";

async function screenshots(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

// Replays the kid run as queued frames, one segment at a time from the forest
// run's end, and stops before the first segment once `ready` holds, so a test
// can take over at that moment with its own input.
async function replayUntil(page: Page, ready: () => Promise<boolean>): Promise<void> {
  const start = recording(forest);
  const all = recording(path);
  const head = all.slice(0, start.length - 1);
  await queueScript(page, head);
  await step(page, head.reduce((total, segment) => total + segment.ticks, 0));
  for (const segment of all.slice(start.length - 1)) {
    if (await ready()) return;
    await queueScript(page, [segment]);
    await step(page, segment.ticks);
  }
  throw new Error("the kid run ended before the moment it waited for");
}

// A notched phone with touch on, paused at the pass-party fixture.
async function phone(page: Page): Promise<void> {
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await page.evaluate(() => {
    for (const [side, size] of [["left", 59], ["right", 59], ["bottom", 21]] as const)
      document.documentElement.style.setProperty(`--safe-${side}`, `${size}px`);
  });
  await resetPaused(page, "pass-party");
}

test("real keys play the kid's Trace and Talk reveal", { tag: "@smoke" }, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  const shots = new Set<string>();
  const take = async (name: string): Promise<void> => {
    if (shots.has(name)) return;
    shots.add(name);
    await screenshots(page, name);
  };
  let opening = false;
  let menu = false;
  let trace = false;
  let talk = false;
  let reveal = false;
  let reward = false;
  let restored = false;
  await playAfter(page, forest, path, async () => {
    const state = await readState(page);
    const info = await renderInfo(page);
    const battle = info.battle;
    // The taunt opens the battle (the scene is still fading in: the recorded
    // player shows the whole line at once).
    if (!opening && state.battle?.critterId === "hooded-kid" &&
      state.battle.phase === "intro" && state.battle.revealed >= state.battle.message.length) {
      opening = true;
      expect(state.battle.message)
        .toBe("So you found my secret forest, Fae! Nobody can stop the BOSS!");
    }
    // The first menu, its line shown and the scene fully in: no Run.
    if (opening && !menu && state.battle?.phase === "command" &&
      state.battle.revealed >= state.battle.message.length) {
      menu = true;
      expect(state.battle.message).toBe("How can Fae calm the kid in the purple hood?");
      await expect(page.getByText("Run", { exact: true })).toHaveCount(0);
      await take("kid-opening");
    }
    // Mid-paint: two dots reached, more to go, and the overlay drawn over the
    // scene (the scribble, a dot per point, the brush).
    const check = state.battle?.check;
    if (!trace && check?.kind === "trace" && check.checkpoint >= 2 &&
      check.results.some((result) => result === "pending")) {
      trace = true;
      expect(battle?.check?.kind).toBe("trace");
      await expect(page.locator(".battle-trace")).toBeVisible();
      await expect(page.locator(".battle-trace-dot")).toHaveCount(check.path.points.length);
      await expect(page.locator(".battle-trace-brush")).toBeVisible();
      await take("kid-trace-mid");
    }
    if (!talk && state.battle?.talk !== null && state.battle?.talk !== undefined &&
      state.battle.talk.revealed >= state.battle.talk.text.length) {
      talk = true;
      expect(state.battle.talk.choices).toHaveLength(3);
      // The meters step aside while the answers are on screen (spec 8.1).
      await expect(page.locator(".battle-hud")).toBeHidden();
      await take("kid-talk");
    }
    if (!reveal && state.battle?.phase === "soothed" &&
      state.battle.revealed >= state.battle.message.length) {
      reveal = true;
      expect(state.battle.message).toContain("Milo");
      await take("kid-reveal");
    }
    if (!reward && state.battle?.phase === "reward") {
      reward = true;
      expect(state.battle.rewardSticker).toBe("hooded-kid");
    }
    if (!restored && state.battle === null && state.critters["hooded-kid"] === "calm") {
      restored = true;
      expect(info.props.filter((prop) => prop.state === "fizzy" && !prop.hidden)).toHaveLength(0);
      await take("kid-restored");
    }
  });
  expect({ opening, menu, trace, talk, reveal, reward, restored }).toEqual({
    opening: true, menu: true, trace: true, talk: true, reveal: true, reward: true,
    restored: true,
  });
  expect(await readHash(page)).toBe(bunHash(path, "pass-party"));
  // Milo's second talk ends on "Not yet": the dream goes on (the ending's run,
  // which starts with this one, takes the other answer).
  expect(await readState(page))
    .toMatchObject({ area: "enchanted", dialogue: null, finale: null });
  await expect(page.locator(".sticker-text-revealed")).toHaveText(
    "Not yet. We can stay here a little longer.");
});

test("a finger paints the kid's scribble back on a notched phone", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 874, height: 402 }, hasTouch: true,
  });
  const page = await context.newPage();
  await phone(page);
  // To the kid's first scribble, just as it starts; the finger takes over.
  await replayUntil(page, async () => (await readBattle(page))?.check?.kind === "trace");
  const shown = (await renderInfo(page)).battle.check;
  if (shown?.kind !== "trace") throw new Error("the kid's trace isn't in play");
  const { rect } = shown;
  const onScreen = (point: { x: number; y: number }): { x: number; y: number } => ({
    x: Math.round(rect.x + rect.width * point.x / 1000),
    y: Math.round(rect.y + rect.height * point.y / 1000),
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  const touch = async (type: "touchStart" | "touchMove",
    at: { x: number; y: number }): Promise<void> => {
    await cdp.send("Input.dispatchTouchEvent", {
      type, touchPoints: [{ ...at, id: 1, radiusX: 1, radiusY: 1, force: 1 }],
    });
  };
  const start = (await readBattle(page))?.check;
  if (start?.kind !== "trace") throw new Error("the kid's trace isn't in play");
  const first = start.path.points[0];
  if (first === undefined) throw new Error("the trace has no points");
  // A kid tracing dot to dot: the finger goes down on the first dot, then holds
  // each next dot until the brush reaches it. No keys, no mouse.
  await touch("touchStart", onScreen(first));
  await step(page, 1);
  let fingerSeen = false;
  let target = first;
  for (let tick = 0; tick < 180; tick += 1) {
    const state = await readState(page);
    const check = state.battle?.check;
    if (check?.kind !== "trace") throw new Error("the trace ended before it was painted");
    fingerSeen = fingerSeen || state.previousInput.pointer !== undefined;
    if (check.results.every((result) => result !== "pending")) break;
    const next = check.path.points[check.checkpoint];
    if (next === undefined) break;
    if (next !== target) {
      target = next;
      await touch("touchMove", onScreen(next));
    }
    await step(page, 1);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await step(page, 1);
  // The finger reached the core as the frame's pointer, and painted every dot.
  expect(fingerSeen).toBe(true);
  const painted = await readBattle(page);
  if (painted?.check?.kind !== "trace") throw new Error("the painted trace is gone");
  expect(painted.check.results.every((result) => result === "hit")).toBe(true);
  expect(painted.lastGrade).toBe("great");
  await context.close();
});

test("a tap picks the kid's Talk answer on a notched phone", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 874, height: 402 }, hasTouch: true,
  });
  const page = await context.newPage();
  await phone(page);
  // To the first question, its answers on screen.
  await replayUntil(page, async () => {
    const talk = (await readBattle(page))?.talk;
    return talk !== null && talk !== undefined && talk.choices.length === 3 &&
      talk.revealed >= talk.text.length;
  });
  await expect(page.locator(".battle-hud")).toBeHidden();
  // The second answer, the Star Racer token: partly right.
  await page.locator(".sticker-choice").nth(1).tap();
  await step(page, 2);
  const talk = (await readBattle(page))?.talk;
  expect(talk?.grade).toBe("good");
  expect(talk?.text).toBe("Maybe. Lots of kids play Star Racer.");
  await context.close();
});
