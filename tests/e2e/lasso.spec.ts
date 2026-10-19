import { expect, test, type Page } from "@playwright/test";
import {
  bunHash,
  longFlowTimeout,
  openHarness,
  playAfter,
  readHash,
  readState,
  renderInfo,
  resetPaused,
} from "./helpers";

// Lasso spots (Milestone 49), with real keys, on from the flute run: Rosie's
// kite off the park's play tower, the cocoa seller's scarf off a ski-lift
// chair, a bottle with a treasure map past the end of Sue's dock and the
// treasure dug up between the palms, and the kite back to Rosie. Each stuck
// thing is a prop that's hidden until Fae has the lasso and once it's down.
test.describe.configure({ timeout: longFlowTimeout });

async function shoot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}-1280.png`);
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(page).toHaveScreenshot(`${name}-874.png`);
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("real keys: the kite, the scarf, the bottle and the treasure, and Rosie", async ({
  page,
}) => {
  const path = "tests/sim/scripts/pass-party/lasso.json";
  const expectedHash = bunHash(path, "pass-party");
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHarness(page);
  await resetPaused(page, "pass-party");
  const moments: [string, string][] = [
    ["A kite is caught", "lasso-kite"],
    ["A long red scarf is caught", "lasso-scarf"],
    ["A bottle is bobbing", "lasso-bottle"],
    ["Clunk! A little tin chest", "lasso-treasure"],
    ["My kite!", "lasso-rosie"],
  ];
  const shot = new Set<string>();
  // Each stuck thing's prop as it was drawn, read at its moment (stuck) and as
  // its conversation closes (lassoed down, so hidden): only then, since the
  // render info is heavy and a long real-key run steps it hundreds of times.
  const drawn: Record<string, string[]> = { kite: [], bottle: [], scarf: [] };
  const errands: Record<string, string> = { tower: "kite", dock_end: "bottle",
    ski_lift: "scarf" };
  const record = async (id: string): Promise<void> => {
    const prop = (await renderInfo(page)).props.find((item) => item.id === id);
    drawn[id]?.push(prop === undefined ? "missing"
      : `${prop.state}${prop.hidden ? " (hidden)" : ""}`);
  };
  let open: string | null = null;
  await playAfter(page, "tests/sim/scripts/pass-party/flute.json", path, async () => {
    const state = await readState(page);
    const knot = state.dialogue?.knot ?? null;
    const closed = open === null ? undefined : errands[open];
    if (knot === null && closed !== undefined) await record(closed);
    open = knot;
    const dialogue = state.dialogue;
    if (dialogue === null || dialogue.revealed < dialogue.text.length) return;
    for (const [start, name] of moments)
      if (!shot.has(name) && dialogue.text.startsWith(start)) {
        shot.add(name);
        const id = errands[dialogue.knot];
        if (id !== undefined) await record(id);
        await shoot(page, name);
      }
  });
  expect([...shot]).toEqual(moments.map(([, name]) => name));
  expect(drawn).toEqual({
    kite: ["stuck", "default (hidden)"],
    bottle: ["bobbing", "default (hidden)"],
    scarf: ["stuck", "default (hidden)"],
  });
  const end = await readState(page);
  expect(end.area).toBe("classroom");
  expect(await readHash(page)).toBe(await expectedHash);
});
