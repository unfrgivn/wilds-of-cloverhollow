import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout, openHarness, readBattle, readState, renderInfo, resetPaused, step, walk,
} from "./helpers";

// Milestone 22: at Pinecone Pass, Fae meets Jordan by the snowman. He joins
// whatever she answers and brings Juggle, so the hamster's battle menu has six
// commands. Calmed, the hamster gets Jordan to hand Fae his blacklight lantern.
// Real keys throughout (the recorded run is `pass-party/jordan.json`).

test.describe.configure({ timeout: longFlowTimeout });

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function press(page: Page): Promise<void> {
  await page.keyboard.press("z");
  await step(page, 2);
}

// Talks to whoever Fae faces through every line, taking the first answer.
async function talk(page: Page): Promise<string[]> {
  const lines: string[] = [];
  await press(page);
  for (let count = 0; count < 80; count += 1) {
    const dialogue = (await readState(page)).dialogue;
    if (dialogue === null) return lines;
    if (dialogue.revealed >= dialogue.text.length && lines.at(-1) !== dialogue.text)
      lines.push(dialogue.text);
    await press(page);
  }
  throw new Error("the talk never ended");
}

// Fights with real keys: Juggle first (down to it with the arrow keys), then
// Soothe while Jordan rests ("finding pinecones"), confirming as each ring
// closes. Returns Juggle's result lines.
async function fight(page: Page): Promise<string[]> {
  const results: string[] = [];
  let juggled = false;
  for (let count = 0; count < 300; count += 1) {
    const battle = await readBattle(page);
    if (battle === null) return results;
    if (battle.phase === "command" && battle.revealed >= battle.message.length) {
      const wanted = juggled ? 0 : 3;
      for (let move = 0; move < 6 && (await readBattle(page))?.selected !== wanted; move += 1) {
        const selected = (await readBattle(page))?.selected ?? 0;
        await hold(page, selected < wanted ? "ArrowDown" : "ArrowUp", 1);
        await step(page, 1);
      }
      expect((await readBattle(page))?.selected).toBe(wanted);
      await press(page);
      juggled = true;
      continue;
    }
    if (battle.phase === "aim" && battle.aim !== null) {
      const wait = battle.aim.targetTick - 1 - battle.aimTick;
      if (wait > 0) await step(page, wait);
      await press(page);
      continue;
    }
    if (battle.revealed >= battle.message.length && battle.message.includes("Jordan") &&
      results.at(-1) !== battle.message) results.push(battle.message);
    await press(page);
  }
  throw new Error("the battle never ended");
}

test("Fae meets Jordan, Juggle calms the hamster, and he gives her his lantern", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  expect((await renderInfo(page)).npcs.map((npc) => npc.id)).toContain("jordan");

  // From the bus stop (930, 1015): right past the stop's sign, up, and up to
  // Jordan by the snowman.
  await walk(page, "x", 1066);
  await walk(page, "y", 799);
  await walk(page, "x", 1100);
  await walk(page, "y", 745);
  const meeting = await talk(page);
  expect(meeting[0]).toBe("Whoa, watch out! That hamster's gone totally fizzy!");
  let state = await readState(page);
  expect(state.party.map((member) => member.id)).toEqual(["maddie", "sue", "jordan"]);
  let info = await renderInfo(page);
  expect(info.npcs.map((npc) => npc.id)).not.toContain("jordan");
  expect(info.party.map((member) => member.id)).toEqual(["maddie", "sue", "jordan"]);

  // The four of them step back toward the bus stop, out of the hamster's
  // sight (it comes after anyone within 180 units of it), and settle.
  await walk(page, "y", 820);
  await walk(page, "x", 1120);
  await step(page, 60);
  state = await readState(page);
  expect(state.battle, "nothing came after them").toBeNull();
  info = await renderInfo(page);
  expect(info.drawOrder.map((item) => item.label))
    .toEqual(expect.arrayContaining(["fae", "maddie", "sue", "jordan"]));
  await expect(page).toHaveScreenshot("pass-party-of-four.png");

  // Into the hamster's reach: the battle has six commands.
  await walk(page, "x", 850);
  await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
  expect((await readBattle(page))?.critterId).toBe("hamster");
  for (let count = 0; count < 20; count += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "command" && battle.revealed >= battle.message.length) break;
    await press(page);
  }
  await expect(page.locator(".battle-command-label"))
    .toHaveText(["Soothe", "Play", "Cast", "Juggle", "Snack", "Run"]);
  await expect(page).toHaveScreenshot("hamster-battle-1280.png");
  await page.setViewportSize({ width: 874, height: 402 });
  await step(page, 2);
  await expect(page.locator(".battle-command-label"))
    .toHaveText(["Soothe", "Play", "Cast", "Juggle", "Snack", "Run"]);
  await expect(page).toHaveScreenshot("hamster-battle-874.png");
  await page.setViewportSize({ width: 1280, height: 720 });
  await step(page, 2);

  const juggles = await fight(page);
  expect(juggles.length).toBeGreaterThan(0);
  state = await readState(page);
  expect(state.wild.find((critter) => critter.kind === "hamster")?.mood).toBe("calm");
  expect(state.stickers).toContain("hiker-hamster");

  // Up to the calm hamster, wherever it stood when they met: Fae walks toward
  // it until it's someone to talk to. It talks, and Jordan hands over the
  // lantern.
  const hamster = state.wild.find((critter) => critter.kind === "hamster");
  if (hamster === undefined) throw new Error("no hamster");
  const dx = hamster.x - state.player.x;
  const dy = hamster.y - state.player.y;
  const toward = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? "ArrowRight" : "ArrowLeft")
    : (dy > 0 ? "ArrowDown" : "ArrowUp");
  const prompt = page.locator(".sticker-prompt");
  for (let count = 0; count < 40 && !(await prompt.isVisible()); count += 1)
    await hold(page, toward, 1);
  await expect(prompt.locator("span")).toHaveText("TALK");
  const thanks = await talk(page);
  expect(thanks).toContain(
    "Jordan hands Fae his blacklight lantern: a big round purple lens on a rainbow handle.",
  );
});
