import { expect, test, type Page } from "@playwright/test";
import { readBattle, readState, renderInfo, resetPaused, step } from "./helpers";

// Followers who fight (Milestone 17): Maddie is party member 0 in the plaza,
// and her Play command sits between Soothe and Snack in the frog's menu.

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function press(page: Page): Promise<void> {
  await page.keyboard.down("Enter");
  await step(page, 1);
  await page.keyboard.up("Enter");
  await step(page, 1);
}

test("real keys: Maddie walks the plaza as the party, and brings Play to the frog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("./");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page, "plaza");
  const start = await readState(page);
  expect(start.party.map((member) => member.id)).toEqual(["maddie"]);

  // Walk down and left; Maddie follows a band behind Fae as one party entry.
  await hold(page, "ArrowDown", 25);
  await hold(page, "ArrowLeft", 15);
  await hold(page, "ArrowDown", 50);
  const walking = await readState(page);
  const [maddie] = walking.party;
  if (maddie === undefined) throw new Error("Maddie missing from the party");
  const gap = Math.hypot(maddie.x - walking.player.x, maddie.y - walking.player.y);
  expect(gap).toBeGreaterThanOrEqual(50);
  expect(gap).toBeLessThanOrEqual(140);
  const info = await renderInfo(page);
  expect(info.party.map((member) => member.id)).toEqual(["maddie"]);
  expect(info.party[0]?.animation.startsWith("walk_")).toBe(true);
  expect(info.drawOrder.map((item) => item.label)).toEqual(
    expect.arrayContaining(["fae", "maddie"]),
  );
  await step(page, 60);
  expect((await renderInfo(page)).party[0]?.animation.startsWith("idle_")).toBe(true);
  await expect(page).toHaveScreenshot("plaza-party.png");

  // Into the frog's touch circle, through the intro to the command menu.
  await hold(page, "ArrowLeft", 35);
  await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
  for (let presses = 0; presses < 12; presses += 1) {
    const battle = await readBattle(page);
    if (battle?.phase === "command" && battle.revealed >= battle.message.length) break;
    await press(page);
  }
  expect((await readBattle(page))?.phase).toBe("command");
  await expect(page.locator(".battle-command-label")).toHaveText([
    "Soothe", "Play", "Snack", "Run",
  ]);
  const layout = (await renderInfo(page)).battle.layout;
  expect(layout?.party).toHaveLength(1);
  expect(layout?.party[0]?.y).toBe(layout?.fae.baseline);
  await expect(page).toHaveScreenshot("battle-party-commands.png");

  // Down once selects Play; confirm starts its aim with Play's rest set.
  await hold(page, "ArrowDown", 1);
  await step(page, 1);
  expect((await readBattle(page))?.selected).toBe(1);
  await press(page);
  const aiming = await readBattle(page);
  expect(aiming?.phase).toBe("aim");
  expect(aiming?.command).toBe("play");
  expect(aiming?.rest).toEqual({ play: 1 });
});
