import { Application } from "pixi.js";
import {
  createState,
  drainTicks,
  step,
  type ActionFrame,
  type State,
} from "./core";
import { loadContent } from "./content/load";
import { Keyboard } from "./platform/keyboard";
import { createInputSource } from "./platform/input";
import { mountTouchControls } from "./ui/touch-controls";
import { GameView } from "./render/view";
import { preventPinchZoom } from "./platform/gestures";

const content = loadContent();
const app = new Application();
let state: State;
let paused = false;

async function boot(): Promise<void> {
  preventPinchZoom();
  await app.init({
    resizeTo: window,
    backgroundColor: 0xf8edcf,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio, 2),
    // Keep the canvas at viewport size in CSS pixels; only the backing store is 2x.
    autoDensity: true,
    preference: "webgl",
  });
  app.renderer.background.color = 0xf8edcf;
  const root = document.querySelector("#app");
  if (root === null) throw new Error("Missing #app root");
  root.appendChild(app.canvas);
  const keyboard = new Keyboard();
  const touch = mountTouchControls();
  const input = createInputSource(() => {
    const keyboardFrame = keyboard.frame();
    const touchFrame = touch.sample();
    return {
      move:
        touchFrame.move.x !== 0 || touchFrame.move.y !== 0
          ? touchFrame.move
          : keyboardFrame.move,
      confirm: keyboardFrame.confirm || touchFrame.confirm,
      cancel: keyboardFrame.cancel || touchFrame.cancel,
      menu: keyboardFrame.menu || touchFrame.menu,
    };
  });
  const view = new GameView(content.world, {
    debugLabel: import.meta.env.DEV || import.meta.env.MODE === "harness",
  });
  app.stage.addChild(view.root);
  const initialFixture = content.fixtures["new-game"];
  if (initialFixture === undefined) throw new Error("Missing new-game fixture");
  state = createState(content.world, initialFixture);
  await view.ready;
  const initialArea = content.world.areas[state.area];
  if (initialArea === undefined) throw new Error("Missing initial area");
  await view.setArea(initialArea);
  let afterTick = (_next: State): void => undefined;
  if (import.meta.env.DEV || import.meta.env.MODE === "harness") {
    const { createStateLogger } = await import("./dev/state-log");
    afterTick = createStateLogger();
    afterTick(state);
  }
  const render = (): void => {
    view.render(
      state,
      window.innerWidth,
      window.innerHeight,
      app.renderer.resolution,
    );
  };
  const tick = (frame: ActionFrame): void => {
    state = step(content.world, state, frame).state;
    afterTick(state);
  };
  let areaLoad: Promise<void> | undefined;
  // Loads whatever area the state is in. If a load for an older target is still
  // in flight, waits for it and checks again, so callers always end up with the
  // current area loaded.
  const ensureArea = async (): Promise<void> => {
    for (;;) {
      if (areaLoad !== undefined) {
        await areaLoad;
        continue;
      }
      const area = content.world.areas[state.area];
      if (area === undefined) throw new Error(`Unknown area ${state.area}`);
      if (view.loadedAreaId() === area.id) return;
      areaLoad = view.setArea(area).then(() => view.resetCamera()).finally(() => {
        areaLoad = undefined;
      });
    }
  };
  window.addEventListener("resize", render);
  let last = performance.now();
  let accumulator = 0;
  app.ticker.add(() => {
    const now = performance.now();
    accumulator += Math.min(now - last, 250);
    last = now;
    if (areaLoad !== undefined) {
      accumulator = 0;
    } else if (!paused) {
      const drained = drainTicks(accumulator, 1000 / 60, 5);
      accumulator = drained.remainingMs;
      for (let index = 0; index < drained.ticks; index += 1) {
        tick(input.next());
        if (view.loadedAreaId() !== state.area) {
          accumulator = 0;
          void ensureArea();
          break;
        }
      }
    }
    render();
  });
  render();
  if (import.meta.env.DEV || import.meta.env.MODE === "harness") {
    const { installHook } = await import("./dev/hook");
    installHook({
      input,
      get: () => state,
      tick,
      ensureArea,
      render,
      paused: () => paused,
      setPaused: (value) => {
        paused = value;
      },
      reset: async (options) => {
        keyboard.clearTaps();
        const name = options.fixture ?? "new-game";
        const fixture = content.fixtures[name];
        if (fixture === undefined)
          throw new Error(
            `Unknown fixture "${name}". Known fixtures: ${Object.keys(
              content.fixtures,
            ).join(", ")}`,
          );
        state = createState(content.world, fixture, options.seed);
        await ensureArea();
      },
      renderInfo: () => view.renderInfo(state),
    });
  }
}

boot().catch((error: unknown) => {
  // Capacitor forwards console.error to the native log, so iOS failures are visible.
  const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  console.error(`[cloverhollow] boot failed: ${detail}`);
});
