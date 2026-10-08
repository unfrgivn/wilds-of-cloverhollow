import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  openHarness,
  playWithKeys,
  readHash,
  readState,
  recording,
  renderInfo,
  resetPaused,
} from "./helpers";

// Milestone 33: the indoor rooms are kits (spec 6.2). In each, a recorded walk
// (`tools/sim/record-kits.ts`) played with real keys: to where a prop hides the
// most of Fae, then in front of it, then into it, a 30-tick stop at each. Behind
// it, the prop's picture is drawn over her in her columns; in front, under her.
// The end state must hash the same as Bun's replay of the same walk.

const rooms = [
  { room: "bedroom", fixture: "new-game", prop: "desk-chair" },
  { room: "kitchen", fixture: "kitchen", prop: "sofa" },
  { room: "school", fixture: "school", prop: "cabinet" },
  { room: "classroom", fixture: "classroom", prop: "teacher-desk" },
  { room: "gym", fixture: "gym", prop: "ball-bin" },
  { room: "arcade", fixture: "arcade", prop: "ticket-counter" },
];

// Whether the prop is drawn over Fae: of its strips across her body (50 units
// wide at her feet), the one sorted last is above her.
async function propOverFae(page: Page, prop: string): Promise<boolean> {
  const info = await renderInfo(page);
  const { x } = (await readState(page)).player;
  const fae = info.drawOrder.find((item) => item.label === "fae");
  const strips = info.props.find((item) => item.id === prop)?.strips
    .filter((strip) => strip.left < x + 25 && strip.right > x - 25) ?? [];
  if (fae === undefined || strips.length === 0) throw new Error(`no Fae or ${prop} near her`);
  return Math.max(...strips.map((strip) => strip.zIndex)) > fae.zIndex;
}

for (const { room, fixture, prop } of rooms)
  test(`real keys: behind, in front of, and into the ${room}'s ${prop}`, async ({ page }) => {
    const path = `tests/sim/scripts/${fixture}/kit-${room}.json`;
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHarness(page);
    await resetPaused(page, fixture);
    expect((await readState(page)).area).toBe(room);
    // The walk's three stops are its 30-tick idles: behind, in front, against.
    const stops: boolean[] = [];
    for (const segment of recording(path)) {
      await playWithKeys(page, [segment], 10, async () => undefined);
      const { move, confirm } = segment.frame;
      if (move.x !== 0 || move.y !== 0 || confirm || segment.ticks < 30) continue;
      stops.push(await propOverFae(page, prop));
      if (stops.length === 1)
        await expect(page).toHaveScreenshot(`kit-${room}-behind.png`);
    }
    expect(stops.slice(0, 2)).toEqual([true, false]);
    expect((await readState(page)).area).toBe(room);
    expect(await readHash(page)).toBe(bunHash(path, fixture));
  });
