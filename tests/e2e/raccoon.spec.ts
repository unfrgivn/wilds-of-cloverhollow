import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseScript } from "../../src/content/script";
import {
  longFlowTimeout,
  openHarness,
  queueScript,
  readBattle,
  readState,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

// Milestone 15 contract, a battle since Milestone 28: the school raccoon. It
// isn't in the plaza until Fae has the hall pass (Ink `raccoon_waiting`, set
// by Nurse Holly). Earning it (the hall-pass sim's real input frames,
// replayed) brings her out to the school path (290, 930) with a fizzy raccoon
// waiting up the cobbles at (400, 860). Walking into it starts a battle;
// calmed, it says what it overheard (a kid in a purple hood whispering the
// tree house's password) and scampers off for good. The journal remembers the
// password.

test.describe.configure({ timeout: longFlowTimeout });

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function press(page: Page, key = "z"): Promise<void> {
  await page.keyboard.press(key);
  await step(page, 2);
}

const text = (page: Page) => page.locator(".sticker-text-revealed");
const critters = async (page: Page): Promise<string[]> =>
  (await renderInfo(page)).critters.map((critter) => critter.id);

// The same moment on a desktop, then on a phone.
async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("after the hall pass a fizzy raccoon waits; calmed, it tells the password", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "plaza");
  expect(await critters(page), "not before the pass").not.toContain("school-raccoon");

  await resetPaused(page, "school");
  const path = "tests/sim/scripts/school/hall-pass.json";
  const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
  await queueScript(page, script);
  await step(page, script.reduce((total, segment) => total + segment.ticks, 0));
  expect((await readState(page)).player).toEqual({ x: 290, y: 930 });
  expect((await renderInfo(page)).critters).toContainEqual(
    { id: "school-raccoon", kind: "school-raccoon", frame: "chaos_idle_01", x: 400, y: 860 });
  await expect(page).toHaveScreenshot("raccoon-waiting.png");

  // Real keys: right until under it, then up into it.
  await hold(page, "ArrowRight", 27);
  await hold(page, "ArrowUp", 4);
  await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
  expect(await readBattle(page)).toMatchObject({ critterId: "school-raccoon", den: null });
  await step(page, 90);
  await expect(text(page)).toHaveText(
    "A fizzy raccoon pops out by the school path, chattering at Fae!");
  await shoot(page, "raccoon-battle");

  // Soothe every turn, each press on its target tick.
  let rewardShot = false;
  for (let action = 0; action < 150; action += 1) {
    const battle = await readBattle(page);
    if (battle === null) break;
    if (battle.phase === "reward" && battle.revealed >= battle.message.length && !rewardShot) {
      rewardShot = true;
      await expect(page.locator(".battle-reward-name")).toHaveText("Ringtail Raccoon");
      await shoot(page, "raccoon-reward");
    }
    if (battle.phase === "aim" && battle.aim !== null)
      await step(page, battle.aim.targetTick - battle.aimTick - 1);
    await page.keyboard.down("Enter");
    await step(page, 1);
    await page.keyboard.up("Enter");
    await step(page, 1);
  }
  expect(rewardShot).toBe(true);
  let state = await readState(page);
  expect(state.critters["school-raccoon"]).toBe("calm");
  expect(state.stickers).toEqual(["ringtail-raccoon"]);
  expect(state.coins).toBe(8);

  // A step closer, and it's someone to talk to.
  await hold(page, "ArrowUp", 3);
  await expect(page.locator(".sticker-prompt span")).toHaveText("TALK");
  await press(page);
  await expect(page.locator(".sticker-speaker")).toHaveText("RINGTAIL RACCOON",
    { useInnerText: true });
  const lines: string[] = [];
  for (let count = 0; count < 40 && (await readState(page)).dialogue !== null; count += 1) {
    const dialogue = (await readState(page)).dialogue;
    if (dialogue !== null && dialogue.revealed >= dialogue.text.length &&
      lines.at(-1) !== dialogue.text) lines.push(dialogue.text);
    await press(page);
  }
  expect(lines).toEqual([
    "Chitter-chitter! Thanks, Fae. My head feels all clear now.",
    "A kid in a purple hood gave me a fizzy cracker. Then I couldn't stop chattering!",
    "I heard that kid whisper a secret word at the tree house in the park: \"Fizzlesticks!\"",
    "A secret password for a tree house club? I have to see this!",
    "The raccoon waves its striped tail and scampers off.",
  ]);
  await expect(page.locator(".sticker-dialogue")).toBeHidden();
  expect(await critters(page), "gone for good").not.toContain("school-raccoon");
  state = await readState(page);
  expect(state.dialogue).toBeNull();

  await press(page, "j");
  await expect(page.locator(".journal-note").first()).toHaveText(
    "The hooded kid's club password is \"Fizzlesticks\". " +
    "A club... like the tree house in the park?");
});
