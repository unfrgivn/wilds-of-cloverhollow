import { expect, test, type Page } from "@playwright/test";
import { openHarness, readState, resetPaused, step } from "./helpers";
import type { PortraitExpression } from "../../src/ui/portraits";
import type { SpeakerSide } from "../../src/ui/sticker";

type ContrastItem = { label: string; ratio: number };

async function hold(page: Page, key: string, ticks: number): Promise<void> {
  await page.keyboard.down(key);
  await step(page, ticks);
  await page.keyboard.up(key);
}

async function pressConfirm(page: Page): Promise<void> {
  await page.keyboard.press("z");
  await step(page, 2);
}

const EXPRESSION_SHOWCASE: readonly {
  speaker: string;
  castId: string;
  expression: PortraitExpression;
  accent: "fae" | "family" | "friend" | "school" | "town";
  side: SpeakerSide;
  text: string;
}[] = [
  {
    speaker: "Fae",
    castId: "fae",
    expression: "neutral",
    accent: "fae",
    side: "center",
    text: "Morning sun over {color:teal}Cloverhollow{/color}.",
  },
  {
    speaker: "Maddie",
    castId: "maddie",
    expression: "happy",
    accent: "family",
    side: "left",
    text: "{wave}Purr!{/wave} Look at that {color:gold}{pop}golden{/pop}{/color} sparkle!",
  },
  {
    speaker: "Sue",
    castId: "sue",
    expression: "worried",
    accent: "friend",
    side: "right",
    text: "{whisper}Wait...{/whisper}{pause:10} did the {color:lavender}mist{/color} move?",
  },
  {
    speaker: "Jordan",
    castId: "jordan",
    expression: "determined",
    accent: "friend",
    side: "left",
    text: "Let's {pop}team up{/pop} and calm this {color:berry}fizz{/color}!",
  },
  {
    speaker: "Grandpa Barnaby",
    castId: "barnaby",
    expression: "surprised",
    accent: "town",
    side: "right",
    text:
      "{shake}Whoa!{/shake} A {color:gold}Star Gem{/color} right by the cafe! " +
      "<img src=x onerror=alert(1)>",
  },
];

async function renderShowcaseLine(
  page: Page,
  entry: (typeof EXPRESSION_SHOWCASE)[number],
  revealed = 999,
  choices: { text: string }[] = [],
): Promise<void> {
  await page.evaluate(
    async ({ item, rev, choiceList }) => {
      const response = await fetch("assets/portraits/portraits.json");
      const sheet: {
        frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
        meta: { image: string; size: { w: number; h: number } };
      } = await response.json();
      const frameName = `${item.castId}_${item.expression}`;
      const rect = sheet.frames[frameName]?.frame;
      if (rect === undefined) throw new Error(`Missing portrait frame ${frameName}`);
      const src = `assets/portraits/${sheet.meta.image}`;
      const img = new Image();
      img.src = src;
      await img.decode();
      window.__stickerGallery.render({
        speaker: item.speaker,
        text: item.text,
        revealed: rev,
        choices: choiceList,
        selected: choiceList.length > 0 ? 0 : -1,
        canAdvance: choiceList.length === 0,
        accent: item.accent,
        expression: item.expression,
        speakerSide: item.side,
        portrait: {
          src,
          frame: rect,
          atlas: sheet.meta.size,
        },
      });
    },
    { item: entry, rev: revealed, choiceList: choices },
  );
}

test.describe("E3: Storybook Dialogue Card, 5-Expression Portraits & Kinetic Text", () => {
  for (const viewport of [
    { name: "desktop-1280", width: 1280, height: 720, touch: false, insets: "0,0,0,0" },
    { name: "phone-874", width: 874, height: 402, touch: true, insets: "0,62,21,62" },
  ] as const) {
    test(`renders all 5 expressions, kinetic markup & safe clearance on ${viewport.name}`, {
      tag: "@smoke",
    }, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const touchParam = viewport.touch ? "&touch=1" : "";
      await page.goto(
        `/cloverhollow/ui-gallery.html?state=short&insets=${viewport.insets}${touchParam}`,
      );
      await page.waitForFunction(
        () => document.querySelector("#gallery[data-ready='true']") !== null,
      );

      for (const entry of EXPRESSION_SHOWCASE) {
        await renderShowcaseLine(
          page,
          entry,
          999,
          entry.expression === "determined"
            ? [{ text: "Lead the way!" }, { text: "Check the journal first" }]
            : [],
        );

        const box = page.locator(".sticker-dialogue");
        const portrait = page.locator(".sticker-portrait");
        const tail = page.locator(".sticker-tail");

        await expect(box).toBeVisible();
        await expect(box).toHaveClass(/has-portrait/);
        await expect(box).toHaveAttribute("data-tail", entry.side);
        await expect(portrait).toBeVisible();
        await expect(portrait).toHaveAttribute("data-expression", entry.expression);
        await expect(tail).toBeVisible();

        const portraitBg = await page
          .locator(".sticker-portrait-img")
          .evaluate((el) => getComputedStyle(el).backgroundImage);
        expect(portraitBg).toContain("portraits.webp");

        // Zero raw markup leakage and zero XSS HTML injection.
        const revealedText = await page.locator(".sticker-text-revealed").textContent();
        expect(revealedText).not.toContain("{shake}");
        expect(revealedText).not.toContain("{wave}");
        expect(revealedText).not.toContain("{pause:");
        expect(revealedText).not.toContain("{color:");
        await expect(page.locator(".sticker-dialogue img")).toHaveCount(0);

        // aria-live exposes clean plain text.
        const liveText = await page.locator(".sticker-live").first().textContent();
        expect(liveText).toContain(`${entry.speaker}:`);
        expect(liveText).not.toContain("{");

        // Safe-area & touch-button clearance on phone layout.
        if (viewport.touch) {
          const layout = await page.evaluate(() => {
            const intersects = (a: DOMRect, b: DOMRect): boolean =>
              a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            const boxRect = document.querySelector(".sticker-dialogue")?.getBoundingClientRect();
            const portraitRect = document
              .querySelector(".sticker-portrait")
              ?.getBoundingClientRect();
            const tailRect = document.querySelector(".sticker-tail")?.getBoundingClientRect();
            const choices = [...document.querySelectorAll(".sticker-choice")].map((el) =>
              el.getBoundingClientRect(),
            );
            const buttons = [
              ...document.querySelectorAll(".touch-confirm, .touch-cancel, .touch-menu"),
            ].map((el) => el.getBoundingClientRect());
            return {
              boxOverlaps:
                boxRect !== undefined && buttons.some((btn) => intersects(boxRect, btn)),
              portraitOverlaps:
                portraitRect !== undefined && buttons.some((btn) => intersects(portraitRect, btn)),
              tailOverlaps:
                tailRect !== undefined && buttons.some((btn) => intersects(tailRect, btn)),
              choiceOverlaps: choices.some((c) => buttons.some((btn) => intersects(c, btn))),
            };
          });
          expect(layout).toEqual({
            boxOverlaps: false,
            portraitOverlaps: false,
            tailOverlaps: false,
            choiceOverlaps: false,
          });
        }
      }

      // Verify {pause:10} beat hold pauses reveal and portrait talking bob.
      const worried = EXPRESSION_SHOWCASE[2];
      if (worried === undefined) throw new Error("Missing worried sample");
      await renderShowcaseLine(page, worried, 12);
      await expect(page.locator(".sticker-text-revealed")).toHaveText("Wait...");
      await expect(page.locator(".sticker-portrait")).not.toHaveClass(/is-talking/);

      // Verify all kinetic classes & WCAG AAA contrast >= 7:1 on body + all 4 colors + whisper.
      const kineticLine = {
        speaker: "Fae",
        castId: "fae",
        expression: "happy" as const,
        accent: "fae" as const,
        side: "left" as const,
        text:
          "{shake}Ooh!{/shake} {wave}Magic{/wave} {pop}stars{/pop} {whisper}glow{/whisper} " +
          "{color:berry}berry{/color} {color:teal}teal{/color} {color:gold}gold{/color} " +
          "{color:lavender}lavender{/color}",
      };
      await renderShowcaseLine(page, kineticLine, 999);
      await expect(page.locator(".sticker-text-revealed .rt-shake")).not.toHaveCount(0);
      await expect(page.locator(".sticker-text-revealed .rt-wave")).not.toHaveCount(0);
      await expect(page.locator(".sticker-text-revealed .rt-pop")).not.toHaveCount(0);
      await expect(page.locator(".sticker-text-revealed .rt-whisper")).toHaveCount(1);

      const contrasts = await page.evaluate((): ContrastItem[] => {
        const parse = (colour: string): number[] =>
          colour.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
        const chan = (v: number): number => {
          const p = v / 255;
          return p <= 0.03928 ? p / 12.92 : ((p + 0.055) / 1.055) ** 2.4;
        };
        const lum = (colour: string): number => {
          const [r = 0, g = 0, b = 0] = parse(colour);
          return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
        };
        const bgEl = document.querySelector(".sticker-dialogue");
        if (bgEl === null) return [];
        const bgLum = lum(getComputedStyle(bgEl).backgroundColor);
        const selectors = [
          ".sticker-text-revealed",
          ".sticker-text-revealed .rt-whisper",
          ".sticker-text-revealed .rt-color-berry",
          ".sticker-text-revealed .rt-color-teal",
          ".sticker-text-revealed .rt-color-gold",
          ".sticker-text-revealed .rt-color-lavender",
        ];
        return selectors.map((selector) => {
          const el = document.querySelector(selector);
          const fgLum = el === null ? bgLum : lum(getComputedStyle(el).color);
          return {
            label: selector,
            ratio: (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05),
          };
        });
      });
      for (const item of contrasts) {
        expect(item.ratio, `${item.label} WCAG AAA contrast`).toBeGreaterThanOrEqual(7);
      }

      // Reduced Motion disables shake/wave/pop animation while preserving color & weight/italic.
      await page.evaluate(() => {
        document.documentElement.dataset.reducedMotion = "on";
      });
      const reducedState = await page.evaluate(() => {
        const shake = document.querySelector(".sticker-text-revealed .rt-shake");
        const wave = document.querySelector(".sticker-text-revealed .rt-wave");
        const pop = document.querySelector(".sticker-text-revealed .rt-pop");
        const berry = document.querySelector(".sticker-text-revealed .rt-color-berry");
        const whisper = document.querySelector(".sticker-text-revealed .rt-whisper");
        return {
          shakeAnim: shake === null ? "" : getComputedStyle(shake).animationName,
          waveAnim: wave === null ? "" : getComputedStyle(wave).animationName,
          popAnim: pop === null ? "" : getComputedStyle(pop).animationName,
          popWeight: pop === null ? 0 : Number(getComputedStyle(pop).fontWeight),
          berryColor: berry === null ? "" : getComputedStyle(berry).color,
          whisperStyle: whisper === null ? "" : getComputedStyle(whisper).fontStyle,
        };
      });
      expect(reducedState.shakeAnim).toBe("none");
      expect(reducedState.waveAnim).toBe("none");
      expect(reducedState.popAnim).toBe("none");
      expect(reducedState.popWeight).toBeGreaterThanOrEqual(700);
      expect(reducedState.berryColor).toBe("rgb(134, 31, 67)");
      expect(reducedState.whisperStyle).toBe("italic");
    });
  }

  test("live gameplay real keys: Fae renders Art Wave A2 watercolor bust portrait", {
    tag: "@smoke",
  }, async ({ page }) => {
    await openHarness(page);
    await resetPaused(page, "new-game");

    // Walk Fae to bedroom window with real arrow keys and press Z.
    const start = await readState(page);
    await hold(page, "ArrowRight", Math.round((612 - start.player.x) / 4));
    const below = await readState(page);
    await hold(page, "ArrowUp", Math.round((below.player.y - 338) / 4));
    await pressConfirm(page);

    await expect(page.locator(".sticker-dialogue")).toBeVisible();
    await expect(page.locator(".sticker-dialogue")).toHaveClass(/has-portrait/);
    await expect(page.locator(".sticker-portrait")).toBeVisible();
    await expect(page.locator(".sticker-portrait")).toHaveAttribute("data-expression", "neutral");
    await expect(page.locator(".sticker-tail")).toBeVisible();

    const faePortrait = await page
      .locator(".sticker-portrait-img")
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(faePortrait).toContain("portraits.webp");

    // While typing, portrait bounces; once revealed, talking class clears.
    await step(page, 6);
    await expect(page.locator(".sticker-portrait")).toHaveClass(/is-talking/);
    await pressConfirm(page);
    await expect(page.locator(".sticker-portrait")).not.toHaveClass(/is-talking/);
  });
});
