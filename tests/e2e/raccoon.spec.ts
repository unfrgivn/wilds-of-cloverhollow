import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseScript } from "../../src/content/script";
import {
  longFlowTimeout,
  openHarness,
  queueInput,
  readState,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

// Milestone 15 contract: the raccoon in the purple hood. He isn't in the plaza
// until Fae has the hall pass (Ink `raccoon_waiting`, set by Nurse Holly).
// Earning it (the hall-pass sim's real input frames, replayed) brings her out
// to the school path (290, 930) with him waiting up the cobbles at (400, 860).
// He talks, gives away his club's password, and vanishes in a puff of fizz:
// then he's gone for good (not drawn, not solid), and the journal remembers
// the password.

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
const people = async (page: Page): Promise<string[]> =>
  (await renderInfo(page)).npcs.map((npc) => npc.id);

test("after the hall pass the raccoon waits in the plaza, blabs, and vanishes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "plaza");
  expect(await people(page), "not before the pass").not.toContain("raccoon");

  await resetPaused(page, "school");
  const path = "tests/sim/scripts/school/hall-pass.json";
  const script = parseScript(JSON.parse(readFileSync(path, "utf8")), path);
  for (const segment of script) await queueInput(page, segment.frame, segment.ticks);
  await step(page, script.reduce((total, segment) => total + segment.ticks, 0));
  let state = await readState(page);
  expect(state.area).toBe("plaza");
  expect(state.player).toEqual({ x: 290, y: 930 });
  expect(await people(page)).toContain("raccoon");
  expect((await renderInfo(page)).drawOrder.map((item) => item.label)).toContain("npc:raccoon");
  await expect(page).toHaveScreenshot("raccoon-waiting.png");

  // Real keys: right until under him, then up into reach.
  await hold(page, "ArrowRight", 27);
  await hold(page, "ArrowUp", 4);
  state = await readState(page);
  expect(state.player).toEqual({ x: 398, y: 914 });
  await expect(page.locator(".sticker-prompt span")).toHaveText("TALK");
  await press(page);
  await expect(page.locator(".sticker-speaker")).toHaveText("RACCOON", { useInnerText: true });
  await press(page);
  await expect(text(page)).toHaveText(
    "Heh heh heh! So YOU'RE the one who keeps un-fizzing my critters!");
  expect((await renderInfo(page)).npcs.find((npc) => npc.id === "raccoon")?.facing).toBe("down");
  await press(page);
  await press(page);
  await expect(text(page)).toHaveText(
    "You'll never get into my secret club. Not without the password!");
  await expect(page.locator(".sticker-choice"))
    .toHaveText(["What's the password?", "Why are you making everything fizzy?"]);
  await press(page);
  await press(page);
  await expect(text(page)).toHaveText("Ha! As if I'd tell you it's \"Fizzlesticks\"! ...Oops.");
  expect(await people(page), "still here while he blabs").toContain("raccoon");
  await press(page);
  await press(page);
  await expect(text(page)).toHaveText("With a puff of purple fizz, the raccoon is gone!");
  expect(await people(page)).not.toContain("raccoon");
  expect((await renderInfo(page)).drawOrder.map((item) => item.label), "not drawn")
    .not.toContain("npc:raccoon");
  await press(page);
  await expect(page.locator(".sticker-dialogue")).toBeHidden();

  // Gone for good, and not solid: Fae walks up through where he stood.
  await hold(page, "ArrowUp", 20);
  expect((await readState(page)).player.y).toBeLessThan(850);
  expect(await people(page)).not.toContain("raccoon");

  await press(page, "j");
  await expect(page.locator(".journal-note").first()).toHaveText(
    "The raccoon's club password is \"Fizzlesticks\". A club... like the tree house in the park?");
});
