import { expect, test, type Page } from "@playwright/test";
import { clawGalleryStates } from "../../src/dev/claw-gallery";
import { cookGalleryStates } from "../../src/dev/cook-gallery";
import { moleGalleryStates } from "../../src/dev/mole-gallery";
import { skeeGalleryStates } from "../../src/dev/skee-gallery";
import { bunClawLayout, bunMoleLayout, bunSkeeLayout } from "./helpers";

test.use({ deviceScaleFactor: 2 });
// Every test loads its own page, so the gallery spreads across workers: in
// order on one, its 263 tests kept that worker busy for about 2.4 minutes
// after every other worker had finished.
test.describe.configure({ mode: "parallel" });

const states = ["short", "long", "long-max", "revealing", "speaker-board",
  "two-choices", "three-choices", "five-choices", "prompt", "touch-overlap"];
const battleStates = ["battle-command", "battle-timing", "battle-grade", "battle-burst",
  "battle-charge", "battle-chain", "battle-chain-burst", "battle-catch", "battle-lean",
  "battle-reward", "battle-feelings", "battle-feelings-heart", "battle-windup",
  "battle-trace", "battle-trace-mid", "battle-trace-dry", "battle-talk", "battle-talk-reply"];
const journalStates = ["journal-empty", "journal-notes", "journal-full"];
const dialogueStates = states.filter((state) => state !== "prompt");
const phone = { width: 874, height: 402 };
const sizes = [phone, { width: 1180, height: 820 }, { width: 1280, height: 720 }];

async function gallery(page: Page, state: string, touch = true,
  insets = "0,62,21,62", size = phone): Promise<void> {
  await page.setViewportSize(size);
  const query = `state=${state}&insets=${insets}${touch ? "&touch=1" : ""}`;
  await page.goto(`/cloverhollow/ui-gallery.html?${query}`);
  await expect(page.locator(".gallery-stage")).toBeVisible();
  // Fonts, the claw machine's painting, and the plushes decoded.
  await expect(page.locator("#gallery[data-ready='true']")).toHaveCount(1);
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  }));
  // Measure the settled layout, not a pop-in halfway through. Looping
  // animations (the advance arrow's bob) never finish, so skip them.
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((item) => item.effect?.getComputedTiming().iterations !== Infinity)
    .map((item) => item.finished)));
}

type Rgb = [number, number, number];

const rings = [
  { state: "battle-timing", x: 600, y: 170, radius: 74, progress: .62, target: .65 },
  { state: "battle-burst", x: 190, y: 300, radius: 66, progress: .38, target: .5 },
];
const battleParts: Record<string, string[]> = {
  "battle-command": [".battle-hud", ".battle-commands", ".sticker-dialogue"],
  "battle-timing": [".battle-hud", ".battle-ring"],
  "battle-grade": [".battle-hud", ".battle-ring", ".battle-grade"],
  "battle-burst": [".battle-hud", ".battle-ring"],
  "battle-charge": [".battle-hud", ".battle-charge-meter", ".battle-check-hint"],
  "battle-chain": [".battle-hud", ".battle-chain", ".battle-check-hint"],
  "battle-chain-burst": [".battle-hud", ".battle-chain", ".battle-check-hint"],
  "battle-catch": [".battle-hud", ".battle-catch", ".battle-check-hint", ".touch-reach"],
  "battle-lean": [".battle-hud", ".battle-lean", ".touch-lean"],
  "battle-trace": [".battle-hud", ".battle-trace", ".battle-check-hint"],
  "battle-trace-mid": [".battle-hud", ".battle-trace"],
  "battle-trace-dry": [".battle-hud", ".battle-trace", ".battle-grade"],
  "battle-feelings": [".battle-hud", ".battle-commands", ".sticker-dialogue", ".battle-feeling"],
  "battle-feelings-heart": [".battle-hud", ".battle-feeling", ".battle-feeling-heart"],
  "battle-windup": [".battle-hud", ".battle-commands", ".sticker-dialogue", ".battle-windup"],
  "battle-talk": [".sticker-dialogue"],
  "battle-talk-reply": [".battle-hud", ".sticker-dialogue"],
  "battle-reward": [".battle-reward"],
  "journal-empty": [".journal-book"],
  "journal-notes": [".journal-book"],
  "journal-full": [".journal-book"],
  ...Object.fromEntries(clawGalleryStates.map((state) => [state,
    state === "arcade-result" ? [".battle-reward", ".sticker-dialogue"] : []])),
  ...Object.fromEntries(skeeGalleryStates.map((state) => [state,
    state === "skee-result" ? [".sticker-dialogue"] : []])),
  ...Object.fromEntries(moleGalleryStates.map((state) => [state,
    state === "mole-result" ? [".sticker-dialogue"] : []])),
  ...Object.fromEntries(cookGalleryStates.map((state) => [state,
    state === "cook-result" || state === "cook-burnt" ? [".sticker-dialogue"] : []])),
};
const allBattleParts = [".battle-hud", ".battle-commands", ".battle-ring", ".battle-charge-meter",
  ".battle-chain", ".battle-catch", ".battle-lean", ".battle-trace",
  ".battle-check-hint", ".battle-grade",
  ".touch-reach", ".touch-lean",
  ".battle-feeling", ".battle-feeling-heart", ".battle-windup",
  ".battle-reward", ".journal-book", ".sticker-dialogue", ".sticker-prompt", ".touch-stick",
  ".touch-confirm", ".touch-cancel", ".touch-menu"];
const touchButtonsShown = [".touch-confirm", ".touch-cancel", ".touch-menu"];
const frogFrames = {
  chaos_idle_01: { x: 0, y: 0, w: 512, h: 512 },
  chaos_burst_01: { x: 512, y: 0, w: 512, h: 512 },
  soothed_01: { x: 1024, y: 0, w: 512, h: 512 },
  calm_idle_01: { x: 0, y: 512, w: 512, h: 512 },
  chaos_aura_01: { x: 512, y: 512, w: 512, h: 512 },
};

// Screenshots the page and reads pixels at CSS px points (decoded in the page).
async function samplePixels(page: Page, points: { x: number; y: number }[]): Promise<Rgb[]> {
  const encoded = (await page.screenshot({ animations: "disabled" })).toString("base64");
  return page.evaluate(async ({ encoded, points }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("no 2d context");
    context.drawImage(image, 0, 0);
    const scale = image.naturalWidth / window.innerWidth;
    return points.map((point): [number, number, number] => {
      const data = context.getImageData(Math.round(point.x * scale),
        Math.round(point.y * scale), 1, 1).data;
      return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0];
    });
  }, { encoded, points });
}

type Box = { x: number; y: number; width: number; height: number; right: number };

// How closely the image drawn in `box` matches each frog frame, comparing only
// each frame's interior (3+ px inside its silhouette) so a die-cut rim doesn't
// count and the face and marks decide. `paper` is the colour behind the image.
async function frogFrameScores(page: Page, box: Box, paper: string):
  Promise<Record<string, number>> {
  const encoded = (await page.screenshot({ animations: "disabled" })).toString("base64");
  return page.evaluate(async ({ encoded, box, frames, paper }) => {
    const load = async (src: string): Promise<HTMLImageElement> => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return image;
    };
    const shot = await load(`data:image/png;base64,${encoded}`);
    const atlas = await load("assets/critters/frog/frog.png");
    const scale = shot.naturalWidth / window.innerWidth;
    // Compare at the box's own pixel size so the screenshot isn't resampled.
    const size = Math.round(box.width * scale);
    const draw = (image: HTMLImageElement, x: number, y: number, w: number,
      h: number, background: string | null): Uint8ClampedArray => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("no 2d context");
      if (background !== null) {
        context.fillStyle = background;
        context.fillRect(0, 0, size, size);
      }
      context.drawImage(image, x, y, w, h, 0, 0, size, size);
      return context.getImageData(0, 0, size, size).data;
    };
    const rendered = draw(shot, box.x * scale, box.y * scale, box.width * scale,
      box.height * scale, paper);
    const similarity = (frame: { x: number; y: number; w: number; h: number }): number => {
      const alpha = draw(atlas, frame.x, frame.y, frame.w, frame.h, null);
      const expected = draw(atlas, frame.x, frame.y, frame.w, frame.h, paper);
      const solid = (x: number, y: number): boolean => (alpha[(y * size + x) * 4 + 3] ?? 0) > 250;
      let considered = 0;
      let close = 0;
      for (let y = 3; y < size - 3; y += 1) {
        for (let x = 3; x < size - 3; x += 1) {
          let interior = true;
          for (let dy = -3; dy <= 3 && interior; dy += 1)
            for (let dx = -3; dx <= 3 && interior; dx += 1) interior = solid(x + dx, y + dy);
          if (!interior) continue;
          considered += 1;
          const index = (y * size + x) * 4;
          const difference = Math.abs((rendered[index] ?? 0) - (expected[index] ?? 0)) +
            Math.abs((rendered[index + 1] ?? 0) - (expected[index + 1] ?? 0)) +
            Math.abs((rendered[index + 2] ?? 0) - (expected[index + 2] ?? 0));
          if (difference <= 60) close += 1;
        }
      }
      return considered === 0 ? 0 : close / considered;
    };
    return Object.fromEntries(Object.entries(frames)
      .map(([name, frame]) => [name, similarity(frame)]));
  }, { encoded, box, frames: frogFrames, paper });
}

// The calm frame must be the clear best match. Small renders keep fewer of the
// face pixels that tell calm from soothed apart, so their bar is lower: at
// 150 px calm scores about 0.99 against soothed 0.96; at 67 px, 0.89 to 0.87.
function expectCalmFrog(scores: Record<string, number>, floor = .9, margin = .03): void {
  const ranked = Object.entries(scores).sort(([, a], [, b]) => b - a);
  expect(ranked[0]?.[0]).toBe("calm_idle_01");
  expect(ranked[0]?.[1] ?? 0).toBeGreaterThanOrEqual(floor);
  expect((ranked[0]?.[1] ?? 0) - (ranked[1]?.[1] ?? 0)).toBeGreaterThanOrEqual(margin);
}

type Contrast = { label: string; ratio: number; opacity: number };

// Runs in the page: contrast of every visible battle text against the nearest
// opaque background, plus the combined opacity of the text and its ancestors.
function measureContrast(): Contrast[] {
  const channel = (value: number): number => {
    const part = value / 255;
    return part <= .03928 ? part / 12.92 : ((part + .055) / 1.055) ** 2.4;
  };
  const parse = (colour: string): number[] =>
    colour.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const luminance = (colour: string): number => {
    const [red = 0, green = 0, blue = 0] = parse(colour);
    return .2126 * channel(red) + .7152 * channel(green) + .0722 * channel(blue);
  };
  const background = (element: Element): string | null => {
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      const colour = getComputedStyle(node).backgroundColor;
      const alpha = parse(colour)[3] ?? 1;
      if (alpha === 0) continue;
      return alpha === 1 ? colour : null;
    }
    return null;
  };
  const opacity = (element: Element): number => {
    let total = 1;
    for (let node: Element | null = element; node !== null; node = node.parentElement)
      total *= Number(getComputedStyle(node).opacity);
    return total;
  };
  const label = (element: Element): string => {
    const command = element.closest(".battle-command");
    if (command !== null) {
      const state = command.getAttribute("aria-disabled") === "true" ? "disabled"
        : command.getAttribute("aria-selected") === "true" ? "selected" : "normal";
      const part = element.classList.contains("battle-command-detail") ? "detail" : "label";
      return `command ${part} "${element.textContent}" (${state})`;
    }
    if (element.classList.contains("battle-grade")) return `grade "${element.textContent}"`;
    return `${element.className} "${element.textContent}"`;
  };
  const selectors = ".battle-command-label, .battle-command-detail, .battle-meter-label, " +
  ".battle-grade, .battle-check-hint, .battle-feeling-label, .battle-reward-title, " +
    ".battle-reward-name, .journal-label, " +
    ".journal-heading, .journal-supply, .journal-tickets, .journal-note, .journal-empty, " +
    ".journal-name, .journal-unknown, .journal-close";
  return [...document.querySelectorAll(selectors)]
    .filter((element) => element.getClientRects().length > 0)
    .map((element) => {
      const back = background(element);
      const text = luminance(getComputedStyle(element).color);
      const behind = back === null ? text : luminance(back);
      return { label: label(element), opacity: opacity(element),
        ratio: (Math.max(text, behind) + .05) / (Math.min(text, behind) + .05) };
    });
}

type Rect = { x: number; y: number; width: number; height: number };
function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

test.describe("sticker gallery", () => {
  // The claw machine as drawn is its layout (spec 8.2): every plush, the claw,
  // the glass, the chute, and the plate where layoutClaw puts them, from the
  // same real game states, on a phone and a desktop, in both engines. The
  // layout's own geometry is checked in tests/unit/claw-layout.test.ts.
  for (const size of [phone, { width: 1280, height: 720 }]) {
    for (const state of clawGalleryStates) {
      test(`${state} claw machine as laid out ${size.width}x${size.height}`, async ({ page }) => {
        const insets = size.width === 874 ? "0,62,21,62" : "0,0,0,0";
        await gallery(page, state, true, insets, size);
        const drawn = await page.evaluate(() => {
          const box = (element: Element | null): { x: number; y: number; width: number;
            height: number } => {
            if (element === null) throw new Error("missing a part of the claw machine");
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          };
          const layer = (element: Element): number => Number(getComputedStyle(element).zIndex) - 1;
          const machine = document.querySelector<HTMLElement>(".arcade-machine");
          const claw = document.querySelector(".arcade-claw");
          const text = document.querySelector<HTMLElement>(".arcade-plate-text");
          const marker = document.querySelector<HTMLElement>(".arcade-marker");
          if (machine === null || claw === null || text === null)
            throw new Error("the claw machine isn't drawn");
          const shown = (selector: string): Element | null => {
            const element = document.querySelector(selector);
            return element !== null && element.getClientRects().length > 0 ? element : null;
          };
          const reward = shown(".battle-reward");
          const dialogue = shown(".sticker-dialogue");
          const atDialogue = dialogue === null ? null : document.elementFromPoint(
            box(dialogue).x + box(dialogue).width / 2, box(dialogue).y + box(dialogue).height / 2);
          return {
            scale: Number(machine.dataset.scale),
            machine: box(machine),
            glass: box(document.querySelector(".arcade-glass")),
            chute: box(document.querySelector(".arcade-chute")),
            plate: box(document.querySelector(".arcade-plate")),
            text: { box: box(text), fits: text.scrollWidth <= text.clientWidth + 1 },
            claw: { box: box(claw), layer: layer(claw),
              closed: claw.classList.contains("is-closed") },
            marker: marker === null || marker.hidden ? null
              : { box: box(marker), layer: layer(marker) },
            plushes: [...document.querySelectorAll<HTMLElement>(".arcade-plush")].map((item) => ({
              id: item.dataset.id ?? "", box: box(item), layer: layer(item),
              clip: getComputedStyle(item).clipPath, tug: item.classList.contains("is-tug"),
            })),
            reward: reward === null ? null : box(reward),
            dialogue: dialogue === null ? null : box(dialogue),
            dialogueOnTop: dialogue !== null && atDialogue !== null &&
              dialogue.contains(atDialogue),
            buttons: [box(document.querySelector(".touch-confirm")),
              box(document.querySelector(".touch-cancel"))],
          };
        });
        const layout = bunClawLayout(state, drawn.scale);
        const near = (actual: number, expected: number, label: string): void => {
          expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`)
            .toBeLessThanOrEqual(1);
        };
        const placed = (actual: { x: number; y: number; width: number; height: number },
          expected: { x: number; y: number; width: number; height: number }, label: string):
          void => {
          near(actual.x - drawn.machine.x, expected.x, `${label} x`);
          near(actual.y - drawn.machine.y, expected.y, `${label} y`);
          near(actual.width, expected.width, `${label} width`);
          near(actual.height, expected.height, `${label} height`);
        };
        near(drawn.machine.width, layout.width, "cabinet width");
        near(drawn.machine.height, layout.height, "cabinet height");
        placed(drawn.glass, layout.glass, "glass");
        placed(drawn.chute, layout.chute, "chute");
        placed(drawn.plate, layout.plate, "plate");
        expect(drawn.plushes.map((item) => item.id).sort())
          .toEqual(layout.plushes.map((item) => item.id).sort());
        for (const expected of layout.plushes) {
          const actual = drawn.plushes.find((item) => item.id === expected.id);
          if (actual === undefined) throw new Error(`${expected.id} isn't drawn`);
          placed(actual.box, { x: expected.x, y: expected.y, width: expected.size,
            height: expected.size }, expected.id);
          expect(actual.layer, `${expected.id} layer`).toBe(expected.layer);
          expect(actual.tug, `${expected.id} tugged`).toBe(expected.tug);
          // inset(top right bottom left): the bottom is the share gone into the chute.
          const clip = actual.clip.match(/-?[0-9.]+/g)?.map(Number) ?? [];
          near(clip[2] ?? 0, expected.hidden, `${expected.id} hidden`);
        }
        placed(drawn.claw.box, { x: layout.claw.x - Math.round(layout.claw.size / 2),
          y: layout.claw.tip - layout.claw.size, width: layout.claw.size,
          height: layout.claw.size }, "claw");
        expect(drawn.claw.layer, "claw layer").toBe(layout.claw.layer);
        expect(drawn.claw.closed).toBe(!layout.claw.open);
        expect(drawn.marker === null, "marker shown").toBe(layout.marker === null);
        if (drawn.marker !== null && layout.marker !== null) {
          placed(drawn.marker.box, layout.marker, "marker");
          expect(drawn.marker.layer, "marker layer").toBe(layout.marker.layer);
        }
        // The plate's lettering fits on the plate: no line runs over, and the
        // lines sit inside it.
        expect(drawn.text.fits, "plate text fits").toBe(true);
        expect(drawn.text.box.x).toBeGreaterThanOrEqual(drawn.plate.x - 1);
        expect(drawn.text.box.x + drawn.text.box.width)
          .toBeLessThanOrEqual(drawn.plate.x + drawn.plate.width + 1);
        expect(drawn.text.box.y).toBeGreaterThanOrEqual(drawn.plate.y - 1);
        expect(drawn.text.box.y + drawn.text.box.height)
          .toBeLessThanOrEqual(drawn.plate.y + drawn.plate.height + 1);
        // The prize card and the line that reads it out stay clear of each other
        // and of the touch buttons, and the dialogue box is over the cabinet.
        if (state === "arcade-result") {
          if (drawn.reward === null || drawn.dialogue === null)
            throw new Error("the result shows the prize card and the line");
          expect(overlaps(drawn.reward, drawn.dialogue)).toBe(false);
          for (const button of drawn.buttons) {
            expect(overlaps(drawn.reward, button)).toBe(false);
            expect(overlaps(drawn.dialogue, button)).toBe(false);
          }
          expect(drawn.dialogueOnTop).toBe(true);
        }
      });
    }
  }

  // Skee-ball as drawn is its layout (spec 8.2): the frame on the painting,
  // the board, the plate, the score, the target's rings and holes, the arrow,
  // the ghost, the ball, and its points, from the same real game states, on a
  // phone and a desktop, in both engines. The layout's own geometry is checked
  // in tests/unit/skee-layout.test.ts.
  for (const size of [phone, { width: 1280, height: 720 }]) {
    for (const state of skeeGalleryStates) {
      test(`${state} skee-ball as laid out ${size.width}x${size.height}`, async ({ page }) => {
        const insets = size.width === 874 ? "0,62,21,62" : "0,0,0,0";
        await gallery(page, state, true, insets, size);
        const drawn = await page.evaluate(() => {
          const box = (element: Element | Range | null): { x: number; y: number;
            width: number; height: number } => {
            if (element === null) throw new Error("missing a part of skee-ball");
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          };
          const shown = (selector: string): HTMLElement | null => {
            const element = document.querySelector<HTMLElement>(selector);
            return element !== null && element.getClientRects().length > 0 ? element : null;
          };
          const machine = document.querySelector<HTMLElement>(".skee-machine");
          const text = document.querySelector<HTMLElement>(".skee-plate-text");
          if (machine === null || text === null) throw new Error("skee-ball isn't drawn");
          // The lettering's own glyphs, not its box (letter spacing trails past
          // a box's edge).
          const range = document.createRange();
          range.selectNodeContents(text);
          const glyphs = box(range);
          const number = (element: Element, name: string): number =>
            Number(element.getAttribute(name));
          const ellipses = (selector: string): { cx: number; cy: number; rx: number;
            ry: number; lit: boolean }[] =>
            [...document.querySelectorAll(selector)].map((item) => ({
              cx: number(item, "cx"), cy: number(item, "cy"), rx: number(item, "rx"),
              ry: number(item, "ry"), lit: item.classList.contains("is-lit"),
            }));
          const arrow = document.querySelector<SVGElement>(".skee-arrow:not(.is-hidden)");
          const ghost = shown(".skee-ghost");
          const ball = shown(".skee-ball");
          const pop = shown(".skee-pop");
          const hud = shown(".skee-hud");
          const dialogue = shown(".sticker-dialogue");
          const atDialogue = dialogue === null ? null : document.elementFromPoint(
            box(dialogue).x + box(dialogue).width / 2,
            box(dialogue).y + box(dialogue).height / 2);
          return {
            scale: Number(machine.dataset.scale),
            machine: box(machine),
            frame: box(document.querySelector(".skee-frame")),
            target: box(document.querySelector(".skee-target")),
            board: box(document.querySelector(".skee-board")),
            plate: box(document.querySelector(".skee-plate")),
            text: glyphs,
            hud: hud === null ? null : box(hud),
            rings: ellipses(".skee-ring"),
            corners: ellipses(".skee-corner"),
            arrow: arrow === null ? null : {
              left: Number.parseFloat(arrow.style.left),
              top: Number.parseFloat(arrow.style.top),
              width: Number.parseFloat(arrow.style.width),
              height: Number.parseFloat(arrow.style.height),
              set: arrow.classList.contains("is-set"),
            },
            ghost: ghost === null ? null
              : { box: box(ghost), over: ghost.classList.contains("is-over") },
            ball: ball === null ? null : box(ball),
            pop: pop === null ? null : {
              left: Number.parseFloat(pop.style.left),
              top: Number.parseFloat(pop.style.top),
              text: pop.textContent ?? "",
            },
            dialogue: dialogue === null ? null : box(dialogue),
            dialogueOnTop: dialogue !== null && atDialogue !== null &&
              dialogue.contains(atDialogue),
            buttons: [box(document.querySelector(".touch-confirm")),
              box(document.querySelector(".touch-cancel")),
              box(document.querySelector(".touch-menu"))],
          };
        });
        const layout = bunSkeeLayout(state, drawn.scale);
        const near = (actual: number, expected: number, label: string): void => {
          expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`)
            .toBeLessThanOrEqual(1);
        };
        const origin = { x: drawn.machine.x, y: drawn.machine.y };
        const placed = (actual: Rect, expected: Rect, label: string): void => {
          near(actual.x - origin.x, expected.x, `${label} x`);
          near(actual.y - origin.y, expected.y, `${label} y`);
          near(actual.width, expected.width, `${label} width`);
          near(actual.height, expected.height, `${label} height`);
        };
        const disc = (point: { x: number; y: number; radius: number }): Rect => ({
          x: point.x - point.radius, y: point.y - point.radius,
          width: 2 * point.radius, height: 2 * point.radius,
        });
        near(drawn.machine.width, layout.width, "painting width");
        near(drawn.machine.height, layout.height, "painting height");
        placed(drawn.frame, layout.frame, "frame");
        placed(drawn.target, { x: 0, y: 0, width: layout.width, height: layout.height },
          "target");
        placed(drawn.board, layout.board, "board");
        placed(drawn.plate, layout.plate, "plate");
        expect(drawn.hud === null, "score shown").toBe(state === "skee-result");
        if (drawn.hud !== null) {
          near(drawn.hud.x - origin.x, layout.hud.x, "score x");
          near(drawn.hud.y - origin.y, layout.hud.y, "score y");
        }
        // The target: every ring and hole where the layout puts it, lit as it says.
        const targets: [typeof drawn.rings, typeof layout.rings][] =
          [[drawn.rings, layout.rings], [drawn.corners, layout.corners]];
        for (const [actual, expected] of targets) {
          expect(actual).toHaveLength(expected.length);
          actual.forEach((item, index) => {
            const want = expected[index];
            if (want === undefined) throw new Error("a target is missing");
            expect(item).toEqual({ cx: want.cx, cy: want.cy, rx: want.rx, ry: want.ry,
              lit: want.lit });
          });
        }
        // The arrow, the ghost, the ball, and the points: shown when the layout
        // has them, where it puts them.
        expect(drawn.arrow === null, "arrow shown").toBe(layout.arrow === null);
        if (drawn.arrow !== null && layout.arrow !== null) {
          near(drawn.arrow.left + drawn.arrow.width / 2, layout.arrow.x, "arrow x");
          near(drawn.arrow.top + drawn.arrow.height, layout.arrow.y, "arrow y");
          near(drawn.arrow.height, layout.arrow.length, "arrow length");
          expect(drawn.arrow.set).toBe(layout.arrow.set);
        }
        expect(drawn.ghost === null, "ghost shown").toBe(layout.ghost === null);
        if (drawn.ghost !== null && layout.ghost !== null) {
          placed(drawn.ghost.box, disc(layout.ghost), "ghost");
          expect(drawn.ghost.over).toBe(layout.ghost.over);
        }
        expect(drawn.ball === null, "ball shown").toBe(layout.ball === null);
        if (drawn.ball !== null && layout.ball !== null)
          placed(drawn.ball, disc(layout.ball), "ball");
        expect(drawn.pop === null, "points shown").toBe(layout.pop === null);
        if (drawn.pop !== null && layout.pop !== null) {
          near(drawn.pop.left, layout.pop.x, "points x");
          near(drawn.pop.top, layout.pop.y, "points y");
          expect(drawn.pop.text).toBe(`+${layout.pop.points}`);
        }
        // The lettering fits on the plate, and the close-up stays clear of the
        // touch buttons; in the result, the line reads over it.
        expect(drawn.text.width, "the plate is lettered").toBeGreaterThan(0);
        expect(drawn.text.x).toBeGreaterThanOrEqual(drawn.plate.x - 1);
        expect(drawn.text.x + drawn.text.width)
          .toBeLessThanOrEqual(drawn.plate.x + drawn.plate.width + 1);
        expect(drawn.text.y).toBeGreaterThanOrEqual(drawn.plate.y - 1);
        expect(drawn.text.y + drawn.text.height)
          .toBeLessThanOrEqual(drawn.plate.y + drawn.plate.height + 1);
        for (const button of drawn.buttons) expect(overlaps(drawn.frame, button)).toBe(false);
        if (state === "skee-result") {
          if (drawn.dialogue === null) throw new Error("the result line isn't shown");
          expect(drawn.dialogueOnTop).toBe(true);
          for (const button of drawn.buttons)
            expect(overlaps(drawn.dialogue, button)).toBe(false);
        }
      });
    }
  }

  // Boop-a-Mole as drawn is its layout (spec 8.2): the shown part of the
  // painting, the plate, the score, each hole's box and clip, its mole and
  // face, the hammer, and Boop!, from the same real round's states, on a phone
  // (touch: the holes are the targets, so no keys) and a desktop (the keys),
  // in both engines. The layout's own geometry is checked in
  // tests/unit/mole-layout.test.ts.
  for (const size of [phone, { width: 1280, height: 720 }]) {
    for (const state of moleGalleryStates) {
      test(`${state} Boop-a-Mole as laid out ${size.width}x${size.height}`, async ({ page }) => {
        const touch = size.width === 874;
        await gallery(page, state, touch, touch ? "0,62,21,62" : "0,0,0,0", size);
        const drawn = await page.evaluate(() => {
          const box = (element: Element | null): { x: number; y: number; width: number;
            height: number } => {
            if (element === null) throw new Error("missing a part of Boop-a-Mole");
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          };
          const shown = (element: Element | null): boolean =>
            element !== null && element.getClientRects().length > 0;
          const machine = document.querySelector<HTMLElement>(".mole-machine");
          const paint = document.querySelector<HTMLElement>(".mole-paint");
          if (machine === null || paint === null) throw new Error("Boop-a-Mole isn't drawn");
          const hud = document.querySelector(".mole-hud");
          const hammer = document.querySelector<SVGElement>(".mole-hammer:not(.is-hidden)");
          const pop = document.querySelector<HTMLElement>(".mole-pop");
          const dialogue = document.querySelector(".sticker-dialogue");
          const at = dialogue !== null && shown(dialogue) ? document.elementFromPoint(
            box(dialogue).x + box(dialogue).width / 2,
            box(dialogue).y + box(dialogue).height / 2) : null;
          return {
            scale: Number(machine.dataset.scale),
            machine: box(machine),
            background: { size: paint.style.backgroundSize,
              position: paint.style.backgroundPosition },
            plate: box(document.querySelector(".mole-plate")),
            hud: shown(hud) ? box(hud) : null,
            holes: [...document.querySelectorAll<HTMLElement>(".mole-hole")].map((hole) => {
              const sprite = hole.querySelector<HTMLElement>(".mole-sprite");
              return {
                hole: hole.dataset.hole ?? "", box: box(hole), clip: hole.style.clipPath,
                mole: sprite === null || !shown(sprite) ? null
                  : { face: sprite.dataset.face ?? "", transform: sprite.style.transform },
              };
            }),
            keys: [...document.querySelectorAll<HTMLElement>(".mole-key")].map((key) => ({
              text: key.textContent ?? "", shown: shown(key),
              box: shown(key) ? box(key) : null,
            })),
            hits: [...document.querySelectorAll(".mole-hit")].map((hit) => box(hit)),
            hammer: hammer === null ? null : {
              left: Number.parseFloat(hammer.style.left),
              top: Number.parseFloat(hammer.style.top),
              width: Number.parseFloat(hammer.style.width),
            },
            pop: pop === null || !shown(pop) ? null : {
              left: Number.parseFloat(pop.style.left), top: Number.parseFloat(pop.style.top),
            },
            dialogue: dialogue !== null && shown(dialogue) ? box(dialogue) : null,
            dialogueOnTop: dialogue !== null && at !== null && dialogue.contains(at),
            buttons: [...document.querySelectorAll(".touch-confirm, .touch-cancel, .touch-menu")]
              .filter((button) => shown(button)).map((button) => box(button)),
          };
        });
        const layout = bunMoleLayout(state, drawn.scale);
        const near = (actual: number, expected: number, label: string): void => {
          expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`)
            .toBeLessThanOrEqual(1);
        };
        const origin = { x: drawn.machine.x, y: drawn.machine.y };
        const placed = (actual: Rect, expected: Rect, label: string): void => {
          near(actual.x - origin.x, expected.x, `${label} x`);
          near(actual.y - origin.y, expected.y, `${label} y`);
          near(actual.width, expected.width, `${label} width`);
          near(actual.height, expected.height, `${label} height`);
        };
        near(drawn.machine.width, layout.width, "shown width");
        near(drawn.machine.height, layout.height, "shown height");
        expect(drawn.background).toEqual({
          size: `${layout.painting.width}px ${layout.painting.height}px`,
          position: `0px ${layout.painting.y}px`,
        });
        placed(drawn.plate, layout.plate, "plate");
        expect(drawn.hud === null, "score shown").toBe(state === "mole-result");
        if (drawn.hud !== null) {
          near(drawn.hud.x + drawn.hud.width - origin.x, layout.hud.x, "score's right edge");
          near(drawn.hud.y - origin.y, layout.hud.y, "score y");
        }
        // Every hole where the layout puts it, clipped as it says, its mole (or
        // none) with its face, sunk as far as it says.
        expect(drawn.holes.map((item) => item.hole)).toEqual(layout.holes.map((item) =>
          item.hole));
        layout.holes.forEach((want, index) => {
          const item = drawn.holes[index];
          if (item === undefined) throw new Error(`hole ${want.hole} isn't drawn`);
          placed(item.box, want.box, `${want.hole} box`);
          // Browsers read a path back with their own spacing.
          const bare = (text: string): string => text.replace(/\s+/g, "");
          expect(bare(item.clip)).toBe(bare(`path("${want.clip}")`));
          expect(item.mole === null, `${want.hole} mole shown`).toBe(want.mole === null);
          if (item.mole !== null && want.mole !== null) {
            expect(item.mole.face).toBe(want.mole.face);
            expect(item.mole.transform).toBe(`translateY(${want.mole.drop}px)`);
          }
          // Its tap target: centred on the hole, at least 48 px each way.
          const hit = drawn.hits[index];
          if (hit === undefined) throw new Error(`hole ${want.hole} has no target`);
          near(hit.x + hit.width / 2 - origin.x, want.cx, `${want.hole} target x`);
          near(hit.y + hit.height / 2 - origin.y, want.cy, `${want.hole} target y`);
          expect(Math.min(hit.width, hit.height)).toBeGreaterThanOrEqual(48);
          // Its key: shown with a keyboard, just left of the hole; not on touch.
          const key = drawn.keys[index];
          if (key === undefined) throw new Error(`hole ${want.hole} has no key`);
          expect(key.text).toBe(want.key.label);
          expect(key.shown, `${want.hole} key shown`).toBe(!touch);
          if (key.box !== null) {
            near(key.box.x + key.box.width - origin.x, want.key.x, `${want.hole} key x`);
            near(key.box.y + key.box.height / 2 - origin.y, want.key.y, `${want.hole} key y`);
          }
        });
        expect(drawn.hammer === null, "hammer shown").toBe(layout.hammer === null);
        if (drawn.hammer !== null && layout.hammer !== null) {
          near(drawn.hammer.left + Math.round(drawn.hammer.width * 0.4), layout.hammer.x,
            "hammer x");
          near(drawn.hammer.top + Math.round(drawn.hammer.width * 0.76), layout.hammer.y,
            "hammer y");
          near(drawn.hammer.width, layout.hammer.length, "hammer size");
        }
        expect(drawn.pop === null, "Boop! shown").toBe(layout.pop === null);
        if (drawn.pop !== null && layout.pop !== null) {
          near(drawn.pop.left, layout.pop.x, "Boop! x");
          near(drawn.pop.top, layout.pop.y, "Boop! y");
        }
        // Clear of the touch buttons; in the result, the line reads over it.
        for (const button of drawn.buttons)
          expect(overlaps(drawn.machine, button)).toBe(false);
        if (state === "mole-result") {
          if (drawn.dialogue === null) throw new Error("the result line isn't shown");
          expect(drawn.dialogueOnTop).toBe(true);
          for (const button of drawn.buttons)
            expect(overlaps(drawn.dialogue, button)).toBe(false);
        }
      });
    }
  }

  // The clubhouse microwave (spec 8.2), from the same real game states, on a
  // phone and a desktop, in both engines: the microwave in the safe area and
  // clear of the touch buttons, the glass in it, the timer's and the hint's
  // glyphs inside their boxes, and in a result, the line over it all. The
  // layout's own geometry is checked in tests/unit/cook-layout.test.ts.
  for (const size of [phone, { width: 1280, height: 720 }]) {
    for (const state of cookGalleryStates) {
      test(`${state} microwave as laid out ${size.width}x${size.height}`, async ({ page }) => {
        const insets = size.width === 874 ? "0,62,21,62" : "0,0,0,0";
        await gallery(page, state, true, insets, size);
        const drawn = await page.evaluate(() => {
          const box = (element: Element | Range | null): { x: number; y: number;
            width: number; height: number } => {
            if (element === null) throw new Error("missing a part of the microwave");
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          };
          const glyphs = (selector: string): ReturnType<typeof box> | null => {
            const node = document.querySelector(selector);
            if (node === null || node.getClientRects().length === 0) return null;
            const range = document.createRange();
            range.selectNodeContents(node);
            return box(range);
          };
          const dialogue = document.querySelector(".sticker-dialogue");
          const shownDialogue = dialogue !== null && dialogue.getClientRects().length > 0
            ? dialogue : null;
          const atDialogue = shownDialogue === null ? null : document.elementFromPoint(
            box(shownDialogue).x + box(shownDialogue).width / 2,
            box(shownDialogue).y + box(shownDialogue).height / 2);
          return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            machine: box(document.querySelector(".cook-machine")),
            glass: box(document.querySelector(".cook-glass")),
            display: box(document.querySelector(".cook-display")),
            displayText: glyphs(".cook-display"),
            front: box(document.querySelector(".cook-front")),
            frontText: glyphs(".cook-front-text"),
            dialogue: shownDialogue === null ? null : box(shownDialogue),
            dialogueOnTop: shownDialogue !== null && atDialogue !== null &&
              shownDialogue.contains(atDialogue),
            buttons: [box(document.querySelector(".touch-confirm")),
              box(document.querySelector(".touch-cancel")),
              box(document.querySelector(".touch-menu"))],
          };
        });
        type Rect = { x: number; y: number; width: number; height: number };
        const within = (inner: Rect, outer: Rect, label: string): void => {
          expect(inner.x, `${label} left`).toBeGreaterThanOrEqual(outer.x - 0.5);
          expect(inner.y, `${label} top`).toBeGreaterThanOrEqual(outer.y - 0.5);
          expect(inner.x + inner.width, `${label} right`)
            .toBeLessThanOrEqual(outer.x + outer.width + 0.5);
          expect(inner.y + inner.height, `${label} bottom`)
            .toBeLessThanOrEqual(outer.y + outer.height + 0.5);
        };
        within(drawn.machine, { x: 0, y: 0, ...drawn.viewport }, "the microwave");
        within(drawn.glass, drawn.machine, "the glass");
        if (drawn.displayText === null) throw new Error("the timer isn't shown");
        within(drawn.displayText, drawn.display, "the timer's digits");
        const result = state === "cook-result" || state === "cook-burnt";
        if (!result) {
          if (drawn.frontText === null) throw new Error("the hint isn't shown");
          within(drawn.frontText, drawn.front, "the hint's glyphs");
          expect(drawn.frontText.height, "the hint's size").toBeGreaterThanOrEqual(9);
        }
        for (const button of drawn.buttons)
          expect(overlaps(drawn.machine, button)).toBe(false);
        if (result) {
          if (drawn.dialogue === null) throw new Error("the result line isn't shown");
          expect(drawn.dialogueOnTop).toBe(true);
          for (const button of drawn.buttons)
            expect(overlaps(drawn.dialogue, button)).toBe(false);
        } else expect(drawn.dialogue).toBeNull();
      });
    }
  }

  for (const state of journalStates) {
    test(`${state} journal baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const size of sizes) {
    for (const state of journalStates) {
      test(`${state} journal geometry ${size.width}x${size.height}`, async ({ page }) => {
        const insets = size.width === 874 ? "0,62,21,62" :
          size.width === 1180 ? "0,0,20,0" : "0,0,0,0";
        await page.setViewportSize(size);
        await page.goto(`/cloverhollow/ui-gallery.html?state=${state}&touch=1&insets=${insets}`);
        await page.evaluate(() => document.fonts.ready);
        const facts = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement);
          const safe = (name: string): number => parseFloat(style.getPropertyValue(name)) || 0;
          const rect = (selector: string): DOMRect | undefined =>
            document.querySelector(selector)?.getBoundingClientRect();
          const book = rect(".journal-book");
          const close = rect(".journal-close");
          const label = rect(".journal-label");
          const notes = rect(".journal-notes-page");
          const headingControls = [...document.querySelectorAll(
            ".journal-notes-head .journal-heading, .journal-supply, .journal-audio, " +
              ".journal-volume",
          )]
            .map((element) => element.getBoundingClientRect());
          const album = rect(".journal-stickers-page");
          if (!book || !close || !label || !notes || !album) return null;
          const within = (inner: DOMRect, outer: DOMRect): boolean =>
            inner.left >= outer.left && inner.right <= outer.right &&
            inner.top >= outer.top && inner.bottom <= outer.bottom;
          const headingInside = (inner: DOMRect, outer: DOMRect): boolean =>
            inner.left >= outer.left + 4 && inner.right <= outer.right - 4 &&
            inner.top >= outer.top && inner.bottom <= outer.bottom;
          const centre = document.elementFromPoint(book.left + book.width / 2,
            book.top + book.height / 2);
          return {
            bookInside: book.left >= 20 + safe("--safe-left") &&
              book.right <= innerWidth - 20 - safe("--safe-right") &&
              book.top >= safe("--safe-top") &&
              book.bottom <= innerHeight - safe("--safe-bottom"),
            labelOnScreen: label.top >= safe("--safe-top") && label.left >= book.left,
            closeSize: Math.min(close.width, close.height),
            closeInside: within(close, book),
            pagesApart: notes.right <= album.left + 1,
            headingControlsInside: headingControls.every((item) => headingInside(item, notes)),
            onTop: centre?.closest(".journal-book") !== null,
          };
        });
        expect(facts).not.toBeNull();
        expect(facts?.bookInside).toBe(true);
        expect(facts?.labelOnScreen).toBe(true);
        expect(facts?.closeSize ?? 0).toBeGreaterThanOrEqual(44);
        expect(facts?.closeInside).toBe(true);
        expect(facts?.pagesApart).toBe(true);
        expect(facts?.headingControlsInside,
          "notes heading controls stay inside the notes page").toBe(true);
        expect(facts?.onTop, "nothing covers the open journal").toBe(true);
      });
    }
  }

  test("a phone's album scrolls to its last sticker slot", async ({ page }) => {
    await page.setViewportSize({ width: 874, height: 402 });
    await page.goto("/cloverhollow/ui-gallery.html?state=journal-notes&touch=1&insets=0,62,21,62");
    await page.evaluate(() => document.fonts.ready);
    // The album's own slots, not the PRIZES shelf's below it.
    const album = page.locator(".journal-stickers-page");
    const last = page.locator(".journal-stickers:not(.journal-prizes) .journal-slot").last();
    await last.scrollIntoViewIfNeeded();
    const facts = await album.evaluate((element) => {
      const slot = element.querySelector(
        ".journal-stickers:not(.journal-prizes) .journal-slot:last-child")?.getBoundingClientRect();
      const page = element.getBoundingClientRect();
      return { scrolls: ["auto", "scroll"].includes(getComputedStyle(element).overflowY),
        inside: slot !== undefined && slot.bottom <= page.bottom + 1 && slot.top >= page.top - 1 };
    });
    expect(facts).toEqual({ scrolls: true, inside: true });
  });

  test("the notes page scrolls only when the notes overflow", async ({ page }) => {
    const overflow = async (state: string): Promise<boolean> => {
      await gallery(page, state);
      return page.locator(".journal-notes-page").evaluate((element) =>
        element.scrollHeight > element.clientHeight &&
        ["auto", "scroll"].includes(getComputedStyle(element).overflowY));
    };
    expect(await overflow("journal-full")).toBe(true);
    expect(await overflow("journal-notes")).toBe(false);
    await expect(page.locator(".journal-note")).toHaveCount(5);
    await expect(page.locator(".journal-empty")).toBeHidden();
    await gallery(page, "journal-empty");
    await expect(page.locator(".journal-note")).toHaveCount(0);
    await expect(page.locator(".journal-empty")).toHaveText("Nothing yet. Look around!");
  });

  test("the album shows the owned frog and dashed ? slots for the rest", async ({ page }) => {
    await gallery(page, "journal-notes");
    const owned = page.locator(
      '.journal-stickers:not(.journal-prizes) .journal-slot[data-owned="true"]');
    await expect(owned).toHaveCount(1);
    await expect(owned.locator(".journal-name")).toHaveText("Fountain Frog");
    await expect(owned.locator(".journal-unknown")).toBeHidden();
    const unknown = page.locator(
      '.journal-stickers:not(.journal-prizes) .journal-slot[data-owned="false"] .journal-unknown');
    await expect(unknown).toHaveCount(10);
    for (const slot of await unknown.all()) {
      await expect(slot).toBeVisible();
      await expect(slot).toHaveText("?");
      expect(await slot.evaluate((element) => getComputedStyle(element).borderStyle))
        .toBe("dashed");
    }
    const names = page.locator(
      '.journal-stickers:not(.journal-prizes) .journal-slot[data-owned="false"] .journal-name');
    await expect(names).toHaveCount(10);
    for (const name of await names.all())
      await expect(name).toBeHidden();
    const box = await owned.locator(".journal-sticker-image")
      .evaluate((element) => element.getBoundingClientRect().toJSON());
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
    const scores = await frogFrameScores(page, box, "#fbf6e9");
    console.log(`journal sticker similarity ${JSON.stringify(scores)}`);
    expectCalmFrog(scores, .85, .01);
  });

  test("the close button calls onClose by touch and by click", async ({ browser }) => {
    const context = await browser.newContext({ viewport: phone, deviceScaleFactor: 2,
      hasTouch: true });
    const page = await context.newPage();
    await gallery(page, "journal-notes");
    await expect(page.locator("#gallery")).not.toHaveAttribute("data-journal-closed", "true");
    const close = await page.locator(".journal-close").boundingBox();
    if (close === null) throw new Error("close button is not visible");
    await page.touchscreen.tap(close.x + close.width / 2, close.y + close.height / 2);
    await expect(page.locator("#gallery")).toHaveAttribute("data-journal-closed", "true");
    await context.close();
    const desktop = await browser.newPage();
    await gallery(desktop, "journal-notes");
    await desktop.locator(".journal-close").click();
    await expect(desktop.locator("#gallery")).toHaveAttribute("data-journal-closed", "true");
    await desktop.close();
  });

  test("the menu button is the journal sticker", async ({ page }) => {
    await gallery(page, "short");
    const menu = page.locator(".touch-menu");
    await expect(menu).toHaveAttribute("aria-label", "journal");
    await expect(menu.locator("svg path.journal-icon-page")).toHaveCount(2);
    await expect(menu.locator("svg path.journal-icon-quill")).toHaveCount(1);
  });

  test("journal text pairs meet contrast targets", async ({ page }) => {
    const results: Contrast[] = [];
    for (const state of ["journal-empty", "journal-notes"]) {
      await gallery(page, state);
      results.push(...(await page.evaluate(measureContrast))
        .filter((result) => result.label.includes("journal")));
    }
    for (const result of results)
      console.log(`${result.label}: ${result.ratio.toFixed(2)}:1, opacity ${result.opacity}`);
    expect(results.length).toBeGreaterThanOrEqual(12);
    for (const result of results) {
      expect(result.ratio, result.label).toBeGreaterThanOrEqual(4.5);
      expect(result.opacity, result.label).toBe(1);
    }
  });

  test("identical journal renders do not churn DOM nodes", async ({ page }) => {
    for (const state of journalStates) {
      await gallery(page, state);
      const records = await page.evaluate(() => {
        const observer = new MutationObserver(() => undefined);
        const book = document.querySelector(".journal-book");
        if (book === null) return -1;
        observer.observe(book, { childList: true, characterData: true, subtree: true });
        window.__stickerGallery.renderState();
        window.__stickerGallery.renderState();
        const changes = observer.takeRecords().length;
        observer.disconnect();
        return changes;
      });
      expect(records, state).toBe(0);
    }
  });

  for (const state of states) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled",
        scale: "device",
      });
    });
  }

  for (const state of battleStates) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const state of clawGalleryStates) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const state of skeeGalleryStates) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const state of moleGalleryStates) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const state of cookGalleryStates) {
    test(`${state} phone visual baseline`, async ({ page }) => {
      await gallery(page, state);
      await expect(page).toHaveScreenshot(`${state}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const state of ["arcade-ready", "arcade-result", "skee-aiming", "skee-result", "mole-up",
    "mole-result", "cook-ready", "cook-result"]) {
    test(`${state} desktop visual baseline`, async ({ page }) => {
      await gallery(page, state, false, "0,0,0,0", { width: 1280, height: 720 });
      await expect(page).toHaveScreenshot(`${state}-desktop.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }
  for (const [name, size, insets] of [
    ["phone", phone, "0,62,21,62"],
    ["desktop", { width: 1280, height: 720 }, "0,0,0,0"],
  ] as const) {
    test(`journal prizes shelf ${name} screenshot`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`/cloverhollow/ui-gallery.html?state=journal-prizes&touch=1&` +
        `insets=${insets}`);
      await page.evaluate(() => document.fonts.ready);
      await page.locator(".journal-prizes").scrollIntoViewIfNeeded();
      await expect(page).toHaveScreenshot(`journal-prizes-${name}.png`, {
        animations: "disabled", scale: "device",
      });
    });
  }

  for (const size of sizes) {
    for (const state of battleStates) {
      test(`${state} battle geometry ${size.width}x${size.height}`, async ({ page }) => {
        const insets = size.width === 874 ? "0,62,21,62" :
          size.width === 1180 ? "0,0,20,0" : "0,0,0,0";
        await page.setViewportSize(size);
        await page.goto(`/cloverhollow/ui-gallery.html?state=${state}&touch=1&insets=${insets}`);
        await page.evaluate(() => document.fonts.ready);
        const facts = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement);
          const safeLeft = parseFloat(style.getPropertyValue("--safe-left")) || 0;
          const safeRight = parseFloat(style.getPropertyValue("--safe-right")) || 0;
          const safeTop = parseFloat(style.getPropertyValue("--safe-top")) || 0;
          const safeBottom = parseFloat(style.getPropertyValue("--safe-bottom")) || 0;
          const inside = (rect: DOMRect): boolean => rect.left >= 20 + safeLeft &&
            rect.right <= innerWidth - 20 - safeRight && rect.top >= safeTop &&
            rect.bottom <= innerHeight - 20 - safeBottom;
          const hud = [...document.querySelectorAll<HTMLElement>(".battle-meter")]
            .filter((item) => item.getClientRects().length > 0);
          const menu = document.querySelector<HTMLElement>(".touch-menu");
          const dialogue = document.querySelector<HTMLElement>(".sticker-dialogue");
          const commands = [...document.querySelectorAll<HTMLElement>(".battle-command")]
            .filter((item) => item.getBoundingClientRect().width > 0);
          const choices = [...document.querySelectorAll<HTMLElement>(".sticker-choice")]
            .filter((item) => item.getBoundingClientRect().width > 0);
          const controls = [...document.querySelectorAll<HTMLElement>(
            ".touch-confirm, .touch-cancel, .touch-menu")];
          const intersects = (a: DOMRect, b: DOMRect): boolean =>
            a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          const commandRects = commands.map((item) => item.getBoundingClientRect());
          const hudRects = hud.map((item) => item.getBoundingClientRect());
          const choiceRects = choices.map((item) => item.getBoundingClientRect());
          const grade = document.querySelector<HTMLElement>(".battle-grade");
          const gradeRect = grade === null || grade.hidden ? null : grade.getBoundingClientRect();
          return { hudInside: hud.every((item) => inside(item.getBoundingClientRect())),
            commandHudOverlap: commandRects.some((rect) =>
              hudRects.some((meter) => intersects(rect, meter))),
            gradeInside: gradeRect === null || inside(gradeRect),
            gradeHudOverlap: gradeRect !== null &&
              hudRects.some((meter) => intersects(gradeRect, meter)),
            hudMenuOverlap: menu !== null && hud.some((item) => intersects(
              item.getBoundingClientRect(), menu.getBoundingClientRect())),
            commandInside: commandRects.length === 0 || commandRects.every(inside),
             commandOverlap: commandRects.some((rect) => controls.some((button) =>
               intersects(rect, button.getBoundingClientRect()))),
             choicesInside: choices.length === 0 || choiceRects.every(inside),
             choicesTouchSized: choiceRects.every((rect) => rect.height >= 44),
              choicesClear: choiceRects.every((rect) => !controls.some((button) =>
                intersects(rect, button.getBoundingClientRect()))),
              choicesHudClear: choiceRects.every((rect) =>
                !hudRects.some((meter) => intersects(rect, meter))),
             dialogueOverlap: dialogue !== null && !dialogue.hidden && commandRects.some((rect) =>
              intersects(rect, dialogue.getBoundingClientRect())),
            stickHidden: getComputedStyle(document.querySelector(".touch-stick") ??
              document.body).display === "none",
            rewardInside: (() => {
              const card = document.querySelector<HTMLElement>(".battle-reward");
              return card === null || card.hidden || inside(card.getBoundingClientRect());
            })(),
          };
        });
        expect(facts.hudInside).toBe(true);
        expect(facts.hudMenuOverlap).toBe(false);
        expect(facts.commandHudOverlap).toBe(false);
        expect(facts.gradeInside).toBe(true);
        expect(facts.gradeHudOverlap).toBe(false);
        expect(facts.commandInside).toBe(true);
        expect(facts.commandOverlap).toBe(false);
        if (state === "battle-talk") {
          expect(facts.choicesInside).toBe(true);
          expect(facts.choicesTouchSized).toBe(true);
          expect(facts.choicesClear).toBe(true);
          expect(facts.choicesHudClear).toBe(true);
        }
        expect(facts.dialogueOverlap).toBe(false);
        expect(facts.stickHidden).toBe(true);
        expect(facts.rewardInside).toBe(true);
      });
    }
  }

  for (const [state, shown] of Object.entries(battleParts)) {
    test(`${state} shows exactly its parts`, async ({ page }) => {
      await gallery(page, state);
      const visible = state.startsWith("journal-") ? shown : [...shown, ...touchButtonsShown];
      for (const part of allBattleParts) {
        if (visible.includes(part)) await expect(page.locator(part), part).toBeVisible();
        else await expect(page.locator(part), part).toBeHidden();
      }
      if (state === "battle-command") {
        await expect(page.locator(".sticker-speaker")).toBeHidden();
        await expect(page.locator(".sticker-text-revealed")).toHaveText("What should Fae do?");
      }
    });
  }

  for (const ring of rings) {
    test(`${ring.state} draws its ring at the requested point`, async ({ page }) => {
      await gallery(page, ring.state);
      const centre = await page.locator(".battle-ring").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      expect(Math.abs(centre.x - ring.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(centre.y - ring.y)).toBeLessThanOrEqual(1);
      const circle = (radius: number): { x: number; y: number }[] =>
        Array.from({ length: 24 }, (_, index) => ({
          x: ring.x + Math.cos(index * Math.PI / 12) * radius,
          y: ring.y + Math.sin(index * Math.PI / 12) * radius,
        }));
      const pixels = await samplePixels(page, [
        ...circle(ring.radius * (1 - ring.progress)),
        ...circle(ring.radius * (1 - ring.target)),
      ]);
      const dark = (items: Rgb[]): number =>
        items.filter(([red, green, blue]) => red + green + blue < 300).length;
      const ringDark = dark(pixels.slice(0, 24));
      const targetDark = dark(pixels.slice(24));
      console.log(`${ring.state}: ring ${ringDark}/24 dark, target ${targetDark}/24 dark`);
      expect(ringDark).toBeGreaterThanOrEqual(18);
      expect(targetDark).toBeGreaterThanOrEqual(9);
    });
  }

  test("the grade sticker sits centred just above the target circle", async ({ page }) => {
    await gallery(page, "battle-grade");
    const grade = page.locator(".battle-grade");
    await expect(grade).toHaveText("GREAT!");
    const box = await grade.evaluate((element) => element.getBoundingClientRect().toJSON());
    const targetTop = 170 - 74 * (1 - .65);
    expect(Math.abs(box.x + box.width / 2 - 600)).toBeLessThanOrEqual(1);
    expect(box.bottom).toBeLessThanOrEqual(targetTop);
    expect(box.bottom).toBeGreaterThanOrEqual(targetTop - 10);
    const [fill] = await samplePixels(page, [{ x: box.x + 10, y: box.y + box.height / 2 }]);
    const green: Rgb = [162, 206, 143];
    const distance = fill === undefined ? Infinity :
      fill.reduce((total, value, index) => total + Math.abs(value - (green[index] ?? 0)), 0);
    console.log(`grade fill ${fill?.join(",")}, distance from --sticker-green ${distance}`);
    expect(distance).toBeLessThanOrEqual(24);
  });

  test("the reward card shows the calm frog with a silhouette rim", async ({ page }) => {
    await gallery(page, "battle-reward");
    const box = await page.locator(".battle-reward-image")
      .evaluate((element) => element.getBoundingClientRect().toJSON());
    expect(box.width).toBe(150);
    expect(box.height).toBe(150);
    const scores = await frogFrameScores(page, box, "#f7f2e3");
    console.log(`reward similarity ${JSON.stringify(scores)}`);
    expectCalmFrog(scores);
    // The rim dilates the alpha by 3 px and the ink by 1.5 px more, so 3.75 px
    // outside the box corners is ink if the outline follows the box and card
    // paper if it hugs the frog.
    const corners = await samplePixels(page, [
      { x: box.x - 3.75, y: box.y + 10 }, { x: box.x + 10, y: box.y - 3.75 },
      { x: box.right + 3.75, y: box.y + 10 }, { x: box.right - 10, y: box.y - 3.75 },
    ]);
    for (const [red, green, blue] of corners)
      expect(red + green + blue, "no box outline at the image corners").toBeGreaterThan(600);
  });

  test("touch taps choose enabled commands only", async ({ browser }) => {
    const context = await browser.newContext({ viewport: phone, deviceScaleFactor: 2,
      hasTouch: true });
    const page = await context.newPage();
    await gallery(page, "battle-command");
    const centre = (index: number): Promise<{ x: number; y: number }> =>
      page.locator(".battle-command").nth(index).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      });
    const snack = await centre(2);
    await page.touchscreen.tap(snack.x, snack.y);
    await expect(page.locator("#gallery")).toHaveAttribute("data-battle-chosen", "2");
    const play = await centre(1);
    await page.touchscreen.tap(play.x, play.y);
    await page.evaluate(() => new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    }));
    await expect(page.locator("#gallery")).toHaveAttribute("data-battle-chosen", "2");
    const soothe = await centre(0);
    await page.touchscreen.tap(soothe.x, soothe.y);
    await expect(page.locator("#gallery")).toHaveAttribute("data-battle-chosen", "0");
    await context.close();
  });

  test("battle text pairs meet contrast targets", async ({ page }) => {
    const results: Contrast[] = [];
    for (const state of ["battle-command", "battle-grade", "battle-reward", "battle-feelings"]) {
      await gallery(page, state);
      results.push(...await page.evaluate(measureContrast));
    }
    await gallery(page, "battle-grade");
    for (const grade of ["good", "miss"] as const) {
      await page.evaluate((next) => window.__stickerGallery.renderCheck({ kind: "ring",
        x: 600, y: 170, radius: 74, progress: .62, target: .65, grade: next, hint: null,
        hintAt: { x: 600, y: 260 } }), grade);
      results.push(...(await page.evaluate(measureContrast))
        .filter((result) => result.label.startsWith("grade")));
    }
    for (const result of results)
      console.log(`${result.label}: ${result.ratio.toFixed(2)}:1, opacity ${result.opacity}`);
    expect(results.length).toBeGreaterThanOrEqual(14);
    for (const result of results) {
      expect(result.ratio, result.label).toBeGreaterThanOrEqual(4.5);
      expect(result.opacity, result.label).toBe(1);
    }
  });

  test("a new chain draws its beats in its own look, and only as many as it has",
    async ({ page }) => {
      await gallery(page, "battle-chain");
      await expect(page.locator(".battle-chain-beat:visible .battle-icon-pinecone"))
        .toHaveCount(2);
      const bubbles = (count: number): Promise<void> => page.evaluate((beats) =>
        window.__stickerGallery.renderCheck({ kind: "chain", from: { x: 600, y: 170 },
          to: { x: 190, y: 230 }, radius: 50, look: "bubble",
          beats: Array.from({ length: beats },
            () => ({ appeared: true, progress: 0.5, result: "pending" })),
          grade: null, hint: null, hintAt: { x: 190, y: 300 } }), count);
      await bubbles(2);
      await expect(page.locator(".battle-chain-beat:visible .battle-icon-bubble")).toHaveCount(2);
      await expect(page.locator(".battle-icon-pinecone")).toHaveCount(0);
      await bubbles(1);
      await expect(page.locator(".battle-chain-beat:visible")).toHaveCount(1);
    });

  test("only the command that answers the feeling wears its badge", async ({ page }) => {
    await gallery(page, "battle-feelings");
    const badged = page.locator(".battle-command:has(.battle-command-badge:not([hidden]))");
    await expect(badged).toHaveCount(1);
    await expect(badged.locator(".battle-command-label")).toHaveText("Play");
    // The lantern's peek rides in the smallest dot, glowing.
    await expect(page.locator(".battle-feeling-later")).toHaveClass(/is-peeked/);
    await expect(page.locator(".battle-feeling-later .battle-icon")).toHaveCount(1);
  });

  test("identical battle renders do not churn DOM nodes", async ({ page }) => {
    for (const state of battleStates) {
      await gallery(page, state);
      const records = await page.evaluate(() => {
        const observer = new MutationObserver(() => undefined);
        for (const part of document.querySelectorAll(
           ".battle-hud, .battle-commands, .battle-ring, .battle-charge-meter, .battle-chain, " +
             ".battle-catch, .battle-lean, .battle-trace, .battle-check-hint, " +
             ".battle-feeling, .battle-grade, " +
             ".battle-windup, " +
             ".battle-reward")) {
          observer.observe(part, { childList: true, characterData: true, subtree: true });
        }
        window.__stickerGallery.renderState();
        window.__stickerGallery.renderState();
        const changes = observer.takeRecords().length;
        observer.disconnect();
        return changes;
      });
      expect(records, state).toBe(0);
    }
  });

  test("three-choices desktop visual baseline", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/cloverhollow/ui-gallery.html?state=three-choices");
    await expect(page).toHaveScreenshot("three-choices-desktop.png", {
      animations: "disabled",
      scale: "device",
    });
  });

  for (const state of dialogueStates) {
    for (const size of sizes) {
      test(`${state} geometry ${size.width}x${size.height}`, async ({ page }) => {
        await page.setViewportSize(size);
        const insets = size.width === 874 ? "0,62,21,62" :
          size.width === 1180 ? "0,0,20,0" : "0,0,0,0";
        await page.goto(`/cloverhollow/ui-gallery.html?state=${state}&touch=1&` +
          `insets=${insets}`);
        const facts = await page.locator(".sticker-dialogue").evaluate((box) => {
          const intersects = (a: DOMRect, b: DOMRect): boolean =>
            a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          const controls = [...document.querySelectorAll<HTMLElement>(
            ".touch-confirm, .touch-cancel, .touch-menu")];
          const choices = [...document.querySelectorAll<HTMLElement>(".sticker-choice")];
          const boxRect = box.getBoundingClientRect();
          const buttonRects = controls.map((button) => button.getBoundingClientRect());
          const text = box.querySelector<HTMLElement>(".sticker-text");
          const lineHeight = text === null ? 1 : parseFloat(getComputedStyle(text).lineHeight);
          const style = getComputedStyle(document.documentElement);
          const safe = {
            top: parseFloat(style.getPropertyValue("--safe-top")) || 0,
            right: parseFloat(style.getPropertyValue("--safe-right")) || 0,
            bottom: parseFloat(style.getPropertyValue("--safe-bottom")) || 0,
            left: parseFloat(style.getPropertyValue("--safe-left")) || 0,
          };
          const insideSafe = (rect: DOMRect): boolean => rect.left >= 20 + safe.left &&
            rect.right <= innerWidth - 20 - safe.right &&
            rect.top >= safe.top && rect.bottom <= innerHeight - 20 - safe.bottom;
          return {
            inside: insideSafe(boxRect),
            boxOverlaps: buttonRects.some((button) => intersects(boxRect, button)),
            choiceOverlaps: choices.some((choice) => buttonRects.some((button) =>
              intersects(choice.getBoundingClientRect(), button))),
            fits: text !== null && text.scrollHeight <= text.clientHeight,
            lines: text === null ? 0 : text.clientHeight / lineHeight,
            choiceSizes: choices.map((choice) => choice.getBoundingClientRect().height),
            choicesOnScreen: choices.every((choice) => {
              const rect = choice.getBoundingClientRect();
              return rect.top >= safe.top && rect.bottom <= innerHeight - safe.bottom &&
                rect.left >= safe.left && rect.right <= innerWidth - safe.right;
            }),
            stickHidden: getComputedStyle(document.querySelector(".touch-stick") ?? box).display
              === "none",
          };
        });
        expect(facts.inside).toBe(true);
        expect(facts.boxOverlaps).toBe(false);
        expect(facts.choiceOverlaps).toBe(false);
        expect(facts.fits).toBe(true);
        expect(facts.choiceSizes.every((height) => height >= 44)).toBe(true);
        expect(facts.choicesOnScreen).toBe(true);
        expect(facts.stickHidden).toBe(true);
        if (state === "long-max") expect(facts.lines).toBeLessThanOrEqual(3.01);
      });
    }
  }

  for (const size of sizes) {
    test(`prompt arrow tip ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`/cloverhollow/ui-gallery.html?state=prompt&touch=1&` +
        `insets=${size.width === 874 ? "0,62,21,62" :
          size.width === 1180 ? "0,0,20,0" : "0,0,0,0"}`);
      await expect(page.locator(".touch-stick")).toBeVisible();
      const facts = await page.locator(".sticker-prompt").evaluate((prompt) => {
        const arrow = prompt.querySelector<SVGElement>(".sticker-prompt-arrow");
        const tipElement = prompt.querySelector<SVGCircleElement>(
          ".sticker-prompt-arrow-tip");
        const label = prompt.querySelector<HTMLElement>("span");
        const arrowRect = arrow?.getBoundingClientRect();
        const tipRect = tipElement?.getBoundingClientRect();
        const labelRect = label?.getBoundingClientRect();
        const intersects = arrowRect !== undefined && labelRect !== undefined &&
          arrowRect.left < labelRect.right && arrowRect.right > labelRect.left &&
          arrowRect.top < labelRect.bottom && arrowRect.bottom > labelRect.top;
        const style = getComputedStyle(document.documentElement);
        const safe = {
          top: parseFloat(style.getPropertyValue("--safe-top")) || 0,
          right: parseFloat(style.getPropertyValue("--safe-right")) || 0,
          bottom: parseFloat(style.getPropertyValue("--safe-bottom")) || 0,
          left: parseFloat(style.getPropertyValue("--safe-left")) || 0,
        };
        const tip = tipRect === undefined ? { x: 0, y: 0 } :
          { x: tipRect.left + tipRect.width / 2, y: tipRect.top + tipRect.height / 2 };
        const requested = { x: innerWidth / 2, y: innerHeight / 2 };
        return { error: Math.max(Math.abs(tip.x - requested.x),
            Math.abs(tip.y - requested.y)),
          intersectsLabel: intersects,
          insideSafe: tip.x >= safe.left && tip.x <= innerWidth - safe.right &&
            tip.y <= innerHeight - safe.bottom };
      });
      expect(facts.error).toBeLessThanOrEqual(2);
      expect(facts.intersectsLabel).toBe(false);
      expect(facts.insideSafe).toBe(true);
    });
  }

  test("prompt arrow clamps a top-left request", async ({ page }) => {
    await gallery(page, "prompt");
    await page.evaluate(() => window.__stickerGallery.renderPrompt({
      label: "TALK", x: 0, y: 0, visible: true,
    }));
    await page.evaluate(() => new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    }));
    const safe = await page.locator(".sticker-prompt-arrow-tip").evaluate((tip) => {
      const rect = tip.getBoundingClientRect();
      const style = getComputedStyle(document.documentElement);
      const left = parseFloat(style.getPropertyValue("--safe-left")) || 0;
      const top = parseFloat(style.getPropertyValue("--safe-top")) || 0;
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
        left, top };
    });
    expect(safe.x).toBeGreaterThanOrEqual(safe.left);
    expect(safe.y).toBeGreaterThanOrEqual(safe.top);
  });

  test("text pairs meet contrast targets", async ({ page }) => {
    await gallery(page, "three-choices");
    const ratios = await page.evaluate(() => {
      const luminance = (colour: string): number => {
        const values = colour.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
        const channels = values.slice(0, 3).map((value) => value / 255);
        const linear = channels.map((value) => value <= .03928
          ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return .2126 * (linear[0] ?? 0) + .7152 * (linear[1] ?? 0) +
          .0722 * (linear[2] ?? 0);
      };
      const ratio = (element: Element): number => {
        const style = getComputedStyle(element);
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return (Math.max(foreground, background) + .05) /
          (Math.min(foreground, background) + .05);
      };
      const text = document.querySelector(".sticker-text-revealed");
      const dialogue = document.querySelector(".sticker-dialogue");
      const speaker = document.querySelector(".sticker-speaker");
      const selected = document.querySelector(".sticker-choice[aria-selected='true']");
      const pairs = [
        { selector: ".sticker-text-revealed", element: text, background: dialogue },
        { selector: ".sticker-speaker", element: speaker, background: speaker },
        { selector: ".sticker-choice[aria-selected='true']", element: selected,
          background: selected },
      ];
      return pairs.map((pair) => ({ selector: pair.selector,
        ratio: pair.element === null || pair.background === null ? 0 :
          ((): number => {
            const foreground = luminance(getComputedStyle(pair.element).color);
            const background = luminance(getComputedStyle(pair.background).backgroundColor);
            return (Math.max(foreground, background) + .05) /
              (Math.min(foreground, background) + .05);
          })() }));
    });
    for (const result of ratios) console.log(`${result.selector}: ${result.ratio.toFixed(2)}:1`);
    expect(ratios.every((result) => result.ratio >= 4.5)).toBe(true);
    expect(ratios[0]?.ratio ?? 0).toBeGreaterThanOrEqual(7);
    await page.goto("/cloverhollow/ui-gallery.html?state=prompt&touch=1");
    const promptRatio = await page.locator(".sticker-prompt span").evaluate((label) => {
      const foreground = getComputedStyle(label).color;
      const background = getComputedStyle(label.parentElement ?? label).backgroundColor;
      const channel = (value: string): number => {
        const part = Number(value.match(/\d+(?:\.\d+)?/)?.[0] ?? 0) / 255;
        return part <= .03928 ? part / 12.92 : ((part + .055) / 1.055) ** 2.4;
      };
      const luminance = (value: string): number => {
        const values = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
        return .2126 * channel(String(values[0] ?? 0)) +
          .7152 * channel(String(values[1] ?? 0)) + .0722 * channel(String(values[2] ?? 0));
      };
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return (Math.max(foregroundLuminance, backgroundLuminance) + .05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + .05);
    });
    console.log(`.sticker-prompt span: ${promptRatio.toFixed(2)}:1`);
    expect(promptRatio).toBeGreaterThanOrEqual(4.5);
  });

  test("touch choice calls the selected index", async ({ browser }) => {
    const context = await browser.newContext({ viewport: phone, deviceScaleFactor: 2,
      hasTouch: true });
    const page = await context.newPage();
    await gallery(page, "three-choices", true);
    const point = await page.locator(".sticker-choice").nth(2).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x + 20, y: rect.y + 20 };
    });
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.locator("#gallery")).toHaveAttribute("data-chosen", "2");
    await context.close();
  });

  test("identical renders keep their DOM nodes", async ({ page }) => {
    await gallery(page, "three-choices", false);
    const result = await page.evaluate(() => {
      const box = document.querySelector(".sticker-dialogue");
      const text = document.querySelector(".sticker-text-revealed");
      const choice = document.querySelector(".sticker-choice");
      const current = { speaker: "Maddie", text: "Which sticker should we take?",
        revealed: 100, choices: [{ text: "A bright leaf" }, { text: "A tiny moon" },
          { text: "A friendly star" }], selected: 1, canAdvance: false };
      window.__stickerGallery.render(current);
      return box === document.querySelector(".sticker-dialogue") &&
        text === document.querySelector(".sticker-text-revealed") &&
        choice === document.querySelector(".sticker-choice");
    });
    expect(result).toBe(true);
  });
});
