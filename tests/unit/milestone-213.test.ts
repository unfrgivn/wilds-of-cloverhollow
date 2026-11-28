import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as camera from "../../src/render/camera";
import * as cameraDirectives from "../../src/render/camera-directives";

function lineCount(path: string): number {
  return readFileSync(path, "utf8").trimEnd().split("\n").length;
}

describe("Milestone 213: Phone Touch & Travel-Vignette Cinema Hygiene CSS Gate", () => {
  it("hides stick/menu in cutscenes, menu/confirm in flute-wheel, and controls in shrine", () => {
    const touchCss = readFileSync("src/ui/touch-controls.css", "utf8");

    const cutsceneLine = touchCss
      .split("\n")
      .find((line) => line.includes(':root[data-cutscene="open"]'));
    expect(cutsceneLine, "cutscene touch selector").toBeDefined();
    expect(cutsceneLine).toContain(".touch-stick");
    expect(cutsceneLine).toContain(".touch-menu");
    expect(cutsceneLine).not.toContain(".touch-confirm");
    expect(cutsceneLine).not.toContain(".touch-cancel");
    expect(touchCss).toMatch(
      /:root\[data-cutscene="open"\][^{]*\{[^}]*display:\s*none;/,
    );

    const fluteLine = touchCss
      .split("\n")
      .find((line) => line.includes(':root[data-flute-wheel="open"] :is('));
    expect(fluteLine, "flute-wheel touch selector").toBeDefined();
    expect(fluteLine).toContain(".touch-stick");
    expect(fluteLine).toContain(".touch-menu");
    expect(fluteLine).toContain(".touch-confirm");
    expect(fluteLine).not.toContain(".touch-cancel");
    expect(touchCss).toMatch(
      /:root\[data-flute-wheel="open"\][^{]*\{[^}]*display:\s*none;/,
    );

    expect(touchCss).toMatch(
      /:root\[data-shrine="open"\]\s+\.touch-controls\s*\{\s*display:\s*none;\s*\}/,
    );
  });

  it("hides qa-touch-trigger, npc-chatter, and ribbon-toast in travel vignettes", () => {
    const checks: readonly { file: string; selector: string }[] = [
      {
        file: "src/ui/qa.css",
        selector: ':root[data-travel-vignette="open"] .qa-touch-trigger:not([hidden])',
      },
      {
        file: "src/ui/npc-chatter.css",
        selector: ':root[data-travel-vignette="open"] .npc-chatter',
      },
      {
        file: "src/ui/ribbon-toast.css",
        selector: ':root[data-travel-vignette="open"] .ribbon-toast',
      },
    ];

    for (const { file, selector } of checks) {
      const css = readFileSync(file, "utf8");
      expect(css, `${file} missing ${selector}`).toContain(selector);
      expect(css, `${file} must apply display: none on data-travel-vignette`).toMatch(
        /:root\[data-travel-vignette="open"\][^{]*\{[^}]*display:\s*none;/,
      );
    }
  });
});

describe("Milestone 213: Modular camera-directives.ts Identity, Purity & Line Budgets", () => {
  it("re-exports every extracted camera directive, framing, trauma, and parallax symbol", () => {
    expect(camera.extractInkCurrentTags).toBe(cameraDirectives.extractInkCurrentTags);
    expect(camera.parseCameraTags).toBe(cameraDirectives.parseCameraTags);
    expect(camera.resolveDialogueFocus).toBe(cameraDirectives.resolveDialogueFocus);
    expect(camera.clampZoomToArea).toBe(cameraDirectives.clampZoomToArea);
    expect(camera.clampCameraToArea).toBe(cameraDirectives.clampCameraToArea);
    expect(camera.createCameraTraumaState).toBe(cameraDirectives.createCameraTraumaState);
    expect(camera.addCameraTrauma).toBe(cameraDirectives.addCameraTrauma);
    expect(camera.stepCameraTrauma).toBe(cameraDirectives.stepCameraTrauma);
    expect(camera.detectTraumaImpulse).toBe(cameraDirectives.detectTraumaImpulse);
    expect(camera.computeParallaxOffset).toBe(cameraDirectives.computeParallaxOffset);
    expect(camera.DIALOGUE_ZOOM).toBe(cameraDirectives.DIALOGUE_ZOOM);
    expect(camera.MIN_CAMERA_ZOOM).toBe(cameraDirectives.MIN_CAMERA_ZOOM);
    expect(camera.MAX_CAMERA_ZOOM).toBe(cameraDirectives.MAX_CAMERA_ZOOM);
    expect(camera.CAMERA_ZOOM_DAMP).toBe(cameraDirectives.CAMERA_ZOOM_DAMP);
    expect(camera.TRAUMA_DECAY_PER_TICK).toBe(cameraDirectives.TRAUMA_DECAY_PER_TICK);
    expect(camera.MAX_SHAKE_X).toBe(cameraDirectives.MAX_SHAKE_X);
    expect(camera.MAX_SHAKE_Y).toBe(cameraDirectives.MAX_SHAKE_Y);
  });

  it("keeps camera-directives.ts Pixi-free and DOM-free and enforces strict line budgets", () => {
    const directivesSrc = readFileSync("src/render/camera-directives.ts", "utf8");
    const cameraSrc = readFileSync("src/render/camera.ts", "utf8");

    expect(directivesSrc).not.toContain("pixi.js");
    expect(directivesSrc).not.toMatch(/\b(document|window)\b/);
    expect(cameraSrc).not.toContain("pixi.js");

    expect(lineCount("src/render/camera.ts")).toBeLessThan(460);
    expect(lineCount("src/render/camera-directives.ts")).toBeLessThan(450);
    expect(lineCount("src/main.ts")).toBeLessThan(890);
  });
});
