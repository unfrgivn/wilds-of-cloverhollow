import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { longFlowTimeout, openHarness, resetPaused, step } from "./helpers";

declare global {
  interface Window {
    __gamepadState?: { buttons: boolean[]; axes: number[] };
  }
}

async function installGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { buttons: Array.from({ length: 16 }, () => false), axes: [0, 0] };
    Object.defineProperty(window, "__gamepadState", { value: state });
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [
        {
          mapping: "standard",
          buttons: state.buttons.map((pressed) => ({ pressed, value: pressed ? 1 : 0 })),
          axes: state.axes,
        },
      ],
    });
  });
}

async function setPad(
  page: Page,
  options: { axes?: [number, number]; buttons?: number[] },
): Promise<void> {
  await page.evaluate((next) => {
    const state = window.__gamepadState;
    if (state === undefined) throw new Error("gamepad unavailable");
    state.axes = next.axes ?? [0, 0];
    state.buttons.fill(false);
    for (const button of next.buttons ?? []) state.buttons[button] = true;
  }, options);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function pressPad(page: Page, button: number): Promise<void> {
  await setPad(page, { buttons: [button] });
  await step(page, 1);
  await setPad(page, {});
  await step(page, 2);
}

test.describe(
  "Milestone 220: Gamepad Sky Cycler, Postcard Postal Weather Stamp & QA Weather Command",
  () => {
    test.setTimeout(longFlowTimeout);

    test(
      "cycles Photo Mode skies via LB/RB & Shift+W, stamps postcard, and drives QA weather",
      { tag: "@smoke" },
      async ({ page }, testInfo) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));

        await installGamepad(page);
        await page.setViewportSize({ width: 1280, height: 720 });
        await openHarness(page);
        await page.evaluate(() => {
          localStorage.removeItem("CapacitorStorage.cloverhollow-weather");
        });
        await resetPaused(page, "plaza");
        await step(page, 2);

        const html = page.locator("html");
        const toast = page.locator(".photo-toast");
        await expect(html).toHaveAttribute("data-active-weather", "clear");

        // Enter Photo Mode via gamepad Select (button 8).
        await pressPad(page, 8);
        await expect(html).toHaveAttribute("data-photo", "on");

        // RB (button 5) advances sky from clear -> sunshower.
        await pressPad(page, 5);
        await expect(html).toHaveAttribute("data-active-weather", "sunshower");
        await expect(toast).toBeVisible();
        await expect(toast).toHaveText("Sky · Rainbow Sunshower");

        // LB (button 4) steps sky cleanly back from sunshower -> clear.
        await pressPad(page, 4);
        await expect(html).toHaveAttribute("data-active-weather", "clear");
        await expect(toast).toHaveText("Sky · Clear Skies");

        // Keyboard Shift+W steps backward cleanly to twilight-fireflies, W returns to clear.
        await page.keyboard.press("Shift+W");
        await step(page, 2);
        await expect(html).toHaveAttribute("data-active-weather", "twilight-fireflies");
        await expect(toast).toHaveText("Sky · Twilight Fireflies");

        await page.keyboard.press("w");
        await step(page, 2);
        await expect(html).toHaveAttribute("data-active-weather", "clear");
        await expect(toast).toHaveText("Sky · Clear Skies");

        // RB (button 5) back to sunshower, then snap postcard via gamepad A (button 0).
        await pressPad(page, 5);
        await expect(html).toHaveAttribute("data-active-weather", "sunshower");
        await pressPad(page, 0);
        await expect(page.locator(".photo-shutter-flash")).toHaveAttribute(
          "data-shutter-count",
          "1",
        );
        await expect(toast).toHaveText("Postcard saved · Town plaza · Rainbow Sunshower");

        // Capture composed framed postcard PNG and verify weather stamp + caption.
        const capture = await page.evaluate(
          async () => (await window.__cloverhollow?.settings.snapPostcard({ download: false }))
            ?? null,
        );
        expect(capture).not.toBeNull();
        expect(capture?.filename).toBe("cloverhollow-postcard-plaza.png");
        expect(capture?.subcaption).toContain("Rainbow Sunshower");
        expect(capture?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
        expect(capture?.width ?? 0).toBeGreaterThan(1280);
        expect(capture?.height ?? 0).toBeGreaterThan(720);

        // Decode composed PNG, confirm the postal weather stamp painted non-cream ink pixels,
        // and optionally emit a <=1400px JPEG review image.
        const decoded = await page.evaluate(async (dataUrl) => {
          const img = new Image();
          img.src = dataUrl;
          await img.decode();
          const maxLong = 1362;
          const scale = Math.min(1, maxLong / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.naturalWidth * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          const ctx = canvas.getContext("2d");
          if (ctx === null) throw new Error("missing 2d context");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Sample the bottom border strip where the postal weather stamp sits beside the clover.
          const padX = Math.max(24, Math.round(canvas.width * 0.03));
          const stripY = Math.round(canvas.height * 0.91);
          const stripH = Math.max(12, Math.round(canvas.height * 0.07));
          const sample = ctx.getImageData(
            padX + 26,
            stripY,
            Math.round(canvas.width * 0.08),
            stripH,
          ).data;
          let coloredPixels = 0;
          for (let offset = 0; offset < sample.length; offset += 4) {
            const r = sample[offset] ?? 251;
            const g = sample[offset + 1] ?? 246;
            const b = sample[offset + 2] ?? 232;
            if (Math.abs(r - 251) + Math.abs(g - 246) + Math.abs(b - 232) > 45) {
              coloredPixels += 1;
            }
          }
          return {
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            coloredPixels,
            jpegBase64: canvas.toDataURL("image/jpeg", 0.92).split(",")[1] ?? "",
          };
        }, capture?.dataUrl ?? "");

        expect(decoded.naturalWidth).toBe(capture?.width);
        expect(decoded.naturalHeight).toBe(capture?.height);
        expect(decoded.coloredPixels).toBeGreaterThan(80);

        if (
          process.env.CLOVERHOLLOW_REVIEW_SHOTS === "1" &&
          testInfo.project.name === "chromium" &&
          decoded.jpegBase64.length > 0
        ) {
          writeFileSync(
            "art/review/m220-postcard-sunshower-stamp.jpg",
            Buffer.from(decoded.jpegBase64, "base64"),
          );
        }

        // Exit Photo Mode cleanly via gamepad B (button 1).
        await pressPad(page, 1);
        await expect(html).toHaveAttribute("data-photo", "off");

        // Verify QA console `weather` command switches and reports skies cleanly.
        await page.keyboard.press("`");
        await expect(page.locator(".qa-console")).toBeVisible();
        await page.keyboard.type("weather twilight-fireflies");
        await page.keyboard.press("Enter");
        await expect(page.locator(".qa-console-log")).toContainText(
          "weather = twilight-fireflies (Twilight Fireflies).",
        );
        await expect(html).toHaveAttribute("data-active-weather", "twilight-fireflies");

        await page.keyboard.type("weather");
        await page.keyboard.press("Enter");
        await expect(page.locator(".qa-console-log")).toContainText("twilight-fireflies");

        await page.keyboard.type("weather clear");
        await page.keyboard.press("Enter");
        await expect(page.locator(".qa-console-log")).toContainText(
          "weather = clear (Clear Skies).",
        );
        await expect(html).toHaveAttribute("data-active-weather", "clear");

        await page.keyboard.press("Escape");
        await expect(page.locator(".qa-console")).toBeHidden();
        await page.evaluate(() => {
          localStorage.removeItem("CapacitorStorage.cloverhollow-weather");
        });

        expect(errors).toEqual([]);
      },
    );
  },
);
