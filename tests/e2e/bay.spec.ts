import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseScript } from "../../src/content/script";
import {
  bunHash, longFlowTimeout, openHarness, playAfter, queueScript, readBattle, readHash, readState,
  renderInfo, resetPaused, step, walk,
} from "./helpers";

// Milestone 19 contract: Bubblegum Bay. The plaza's east road stays closed
// until the tree house club is open; then it leads to the bay (spawn
// `plaza-road`, (180, 545) facing right). Sue fishes at the dock's far end
// and joins whatever Fae answers. A fizzy bluebird is loose on the sand, and
// Sue's Cast is in its battle menu.

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

// Talks to whoever Fae faces, with real keys, through every line, taking the
// answer at `choice` (arrow keys, then confirm). Returns the lines shown.
async function talk(page: Page, choice: number): Promise<string[]> {
  const lines: string[] = [];
  await press(page);
  for (let count = 0; count < 80; count += 1) {
    const dialogue = (await readState(page)).dialogue;
    if (dialogue === null) return lines;
    if (dialogue.revealed < dialogue.text.length) {
      await press(page);
      continue;
    }
    if (lines.at(-1) !== dialogue.text) lines.push(dialogue.text);
    if (dialogue.choices.length > 0)
      for (let down = 0; down < choice; down += 1) {
        await hold(page, "ArrowDown", 1);
        await step(page, 1);
      }
    await press(page);
  }
  throw new Error("the talk never ended");
}

const text = (page: Page) => page.locator(".sticker-text-revealed");

test("the east road stays closed until the club is open", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "plaza");
  // From the fountain (1200, 550), right along the road to the plaza's edge.
  await walk(page, "x", 1620);
  const state = await readState(page);
  expect(state.area).toBe("plaza");
  expect(state.dialogue?.knot).toBe("bay_road_closed");
  await press(page);
  await expect(text(page)).toHaveText("The east road goes to Bubblegum Bay!");
});

test("after chapter one, real keys take Fae down the east road into the bay", async ({
  page,
}) => {
  // Chapter one's run, then the recorded walk on (tools/sim/record-east-road.ts:
  // out of the park, the plaza's critters calmed, down the east road) played
  // with real keys.
  const path = "tests/sim/scripts/new-game/east-road.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "new-game");
  const areas: string[] = [];
  await playAfter(page, "tests/sim/scripts/new-game/chapter-one.json", path, async () => {
    const area = (await readState(page)).area;
    if (areas.at(-1) !== area) areas.push(area);
  });
  expect(areas).toEqual(["park", "plaza", "bay"]);
  const state = await readState(page);
  expect(state.player).toEqual({ x: 180, y: 545 });
  expect(state.facing).toBe("right");
  expect(state.party.map((member) => member.id)).toEqual(["maddie"]);
  expect(await readHash(page)).toBe(bunHash(path, "new-game"));
});

test("the bay on arrival, at both sizes", async ({ page }) => {
  for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
    await page.setViewportSize(size);
    await openHarness(page);
    await resetPaused(page, "bay");
    await step(page, 60);
    const info = await renderInfo(page);
    expect(info.area).toBe("bay");
    expect(info.npcs.map((npc) => npc.id)).toContain("sue");
    await expect(page).toHaveScreenshot(`bay-arrival-${size.width}.png`);
  }
});

test("real keys: down the dock to Sue, she joins, and casts at the bluebird", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "bay");

  // Along the path to the dock's foot, up onto the planks, out to its end.
  await walk(page, "x", 900);
  await walk(page, "y", 300);
  await walk(page, "x", 1400);
  await walk(page, "y", 280);
  await expect(page.locator(".sticker-prompt span")).toHaveText("TALK");
  await step(page, 60);
  await expect(page).toHaveScreenshot("bay-sue-on-the-dock.png");

  const lines = await talk(page, 1);
  expect(lines[0]).toBe("Whoa, hi! Careful, these planks are a little wobbly.");
  expect(lines.at(-1)).toBe("Are you kidding? Of course! Let me grab my rod.");
  const joined = await readState(page);
  expect(joined.party.map((member) => member.id)).toEqual(["maddie", "sue"]);
  const info = await renderInfo(page);
  expect(info.npcs.map((npc) => npc.id), "her person is gone").not.toContain("sue");
  expect(info.party.map((member) => member.id)).toEqual(["maddie", "sue"]);

  // Back down the dock together.
  await walk(page, "x", 1150);
  await walk(page, "y", 420);
  await step(page, 120);
  const order = (await renderInfo(page)).drawOrder.map((item) => item.label);
  expect(order).toEqual(expect.arrayContaining(["fae", "maddie", "sue"]));
  await expect(page).toHaveScreenshot("bay-party-on-the-dock.png");

  // Off the dock and across the sand to the bluebird.
  await walk(page, "x", 900);
  await walk(page, "y", 760);
  await walk(page, "x", 1250);
  await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
  expect((await readBattle(page))?.critterId).toBe("bluebird");
  for (let count = 0; count < 20; count += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "command" && battle.revealed >= battle.message.length) break;
    await press(page);
  }
  await expect(page.locator(".battle-command-label"))
    .toHaveText(["Soothe", "Play", "Cast", "Snack", "Run"]);
  await expect(page).toHaveScreenshot("bay-bluebird-battle.png");

  await hold(page, "ArrowDown", 1);
  await step(page, 1);
  await hold(page, "ArrowDown", 1);
  expect((await readBattle(page))?.selected).toBe(2);
  await press(page);
  const aim = await readBattle(page);
  expect(aim?.phase).toBe("aim");
  expect(aim?.command).toBe("cast");
  await step(page, 70);
  await press(page);
  await expect(text(page)).toHaveText(/^Sue/);
});
