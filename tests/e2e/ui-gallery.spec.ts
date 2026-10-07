import { expect, test, type Page } from "@playwright/test";

test.use({ deviceScaleFactor: 2 });

const states = ["short", "long", "long-max", "revealing", "speaker-board",
  "two-choices", "three-choices", "prompt", "touch-overlap"];
const battleStates = ["battle-command", "battle-timing", "battle-grade", "battle-burst",
  "battle-reward"];
const journalStates = ["journal-empty", "journal-notes", "journal-full"];
const dialogueStates = states.filter((state) => state !== "prompt");
const phone = { width: 874, height: 402 };
const sizes = [phone, { width: 1180, height: 820 }, { width: 1280, height: 720 }];

async function gallery(page: Page, state: string, touch = true,
  insets = "0,62,21,62"): Promise<void> {
  await page.setViewportSize(phone);
  const query = `state=${state}&insets=${insets}${touch ? "&touch=1" : ""}`;
  await page.goto(`/cloverhollow/ui-gallery.html?${query}`);
  await expect(page.locator(".gallery-stage")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
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
  "battle-reward": [".battle-reward"],
  "journal-empty": [".journal-book"],
  "journal-notes": [".journal-book"],
  "journal-full": [".journal-book"],
};
const allBattleParts = [".battle-hud", ".battle-commands", ".battle-ring", ".battle-grade",
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
    ".battle-grade, .battle-reward-title, .battle-reward-name, .journal-label, " +
    ".journal-heading, .journal-supply, .journal-note, .journal-empty, .journal-name, " +
    ".journal-unknown, .journal-close";
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

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

test.describe("sticker gallery", () => {
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
          const album = rect(".journal-stickers-page");
          if (!book || !close || !label || !notes || !album) return null;
          const within = (inner: DOMRect, outer: DOMRect): boolean =>
            inner.left >= outer.left && inner.right <= outer.right &&
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
            onTop: centre?.closest(".journal-book") !== null,
          };
        });
        expect(facts).not.toBeNull();
        expect(facts?.bookInside).toBe(true);
        expect(facts?.labelOnScreen).toBe(true);
        expect(facts?.closeSize ?? 0).toBeGreaterThanOrEqual(44);
        expect(facts?.closeInside).toBe(true);
        expect(facts?.pagesApart).toBe(true);
        expect(facts?.onTop, "nothing covers the open journal").toBe(true);
      });
    }
  }

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
    const owned = page.locator('.journal-slot[data-owned="true"]');
    await expect(owned).toHaveCount(1);
    await expect(owned.locator(".journal-name")).toHaveText("Fountain Frog");
    await expect(owned.locator(".journal-unknown")).toBeHidden();
    const unknown = page.locator('.journal-slot[data-owned="false"] .journal-unknown');
    await expect(unknown).toHaveCount(7);
    for (const slot of await unknown.all()) {
      await expect(slot).toBeVisible();
      await expect(slot).toHaveText("?");
      expect(await slot.evaluate((element) => getComputedStyle(element).borderStyle))
        .toBe("dashed");
    }
    await expect(page.locator('.journal-slot[data-owned="false"] .journal-name')).toHaveCount(7);
    for (const name of await page.locator('.journal-slot[data-owned="false"] .journal-name').all())
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
          const controls = [...document.querySelectorAll<HTMLElement>(
            ".touch-confirm, .touch-cancel, .touch-menu")];
          const intersects = (a: DOMRect, b: DOMRect): boolean =>
            a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          const commandRects = commands.map((item) => item.getBoundingClientRect());
          const hudRects = hud.map((item) => item.getBoundingClientRect());
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
    for (const state of ["battle-command", "battle-grade", "battle-reward"]) {
      await gallery(page, state);
      results.push(...await page.evaluate(measureContrast));
    }
    await gallery(page, "battle-grade");
    for (const grade of ["good", "miss"] as const) {
      await page.evaluate((next) => window.__stickerGallery.renderRing({ visible: true,
        x: 600, y: 170, radius: 74, progress: .62, target: .65, grade: next }), grade);
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

  test("identical battle renders do not churn DOM nodes", async ({ page }) => {
    for (const state of battleStates) {
      await gallery(page, state);
      const records = await page.evaluate(() => {
        const observer = new MutationObserver(() => undefined);
        for (const part of document.querySelectorAll(
          ".battle-hud, .battle-commands, .battle-ring, .battle-grade, .battle-reward")) {
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
            stickHidden: getComputedStyle(document.querySelector(".touch-stick") ?? box).display
              === "none",
          };
        });
        expect(facts.inside).toBe(true);
        expect(facts.boxOverlaps).toBe(false);
        expect(facts.choiceOverlaps).toBe(false);
        expect(facts.fits).toBe(true);
        expect(facts.choiceSizes.every((height) => height >= 44)).toBe(true);
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
