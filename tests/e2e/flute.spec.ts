import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playAfter,
  queueScript,
  readHash,
  readState,
  recording,
  renderInfo,
  resetPaused,
  step,
} from "./helpers";

// Flute friends (Milestone 47), with real keys, on from the field run: out of
// school with the nurse's hall pass; in the park, the pup calmed, petted, and
// given a snack (a friend); F plays the flute and calls him; he follows Fae,
// sits out a battle, and swims out for the pond's tin; F sends him home.
test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: a pat and a snack, the flute, a friend along, and the pond", async ({
  page,
}) => {
  const path = "tests/sim/scripts/pass-party/flute.json";
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  let bondShot = false;
  let joined: number | null = null;
  let followShot = false;
  let battleShot = false;
  let pondShot = false;
  const parties: string[] = [];
  await playAfter(page, "tests/sim/scripts/pass-party/field.json", path, async () => {
    const state = await readState(page);
    const party = state.party.map((member) => member.id).join(",");
    if (parties.at(-1) !== party) parties.push(party);
    const along = state.party.some((member) => member.id === "pond-pup");
    if (along && joined === null) joined = state.tick;
    const dialogue = state.dialogue;
    const shown = dialogue !== null && dialogue.revealed >= dialogue.text.length;
    if (!bondShot && shown && dialogue.text.startsWith("He's my friend now!")) {
      bondShot = true;
      await shoot(page, "flute-bond");
    }
    if (!followShot && along && joined !== null && state.tick - joined >= 60 &&
        dialogue === null && state.battle === null && state.transition === null) {
      // He's drawn from his own atlas, behind Fae and her friends.
      const info = await renderInfo(page);
      const pup = info.party.find((member) => member.id === "pond-pup");
      expect(pup?.animation).toMatch(/^(walk|idle)_(down|up|left)$/);
      followShot = true;
      await shoot(page, "flute-following");
    }
    const battle = state.battle;
    if (!battleShot && along && battle !== null && battle.phase === "command" &&
        battle.revealed >= battle.message.length) {
      // He's in the party, but not in the battle: three places beside Fae.
      const info = await renderInfo(page);
      expect(info.battle.layout?.party).toHaveLength(3);
      battleShot = true;
      await shoot(page, "flute-battle");
    }
    if (!pondShot && shown && dialogue.text.startsWith("He swims back with an old tin")) {
      pondShot = true;
      await shoot(page, "flute-pond");
    }
  });
  expect({ bondShot, followShot, battleShot, pondShot })
    .toEqual({ bondShot: true, followShot: true, battleShot: true, pondShot: true });
  expect(parties.slice(-3)).toEqual([
    "maddie,sue,jordan", "maddie,sue,jordan,pond-pup", "maddie,sue,jordan",
  ]);
  const end = await readState(page);
  expect({ area: end.area, party: end.party.length }).toEqual({ area: "park", party: 3 });
  expect(await readHash(page)).toBe(bunHash(path, "pass-party"));
});

test("the touch flute button plays the flute, and steps aside while she talks", {
  tag: "@smoke",
}, async ({ page }) => {
  await page.setViewportSize({ width: 874, height: 402 });
  await page.goto("./?touch=1");
  await page.waitForFunction(() => Boolean(window.__cloverhollow));
  await resetPaused(page, "pass-party");
  const field = recording("tests/sim/scripts/pass-party/field.json");
  await queueScript(page, field);
  await step(page, field.reduce((sum, segment) => sum + segment.ticks, 0));
  const flute = page.locator(".touch-flute");
  const lantern = page.locator(".touch-lantern");
  await expect(flute).toBeVisible();
  await expect(lantern).toBeVisible();
  await expect(page).toHaveScreenshot("touch-flute-button-874.png");
  await flute.click();
  await step(page, 1);
  expect((await readState(page)).dialogue?.knot).toBe("flute");
  // The whole line shown, for a still picture.
  for (let count = 0; count < 20; count += 1) {
    const dialogue = (await readState(page)).dialogue;
    if (dialogue !== null && dialogue.revealed >= dialogue.text.length) break;
    await step(page, 10);
  }
  // While a conversation is open, the tools step aside for confirm and cancel.
  await expect(flute).toBeHidden();
  await expect(lantern).toBeHidden();
  await expect(page).toHaveScreenshot("touch-flute-played-874.png");
});
