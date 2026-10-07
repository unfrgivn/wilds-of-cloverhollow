import { expect, test } from '@playwright/test';
import { openHarness, queueScript, recording, resetPaused, step } from './helpers';

test('real keys enter the Whispering Woods and meet its owl', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, 'woods');
  await expect(page).toHaveScreenshot('woods-arrival-1280.png');
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot('woods-arrival-874.png');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('ArrowDown');
  await step(page, 35);
  await page.keyboard.up('ArrowDown');
  await step(page, 140);
  await page.keyboard.up('ArrowLeft');
  await expect.poll(async () => page.evaluate(() =>
    window.__cloverhollow?.getState().battle?.critterId ?? null)).toBe('owl');
  await expect(page).toHaveScreenshot('woods-owl-battle.png');
});

test('the recorded lantern replay reaches the clubhouse', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, 'pass-party');
  const script = recording('tests/sim/scripts/pass-party/woods.json');
  await queueScript(page, script);
  await step(page, script.reduce((total, segment) => total + segment.ticks, 0));
  const state = await page.evaluate(() => window.__cloverhollow?.getState());
  expect(state?.area).toBe('woods');
  expect(state?.wild.find((critter) => critter.kind === 'owl')?.mood).toBe('calm');
  expect(state?.lantern).toBe(true);
  await expect(page).toHaveScreenshot('woods-clubhouse-lantern-1280.png');
});
