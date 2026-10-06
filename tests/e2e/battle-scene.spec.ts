import { expect, test, type Page } from "@playwright/test";
import { readState, renderInfo, resetPaused, step } from "./helpers";

// The battle scene's composition contract (spec 8): both combatants stay
// visible around the DOM HUD (top), the command menu (right), the message box
// (bottom left), and the touch buttons, on a phone and on a desktop.

type Rect = { x: number; y: number; width: number; height: number };

const sizes = [
  { name: "desktop", width: 1280, height: 720, touch: false },
  { name: "phone", width: 874, height: 402, touch: true },
];
const battleHeight = 190;
const viewHeight = 720;
// Logical view width: 720 x aspect, clamped to 960..1600 (spec 4).
const viewWidth = (width: number, height: number): number =>
  Math.min(1600, Math.max(960, 720 * width / height));

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width &&
    a.y < b.y + b.height && b.y < a.y + a.height;
}

// A figure's box from its centre x, baseline, and height (sprites are about
// 0.9 as wide as tall for the frog and 0.6 for Fae).
function figureBox(figure: { x: number; baseline: number; height: number },
  aspect: number): Rect {
  return { x: figure.x - figure.height * aspect / 2, y: figure.baseline - figure.height,
    width: figure.height * aspect, height: figure.height };
}

async function press(page: Page): Promise<void> {
  await page.keyboard.down("Enter");
  await step(page, 1);
  await page.keyboard.up("Enter");
  await step(page, 1);
}

// From the plaza fixture (the fountain spawn), into the frog's touch circle.
async function walkIntoTheFrog(page: Page): Promise<void> {
  for (const [key, ticks] of [["ArrowDown", 25], ["ArrowLeft", 15], ["ArrowDown", 50],
    ["ArrowLeft", 35], ["ArrowUp", 38]] as const) {
    await page.keyboard.down(key);
    await step(page, ticks);
    await page.keyboard.up(key);
  }
  await expect(page.locator("html")).toHaveAttribute("data-battle", "open");
}

async function toCommand(page: Page): Promise<void> {
  for (let presses = 0; presses < 12; presses += 1) {
    const battle = (await readState(page)).battle;
    if (battle?.phase === "command" && battle.revealed >= battle.message.length) return;
    await press(page);
  }
  throw new Error("the battle never reached a shown command menu");
}

async function rects(page: Page, selector: string): Promise<Rect[]> {
  return page.locator(selector).evaluateAll((elements) => elements
    .filter((element) => element.getClientRects().length > 0)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }));
}

// One screenshot, read at the four corners: the pixel itself and the
// luminance spread in a 9x9 patch (a painted corner has texture; a flat fill,
// such as bare canvas, paper, or an overlay, has almost none).
async function corners(page: Page): Promise<{ rgb: number[]; spread: number }[]> {
  const encoded = (await page.screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("no 2d context");
    context.drawImage(image, 0, 0);
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    return [[2, 2], [w - 11, 2], [2, h - 11], [w - 11, h - 11]].map(([x = 0, y = 0]) => {
      const pixels = context.getImageData(x, y, 9, 9).data;
      const values: number[] = [];
      for (let index = 0; index < pixels.length; index += 4)
        values.push(.2126 * (pixels[index] ?? 0) + .7152 * (pixels[index + 1] ?? 0) +
          .0722 * (pixels[index + 2] ?? 0));
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const spread = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        values.length);
      return { rgb: [pixels[0] ?? 0, pixels[1] ?? 0, pixels[2] ?? 0], spread };
    });
  }, encoded);
}

for (const size of sizes) {
  test(`the ${size.name} battle scene keeps both combatants in view`, async ({ browser }) => {
    test.setTimeout(process.env.CI ? 180_000 : 60_000);
    const context = await browser.newContext({ viewport: { width: size.width,
      height: size.height }, hasTouch: size.touch });
    const page = await context.newPage();
    await page.goto(size.touch ? "./?touch=1" : "./");
    await page.waitForFunction(() => Boolean(window.__cloverhollow));
    await resetPaused(page, "plaza");
    await walkIntoTheFrog(page);
    await toCommand(page);
    const info = (await renderInfo(page)).battle;
    expect(info.overworldVisible, "the overworld hides during a battle").toBe(false);
    const backdrop = info.backdrop;
    expect(backdrop, "renderInfo().battle.backdrop").toBeTruthy();
    if (backdrop) {
      expect(backdrop.x).toBeLessThanOrEqual(0);
      expect(backdrop.y).toBeLessThanOrEqual(0);
      expect(backdrop.x + backdrop.width).toBeGreaterThanOrEqual(size.width);
      expect(backdrop.y + backdrop.height).toBeGreaterThanOrEqual(size.height);
    }
    // The canvas background is 0xf8edcf; the painting must reach every corner,
    // and stay bright like the approved mock (a dark overlay doesn't count).
    for (const corner of await corners(page)) {
      const [red = 0, green = 0, blue = 0] = corner.rgb;
      const distance = Math.abs(red - 0xf8) + Math.abs(green - 0xed) + Math.abs(blue - 0xcf);
      expect(distance, "a corner shows the bare canvas").toBeGreaterThan(12);
      expect(red + green + blue, "a corner is darkened").toBeGreaterThan(420);
      expect(corner.spread, "a corner is a flat fill, not the painting").toBeGreaterThan(1.5);
    }
    const layout = info.layout;
    expect(layout, "renderInfo().battle.layout").toBeTruthy();
    if (!layout) return;
    const scale = Math.min(size.width / viewWidth(size.width, size.height),
      size.height / viewHeight);
    expect(Math.abs(layout.frog.height - battleHeight * scale)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.frog.x - size.width * .5)).toBeLessThanOrEqual(size.width * .02);
    const frogCentre = layout.frog.baseline - layout.frog.height / 2;
    expect(Math.abs(frogCentre - size.height * .42)).toBeLessThanOrEqual(size.height * .02);
    expect(info.auraAlpha, "the chaos aura is clearly visible").toBeGreaterThanOrEqual(.5);
    const frog = figureBox(layout.frog, .9);
    const fae = figureBox(layout.fae, .6);
    const hud = await rects(page, ".battle-meter");
    const commands = await rects(page, ".battle-commands");
    const message = await rects(page, ".sticker-dialogue");
    const buttons = await rects(page, ".touch-confirm, .touch-cancel, .touch-menu");
    expect(hud.length).toBe(2);
    expect(commands.length).toBe(1);
    expect(message.length).toBe(1);
    for (const blocker of [...hud, ...commands, ...message, ...buttons]) {
      expect(intersects(frog, blocker), `frog vs ${JSON.stringify(blocker)}`).toBe(false);
      expect(intersects(fae, blocker), `Fae vs ${JSON.stringify(blocker)}`).toBe(false);
    }
    for (const figure of [frog, fae]) {
      expect(figure.x).toBeGreaterThanOrEqual(0);
      expect(figure.y).toBeGreaterThanOrEqual(0);
      expect(figure.x + figure.width).toBeLessThanOrEqual(size.width);
    }
    await expect(page).toHaveScreenshot(`battle-scene-command-${size.name}.png`);

    // Soothe: the ring sits on the frog's body centre, and the message box steps aside.
    await press(page);
    expect((await readState(page)).battle?.phase).toBe("aim");
    const ring = (await renderInfo(page)).battle.ring;
    expect(ring, "renderInfo().battle.ring").toBeTruthy();
    if (!ring) return;
    expect(Math.abs(ring.x - layout.frog.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(ring.y - frogCentre)).toBeLessThanOrEqual(1);
    const drawn = await page.locator(".battle-ring").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    expect(Math.abs(drawn.x - ring.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(drawn.y - ring.y)).toBeLessThanOrEqual(1);
    await expect(page.locator(".sticker-dialogue")).toBeHidden();
    await context.close();
  });
}
