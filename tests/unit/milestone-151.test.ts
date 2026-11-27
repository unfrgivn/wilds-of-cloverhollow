import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent, storyTags } from "../../src/content/load";
import {
  bindOverworldPointerSteer,
  photoModePointerAction,
  type OverworldPointerEvent,
  type OverworldPointerTarget,
} from "../../src/shell/overworld-pointer";
import { speakerPortraitSource } from "../../src/ui/portraits";

const SIGN_SPEAKERS = new Set([
  "sign",
  "notice board",
  "sanctuary board",
  "glow note",
  "chalkboard",
  "flyer",
  "trail note",
]);

type PointerListenerMap = Record<string, ((event: OverworldPointerEvent) => void)[]>;

function createFakeCanvas(): {
  canvas: OverworldPointerTarget;
  emit: (type: string, event: OverworldPointerEvent) => void;
} {
  const listeners: PointerListenerMap = {};
  const canvas: OverworldPointerTarget = {
    addEventListener: (type, listener) => {
      const bucket = listeners[type] ?? [];
      bucket.push(listener);
      listeners[type] = bucket;
    },
    setPointerCapture: () => undefined,
  };
  const emit = (type: string, event: OverworldPointerEvent): void => {
    for (const listener of listeners[type] ?? []) listener(event);
  };
  return { canvas, emit };
}

function makePointerEvent(
  overrides: Partial<OverworldPointerEvent> = {},
): { event: OverworldPointerEvent; prevented: () => boolean } {
  let didPrevent = false;
  const event: OverworldPointerEvent = {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: 300,
    clientY: 200,
    preventDefault: () => {
      didPrevent = true;
    },
    ...overrides,
  };
  return { event, prevented: () => didPrevent };
}

describe("Milestone 151: 100% Cast Bust-Portrait Coverage", () => {
  it("resolves a painted portrait for every non-sign compiled speaker and every critter", () => {
    const { world } = loadContent();
    const speakers = new Set<string>();

    for (const tag of storyTags(world.story)) {
      const match = /^speaker:\s*(.+)$/i.exec(tag);
      if (match?.[1] !== undefined) speakers.add(match[1].trim());
    }
    for (const critter of Object.values(world.critters)) {
      speakers.add(critter.name);
    }

    const missing: string[] = [];
    let nonSignCount = 0;
    for (const speaker of [...speakers].sort()) {
      if (SIGN_SPEAKERS.has(speaker.toLowerCase())) continue;
      nonSignCount += 1;
      if (speakerPortraitSource(world, speaker) === null) {
        missing.push(speaker);
      }
    }

    expect(nonSignCount).toBeGreaterThanOrEqual(113);
    expect(missing).toEqual([]);

    expect(speakerPortraitSource(world, "Baker")).toEqual({
      atlas: world.characters.chef?.atlas,
      frame: "down_idle_01",
      cropMode: "adult",
    });
    expect(speakerPortraitSource(world, "Cocoa seller")).toEqual({
      atlas: world.characters["pass-keeper"]?.atlas,
      frame: "down_idle_01",
      cropMode: "adult",
    });
  });
});

describe("Milestone 151: Desktop Photo Mode Click-to-Snap & Right-Click-to-Exit", () => {
  it("classifies photoModePointerAction cleanly across desktop, touch, and inactive states", () => {
    expect(
      photoModePointerAction({
        photoMode: true,
        touchUiActive: false,
        pointerType: "mouse",
        button: 0,
        eventType: "pointerup",
      }),
    ).toBe("snap");

    expect(
      photoModePointerAction({
        photoMode: true,
        touchUiActive: false,
        pointerType: "pen",
        button: 0,
        eventType: "pointerup",
      }),
    ).toBe("snap");

    expect(
      photoModePointerAction({
        photoMode: true,
        touchUiActive: false,
        pointerType: "mouse",
        button: 2,
        eventType: "pointerup",
      }),
    ).toBeNull();

    expect(
      photoModePointerAction({
        photoMode: true,
        touchUiActive: false,
        pointerType: "mouse",
        button: 2,
        eventType: "contextmenu",
      }),
    ).toBe("exit");

    expect(
      photoModePointerAction({
        photoMode: false,
        touchUiActive: false,
        pointerType: "mouse",
        button: 0,
        eventType: "pointerup",
      }),
    ).toBeNull();

    expect(
      photoModePointerAction({
        photoMode: false,
        touchUiActive: false,
        pointerType: "mouse",
        button: 2,
        eventType: "contextmenu",
      }),
    ).toBeNull();

    expect(
      photoModePointerAction({
        photoMode: true,
        touchUiActive: true,
        pointerType: "mouse",
        button: 0,
        eventType: "pointerup",
      }),
    ).toBeNull();

    expect(
      photoModePointerAction({
        photoMode: true,
        touchUiActive: true,
        pointerType: "mouse",
        button: 2,
        eventType: "contextmenu",
      }),
    ).toBeNull();

    expect(
      photoModePointerAction({
        photoMode: true,
        touchUiActive: false,
        pointerType: "touch",
        button: 0,
        eventType: "pointerup",
      }),
    ).toBeNull();

    expect(
      photoModePointerAction({
        photoMode: true,
        touchUiActive: false,
        pointerType: "touch",
        button: 2,
        eventType: "contextmenu",
      }),
    ).toBeNull();
  });

  it("snaps on <= 12 px desktop click, ignores drags, and exits on prevented contextmenu", () => {
    const { canvas, emit } = createFakeCanvas();
    let photoMode = true;
    let touchUi = false;
    let snaps = 0;
    let exits = 0;

    const steer = bindOverworldPointerSteer({
      canvas,
      canSteer: () => !photoMode,
      playerScreen: () => ({ x: 640, y: 360 }),
      onMove: () => undefined,
      isPhotoMode: () => photoMode,
      isTouchUi: () => touchUi,
      onPhotoSnap: () => {
        snaps += 1;
      },
      onPhotoExit: () => {
        exits += 1;
        photoMode = false;
      },
    });

    // Crisp left-click (<= 12 px drag) snaps once even if render() calls release() mid-click.
    const down1 = makePointerEvent({ pointerId: 1, clientX: 400, clientY: 300 });
    const up1 = makePointerEvent({ pointerId: 1, clientX: 408, clientY: 306 });
    emit("pointerdown", down1.event);
    steer.release();
    emit("pointerup", up1.event);
    expect(down1.prevented()).toBe(true);
    expect(snaps).toBe(1);

    // Drag > 12 px does NOT snap.
    emit("pointerdown", makePointerEvent({ pointerId: 2, clientX: 400, clientY: 300 }).event);
    emit("pointerup", makePointerEvent({ pointerId: 2, clientX: 425, clientY: 300 }).event);
    expect(snaps).toBe(1);

    // Touch UI active suppresses both snap and right-click exit.
    touchUi = true;
    emit("pointerdown", makePointerEvent({ pointerId: 3, clientX: 400, clientY: 300 }).event);
    emit("pointerup", makePointerEvent({ pointerId: 3, clientX: 400, clientY: 300 }).event);
    const touchCtx = makePointerEvent({ pointerId: 4, button: 2 });
    emit("contextmenu", touchCtx.event);
    expect(snaps).toBe(1);
    expect(exits).toBe(0);
    expect(touchCtx.prevented()).toBe(false);

    // Desktop right-click prevents context menu and exits Photo Mode.
    touchUi = false;
    const desktopCtx = makePointerEvent({ pointerId: 5, button: 2 });
    emit("contextmenu", desktopCtx.event);
    expect(desktopCtx.prevented()).toBe(true);
    expect(exits).toBe(1);
    expect(photoMode).toBe(false);

    // Outside Photo Mode, contextmenu is untouched.
    const normalCtx = makePointerEvent({ pointerId: 6, button: 2 });
    emit("contextmenu", normalCtx.event);
    expect(normalCtx.prevented()).toBe(false);
    expect(exits).toBe(1);
  });
});

describe("Milestone 151: Dialogue Portrait Talking Bob CSS Fix", () => {
  it("scopes portrait-bob to .sticker-portrait-img and disables it under reduced motion", () => {
    const css = readFileSync("src/ui/sticker.css", "utf8");
    expect(css).toContain(".sticker-portrait.is-talking .sticker-portrait-img {");
    expect(css).not.toMatch(/\.sticker-portrait\.is-talking\s*\{/);

    const mediaIdx = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(mediaIdx).toBeGreaterThan(-1);
    const mediaBlock = css.slice(mediaIdx, css.indexOf("\n}\n", mediaIdx) + 3);
    expect(mediaBlock).toContain(".sticker-portrait.is-talking .sticker-portrait-img");
    expect(mediaBlock).not.toMatch(/\.sticker-portrait\.is-talking\s*,/);

    expect(css).toContain(
      ':root[data-reduced-motion="on"] .sticker-portrait.is-talking .sticker-portrait-img {',
    );
  });
});
