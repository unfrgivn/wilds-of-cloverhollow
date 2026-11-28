import { expect, test } from '@playwright/test';
import {
  openHarness, playBattleCheck, queueScript, readBattle, readState, recording, resetPaused, step,
  walk,
} from './helpers';

test('real keys enter the Whispering Woods and meet its owl', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, 'woods');
  await expect(page).toHaveScreenshot('woods-arrival-1280.png');
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot('woods-arrival-874.png');
  await page.setViewportSize({ width: 1280, height: 720 });
  // Cross the stream on the stepping stones, then steer straight into the rolled owl.
  await walk(page, 'y', 720);
  await walk(page, 'x', 900);
  for (let tries = 0; tries < 6; tries += 1) {
    const battle = await readBattle(page);
    if (battle?.critterId === 'owl') break;
    if (battle !== null) {
      for (let stepIdx = 0; stepIdx < 40; stepIdx += 1) {
        const cur = await readBattle(page);
        if (cur === null) break;
        if (cur.phase === 'check' && cur.check !== null) await playBattleCheck(page);
        else if (cur.phase === 'command' && cur.revealed >= cur.message.length) {
          await page.keyboard.down('ArrowUp');
          await step(page, 1);
          await page.keyboard.up('ArrowUp');
          await step(page, 1);
          await page.keyboard.press('z');
          await step(page, 2);
        } else {
          await page.keyboard.press('z');
          await step(page, 2);
        }
      }
    }
    const owl = (await readState(page)).wild.find(
      (critter) => critter.kind === 'owl' && critter.mood === 'chaos',
    );
    if (owl === undefined) throw new Error('no chaos owl in woods');
    await walk(page, 'x', owl.x);
    if ((await readBattle(page))?.critterId === 'owl') break;
    await walk(page, 'y', owl.y);
  }
  await expect.poll(async () => page.evaluate(() =>
    window.__cloverhollow?.getState().battle?.critterId ?? null)).toBe('owl');
  await expect(page).toHaveScreenshot('woods-owl-battle.png');
});

test('the recorded lantern replay reaches the clubhouse', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, 'new-game');
  const script = recording('tests/sim/scripts/new-game/golden-woods.json');
  await queueScript(page, script);
  await step(page, script.reduce((total, segment) => total + segment.ticks, 0));
  const state = await page.evaluate(() => window.__cloverhollow?.getState());
  expect(state?.area).toBe('woods');
  expect(state?.wild.find((critter) => critter.kind === 'owl')?.mood).toBe('calm');
  expect(state?.lantern).toBe(true);
  if (process.env.CLOVERHOLLOW_REVIEW_SHOTS === '1' && testInfo.project.name === 'chromium') {
    await page.screenshot({
      path: 'art/review/m117-woods-fireflies.jpg',
      type: 'jpeg',
      quality: 90,
    });
  }
  await expect(page).toHaveScreenshot('woods-clubhouse-lantern-1280.png');
});
