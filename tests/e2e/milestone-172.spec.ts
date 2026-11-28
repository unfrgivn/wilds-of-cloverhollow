import { expect, test, type Page } from "@playwright/test";
import {
  openHarness,
  playBattleCheck,
  readBattle,
  resetPaused,
  step,
} from "./helpers";

async function tapKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
  await step(page, 1);
}

async function holdKey(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

test(
  "Per-member Recover renders clover-meadow theater VFX and die-cut popup cleanly",
  { tag: "@smoke" },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, "plaza");

    // Walk into the plaza Fountain Frog to enter a live party battle (Fae + Maddie).
    for (const [key, ticks] of [
      ["ArrowDown", 25],
      ["ArrowLeft", 15],
      ["ArrowDown", 50],
      ["ArrowLeft", 35],
    ] as const) {
      await holdKey(page, key, ticks);
    }
    await expect(page.locator("html")).toHaveAttribute("data-battle", "open");

    // Advance intro line to Fae's command menu (full energy 5/5) and finish revealing text.
    for (let guard = 0; guard < 16; guard += 1) {
      const battle = await readBattle(page);
      if (battle?.phase === "command" && battle.revealed >= battle.message.length) break;
      await tapKey(page, "Enter");
    }
    const turn1 = await readBattle(page);
    expect(turn1?.phase).toBe("command");
    expect(turn1?.energy).toBe(5);

    // Move to Recover (second command) and confirm with real keys.
    await tapKey(page, "ArrowDown");
    await expect(
      page.locator('.battle-command[aria-selected="true"]'),
    ).toContainText("Recover");
    await tapKey(page, "Enter");

    const recovered = await readBattle(page);
    expect(recovered?.phase).toBe("result");
    expect(recovered?.command).toBe("recover");
    expect(recovered?.message).toContain("Fae takes a slow, steady breath");

    // Full energy Recover spawns READY! ✦ without double-popping.
    const popup = page.locator(".battle-popup-energy");
    await expect(popup).toBeVisible();
    await expect(popup).toHaveText("READY! ✦");
    await expect(page.locator(".battle-popup")).toHaveCount(1);

    // Step to peak inhale-exhale bob & rising clover-meadow sparkles.
    const toPeak = Math.max(0, 10 - (recovered?.phaseTicks ?? 0));
    if (toPeak > 0) await step(page, toPeak);
    expect((await readBattle(page))?.phase).toBe("result");
    expect((await readBattle(page))?.command).toBe("recover");

    if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" && testInfo.project.name === "chromium") {
      await page.screenshot({
        path: "art/review/m172-recover-theater.jpg",
        type: "jpeg",
        quality: 90,
      });
    }

    // Advance past Fae's Recover and critter burst into Maddie's turn, then Recover as Maddie.
    for (let guard = 0; guard < 40; guard += 1) {
      const battle = await readBattle(page);
      if (battle === null) throw new Error("battle ended before Maddie's turn");
      if (
        battle.phase === "command" &&
        (battle.actorIndex ?? 0) === 1 &&
        battle.revealed >= battle.message.length
      ) {
        break;
      }
      if (battle.phase === "check" && battle.check !== null) {
        await playBattleCheck(page);
        await step(page, 1);
        continue;
      }
      await tapKey(page, "Enter");
    }
    const turn2 = await readBattle(page);
    expect(turn2?.phase).toBe("command");
    expect(turn2?.actorIndex).toBe(1);

    await tapKey(page, "ArrowDown");
    await expect(
      page.locator('.battle-command[aria-selected="true"]'),
    ).toContainText("Recover");
    await tapKey(page, "Enter");

    const maddieRecover = await readBattle(page);
    expect(maddieRecover?.phase).toBe("result");
    expect(maddieRecover?.command).toBe("recover");
    expect(maddieRecover?.message).toContain("Maddie");

    const maddiePopup = page.locator(".battle-popup-energy").last();
    await expect(maddiePopup).toBeVisible();
    await expect(maddiePopup).toHaveText(/^(?:READY! ✦|\+1 ⚡)$/);

    expect(errors).toEqual([]);
  },
);
