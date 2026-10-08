import { expect, test, type Page } from "@playwright/test";
import {
  longFlowTimeout, openHarness, readState, renderInfo, resetPaused, step, walk,
} from "./helpers";

// Milestone 14 contract: school day. The `school` fixture puts Fae just inside
// the school's front doors (600, 520) facing right. During class the doors need
// a hall pass (Ink `hall_pass`): without it they play `school_doors` and Fae
// stays in. Ms. Maple (the teacher) hints that Nurse Holly needs a helper;
// fibbing to the nurse gets a gentle no, offering to help gets the pass. With
// it, the doors lead to the plaza's school path (290, 930) facing up, and the
// path leads back in.

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
const speaker = (page: Page) => page.locator(".sticker-speaker");
const choices = (page: Page) => page.locator(".sticker-choice");

async function talkThrough(page: Page): Promise<void> {
  for (let count = 0; count < 12 && await page.locator(".sticker-dialogue").isVisible(); count += 1)
    await press(page);
  await expect(page.locator(".sticker-dialogue")).toBeHidden();
}

test("without a hall pass the front doors stay shut; Nurse Holly gives one for help", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "school");
  const info = await renderInfo(page);
  expect(info.area).toBe("school");
  expect(info.npcs.map((npc) => npc.id).sort()).toEqual(["nurse", "teacher"]);
  expect(info.drawOrder.map((item) => item.label))
    .toEqual(expect.arrayContaining(["npc:teacher", "npc:nurse", "maddie"]));
  await expect(page).toHaveScreenshot("school-arrival.png");

  // The doors: shut.
  await walk(page, "x", 500);
  await walk(page, "y", 600);
  let state = await readState(page);
  expect(state.area).toBe("school");
  expect(state.transition).toBeNull();
  expect(state.dialogue?.knot).toBe("school_doors");
  await step(page, 60);
  await expect(text(page)).toHaveText("The front doors stay shut during class.");
  await talkThrough(page);

  // Ms. Maple.
  await walk(page, "y", 520);
  await walk(page, "x", 640);
  await walk(page, "y", 460);
  await expect(page.locator(".sticker-prompt span")).toHaveText("TALK");
  await press(page);
  await expect(speaker(page)).toHaveText("MS. MAPLE", { useInnerText: true });
  await press(page);
  await expect(text(page)).toHaveText("Good morning, Fae! Class starts when the bell rings.");
  await expect(choices(page))
    .toHaveText(["Can I go outside for a bit?", "Good morning, Ms. Maple!"]);
  await press(page);
  await press(page);
  await expect(text(page)).toHaveText("Not without a hall pass, I'm afraid.");
  await press(page);
  await press(page);
  await expect(text(page)).toHaveText("Nurse Holly sometimes needs a helper...");
  await talkThrough(page);

  // Nurse Holly: a fib gets a gentle no, and she asks again next time.
  await walk(page, "y", 600);
  await walk(page, "x", 955);
  await walk(page, "y", 590);
  await press(page);
  await expect(speaker(page)).toHaveText("NURSE HOLLY", { useInnerText: true });
  await press(page);
  await expect(text(page)).toHaveText("Hi Fae! Is everything all right?");
  await expect(choices(page))
    .toHaveText(["My tummy hurts...", "I'm fine! Can I help with anything?"]);
  await press(page);
  await press(page);
  await expect(text(page)).toHaveText(
    "Hmm. Your tummy sounds happy to me. Fibbing isn't very kind, Fae.");
  await talkThrough(page);
  await press(page);
  await press(page);
  await expect(choices(page))
    .toHaveText(["My tummy hurts...", "I'm fine! Can I help with anything?"]);
  await press(page, "ArrowDown");
  await expect(page.locator(".sticker-choice[aria-selected='true']"))
    .toHaveText("I'm fine! Can I help with anything?");
  await press(page);
  await press(page);
  await expect(text(page)).toHaveText(
    "Oh, you're a star! Could you take this note to the front office?");
  await press(page);
  await press(page);
  await expect(text(page)).toHaveText("Here's a hall pass, so nobody stops you on the way.");
  await talkThrough(page);

  // With the pass: out to the plaza, and back in.
  await walk(page, "x", 400);
  await step(page, 40);
  state = await readState(page);
  expect(state.area).toBe("plaza");
  expect(state.player).toEqual({ x: 290, y: 930 });
  expect(state.facing).toBe("up");
  await hold(page, "ArrowDown", 30);
  await step(page, 40);
  state = await readState(page);
  expect(state.area).toBe("school");
  expect(state.player).toEqual({ x: 600, y: 520 });
  expect(state.facing).toBe("right");
});
