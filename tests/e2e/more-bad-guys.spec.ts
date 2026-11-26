import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playAfter,
  readHash,
  readState,
  resetPaused,
} from "./helpers";

test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: crabs come to the bay once the lifeguard is calm",
  { tag: "@smoke" }, async ({ page }) => {
  const before = "tests/sim/scripts/new-game/golden-bay.json";
  const path = "tests/sim/scripts/new-game/crab.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "new-game");
  const shot: string[] = [];
  await playAfter(page, before, path, async () => {
    const state = await readState(page);
    const battle = state.battle;
    if (battle !== null && battle.phase === "command") {
      // The chain battles press on as soon as the intro finishes, so shoot
      // the scene at the first poll in the command phase (a deterministic
      // tick of the recording, mid-reveal like a player would see it).
      if (!shot.includes("crab-battle") && battle.critterId === "crab") {
        shot.push("crab-battle");
        await shoot(page, "crab-battle");
      }
      return;
    }
    const dialogue = state.dialogue;
    if (dialogue === null || dialogue.revealed < dialogue.text.length) return;
    if (!shot.includes("crab-calm") && dialogue.text.startsWith("Click-click! Thank you")) {
      shot.push("crab-calm");
      await shoot(page, "crab-calm");
    }
  });
  expect(shot).toEqual(["crab-battle", "crab-calm"]);
  const end = await readState(page);
  expect([end.area, end.critters.lifeguard]).toEqual(["bay", "calm"]);
  expect(end.wild.find((critter) => critter.kind === "crab")?.mood).toBe("calm");
  expect(end.stickers).toContain("sandy-crab");
  expect(await readHash(page)).toBe(await bunHash(path, "new-game"));
});

test("real keys: penguins come to the pass once the lodge keeper is calm",
  { tag: "@smoke" }, async ({ page }) => {
  const before = "tests/sim/scripts/new-game/golden-lodge.json";
  const path = "tests/sim/scripts/new-game/penguin.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "new-game");
  const shot: string[] = [];
  await playAfter(page, before, path, async () => {
    const state = await readState(page);
    const battle = state.battle;
    if (battle !== null && battle.phase === "command") {
      if (!shot.includes("penguin-battle") && battle.critterId === "penguin") {
        shot.push("penguin-battle");
        await shoot(page, "penguin-battle");
      }
      return;
    }
    const dialogue = state.dialogue;
    if (dialogue === null || dialogue.revealed < dialogue.text.length) return;
    if (!shot.includes("penguin-calm") && dialogue.text.startsWith("Awrk! My flippers feel")) {
      shot.push("penguin-calm");
      await shoot(page, "penguin-calm");
    }
  });
  expect(shot).toEqual(["penguin-battle", "penguin-calm"]);
  const end = await readState(page);
  expect([end.area, end.critters["lodge-keeper"]]).toEqual(["pass", "calm"]);
  expect(end.wild.find((critter) => critter.kind === "penguin")?.mood).toBe("calm");
  expect(end.stickers).toContain("waddle-penguin");
  expect(await readHash(page)).toBe(await bunHash(path, "new-game"));
});

test("real keys: the megaphone brings out a fizzy principal",
  { tag: "@smoke" }, async ({ page }) => {
  const before = "tests/sim/scripts/new-game/golden-school.json";
  const path = "tests/sim/scripts/new-game/principal.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "new-game");
  const shot: string[] = [];
  await playAfter(page, before, path, async () => {
    const state = await readState(page);
    const battle = state.battle;
    if (battle !== null && battle.revealed >= battle.message.length) {
      if (!shot.includes("principal-battle") &&
        battle.message.startsWith("Mr. Bell marches out")) {
        shot.push("principal-battle");
        await shoot(page, "principal-battle");
      }
      return;
    }
    const dialogue = state.dialogue;
    if (dialogue === null || dialogue.revealed < dialogue.text.length) return;
    if (!shot.includes("principal-summon") &&
      dialogue.text.startsWith("Somebody shouts \"GOOD MORNING")) {
      shot.push("principal-summon");
      await shoot(page, "principal-summon");
    }
    if (!shot.includes("principal-calm") && dialogue.text.startsWith("Oh my stars.")) {
      shot.push("principal-calm");
      await shoot(page, "principal-calm");
    }
  });
  expect(shot).toEqual(["principal-summon", "principal-battle", "principal-calm"]);
  const end = await readState(page);
  expect([end.area, end.critters.principal]).toEqual(["school", "calm"]);
  expect(end.stickers).toContain("principal");
  expect(await readHash(page)).toBe(await bunHash(path, "new-game"));
});
