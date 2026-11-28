import { expect, test } from "@playwright/test";
import { longFlowTimeout, openHarness, resetPaused, step } from "./helpers";

type ShareCallRecord = {
  fileName: string;
  fileType: string;
  fileSize: number;
  pngMagic: number[];
  title: string;
  text: string;
};

declare global {
  interface Window {
    __postcardShares?: ShareCallRecord[];
  }
}

test.describe("Milestone 160: Mobile Web Share Postcard Delivery & Photo Toast", () => {
  test.setTimeout(longFlowTimeout);

  test(
    "desktop Photo Mode snap reveals accessible photo toast and Escape hides it immediately",
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: 1280, height: 720 });
      await openHarness(page);
      await resetPaused(page, "plaza");
      await step(page, 1);

      const toast = page.locator(".photo-toast");
      await expect(toast).toHaveAttribute("role", "status");
      await expect(toast).toHaveAttribute("aria-live", "polite");
      await expect(toast).toBeHidden();

      // Enter Photo Mode via real P key press; toast stays hidden until a snap occurs.
      await page.keyboard.press("p");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
      await expect(toast).toBeHidden();

      // Snap with real Space key press -> toast appears with saved confirmation.
      await page.keyboard.press("Space");
      await expect(page.locator(".photo-shutter-flash")).toHaveAttribute(
        "data-shutter-count",
        "1",
      );
      await expect(toast).toBeVisible();
      await expect(toast).toHaveText("Postcard saved · Town plaza");

      // Toast stays outside Pixi's WebGL canvas and non-blocking (pointer-events: none).
      const toastMeta = await page.evaluate(() => {
        const canvas = document.querySelector("#app canvas");
        const node = document.querySelector(".photo-toast");
        return {
          outsideCanvas: canvas !== null && node !== null && !canvas.contains(node),
          pointerEvents: node === null ? "" : getComputedStyle(node).pointerEvents,
        };
      });
      expect(toastMeta.outsideCanvas).toBe(true);
      expect(toastMeta.pointerEvents).toBe("none");

      // Exiting Photo Mode via real Escape hides .photo-toast immediately.
      await page.keyboard.press("Escape");
      await step(page, 1);
      await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
      await expect(toast).toBeHidden();
      expect(errors).toEqual([]);
    },
  );

  test(
    "touch Photo Mode snap invokes navigator.share with PNG File and shows shared toast",
    { tag: "@smoke" },
    async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 874, height: 402 },
        hasTouch: true,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      try {
        await page.addInitScript(() => {
          const calls: ShareCallRecord[] = [];
          Object.defineProperty(window, "__postcardShares", { value: calls });
          Object.defineProperty(navigator, "canShare", {
            configurable: true,
            value: (data?: { files?: File[] }) =>
              Array.isArray(data?.files) &&
              data.files.length === 1 &&
              data.files[0]?.type === "image/png",
          });
          Object.defineProperty(navigator, "share", {
            configurable: true,
            value: async (data?: { files?: File[]; title?: string; text?: string }) => {
              const file = data?.files?.[0];
              if (file === undefined) throw new Error("missing shared file");
              const bytes = new Uint8Array(await file.arrayBuffer());
              calls.push({
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                pngMagic: Array.from(bytes.slice(0, 4)),
                title: data?.title ?? "",
                text: data?.text ?? "",
              });
            },
          });
        });

        await page.goto("./?touch=1");
        await page.waitForFunction(() => Boolean(window.__cloverhollow));
        await resetPaused(page, "plaza");
        await step(page, 1);

        await expect(page.locator("html")).toHaveAttribute("data-touch", "on");
        const toast = page.locator(".photo-toast");
        await expect(toast).toBeHidden();

        // Enter Photo Mode and tap the touch camera button.
        await page.evaluate(() => window.__cloverhollow?.settings.setPhotoMode(true));
        await step(page, 1);
        await expect(page.locator("html")).toHaveAttribute("data-photo", "on");
        await expect(toast).toBeHidden();

        const snapBtn = page.locator(".photo-touch-snap");
        const closeBtn = page.locator(".photo-touch-close");
        await expect(snapBtn).toBeVisible();
        await snapBtn.tap();

        await expect
          .poll(() => page.evaluate(() => window.__postcardShares?.length ?? 0))
          .toBe(1);

        const shareRecord = await page.evaluate(() => window.__postcardShares?.[0] ?? null);
        expect(shareRecord).not.toBeNull();
        expect(shareRecord?.fileName).toBe("cloverhollow-postcard-plaza.png");
        expect(shareRecord?.fileType).toBe("image/png");
        expect(shareRecord?.fileSize).toBeGreaterThan(1000);
        expect(shareRecord?.pngMagic).toEqual([0x89, 0x50, 0x4e, 0x47]);
        expect(shareRecord?.title).toBe("Town plaza · Wilds of Cloverhollow");
        expect(shareRecord?.text).toBe("Postcard from Wilds of Cloverhollow");

        await expect(toast).toBeVisible();
        await expect(toast).toHaveText("Postcard shared · Town plaza");

        await closeBtn.tap();
        await step(page, 1);
        await expect(page.locator("html")).toHaveAttribute("data-photo", "off");
        await expect(toast).toBeHidden();
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
  );
});
