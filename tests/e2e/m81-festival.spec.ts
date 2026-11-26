import { expect, test, type Page } from "@playwright/test";
import { peekabooStatus } from "../../src/core";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playAfter,
  readHash,
  readState,
  resetPaused,
} from "./helpers";

// Milestone 81 (Peekaboo check, Starry Owl & Chef Mateo Taco Truck Talk
// mini-boss), played with real keys on from golden-clubhouse.json: Starey Owl
// summoned at moon-perch in Whispering Woods, Peekaboo burst captured in both
// safe and watching phases, Starry Owl calmed, then Clover Hills taco-flyer ->
// Chef Mateo battle + 3 graded Talk knots + taco snack shop at 1280x720 and
// 874x402, matching Bun's exact deterministic state hash.
test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

async function assertPeekabooClearOfHud(page: Page): Promise<void> {
  for (const size of [{ width: 1280, height: 720 }, { width: 874, height: 402 }]) {
    await page.setViewportSize(size);
    const ok = await page.evaluate(() => {
      const badge = document.querySelector<HTMLElement>(".battle-peekaboo-badge");
      const track = document.querySelector<HTMLElement>(".battle-peekaboo-track");
      const meters = [...document.querySelectorAll<HTMLElement>(".battle-meter")]
        .filter((item) => item.getClientRects().length > 0);
      if (badge === null || track === null) return false;
      const intersects = (a: DOMRect, b: DOMRect): boolean =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const b = badge.getBoundingClientRect();
      const t = track.getBoundingClientRect();
      const onScreen = (r: DOMRect): boolean =>
        r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
      return b.width > 0 && t.width > 0 && onScreen(b) && onScreen(t) &&
        !meters.some((meter) => {
          const m = meter.getBoundingClientRect();
          return intersects(b, m) || intersects(t, m);
        });
    });
    expect(ok, `peekaboo clear of HUD at ${size.width}x${size.height}`).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: Starry Owl Peekaboo (safe + watching) & Chef Mateo Talk", async ({
  page,
}) => {
  const path = "tests/sim/scripts/new-game/m81-festival.json";
  const expectedHash = bunHash(path, "new-game");
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "new-game");

  const shot = new Set<string>();

  await playAfter(
    page,
    "tests/sim/scripts/new-game/golden-clubhouse.json",
    path,
    async () => {
      const state = await readState(page);
      const battle = state.battle;
      if (battle !== null && battle.phase === "check" && battle.check?.kind === "peekaboo") {
        const status = peekabooStatus(battle.check);
        if (!shot.has("peekaboo-safe") && status === "safe" && battle.check.progress >= 10) {
          shot.add("peekaboo-safe");
          await expect(page.locator(".battle-peekaboo-badge")).toHaveAttribute(
            "data-status",
            "safe",
          );
          await assertPeekabooClearOfHud(page);
          await shoot(page, "m81-peekaboo-safe");
        }
        if (!shot.has("peekaboo-watching") && status === "watching") {
          shot.add("peekaboo-watching");
          await expect(page.locator(".battle-peekaboo-badge")).toHaveAttribute(
            "data-status",
            "watching",
          );
          await assertPeekabooClearOfHud(page);
          await shoot(page, "m81-peekaboo-watching");
        }
      }
      if (
        !shot.has("mateo-talk") &&
        battle !== null &&
        battle.critterId === "taco-chef" &&
        battle.phase === "talk" &&
        battle.talk !== null &&
        battle.talk !== undefined &&
        battle.talk.choices.length === 3 &&
        battle.talk.revealed >= battle.talk.text.length
      ) {
        shot.add("mateo-talk");
        await expect(page.locator(".sticker-choice")).toHaveCount(3);
        await shoot(page, "m81-mateo-talk");
      }
    },
  );

  expect([...shot]).toEqual(["peekaboo-safe", "peekaboo-watching", "mateo-talk"]);

  const end = await readState(page);
  expect(end.area).toBe("hills");
  expect(end.stickers).toContain("starry-owl");
  expect(end.stickers).toContain("taco-chef");
  expect(await readHash(page)).toBe(await expectedHash);
});
