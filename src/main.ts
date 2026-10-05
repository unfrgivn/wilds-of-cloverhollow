import { Application } from "pixi.js";
import { createState, step, type ActionFrame, type State } from "./core";
import { loadContent } from "./content/load";
import { Keyboard } from "./platform/keyboard";
import { createInputSource } from "./platform/input";
import { GameView } from "./render/view";

const content = loadContent();
const app = new Application();
let state: State;
let paused = false;

async function boot(): Promise<void> {
  await app.init({
    resizeTo: window,
    backgroundColor: 0xf8edcf,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio, 2),
  });
  app.renderer.background.color = 0xf8edcf;
  const root = document.querySelector("#app");
  if (root === null) throw new Error("Missing #app root");
  root.appendChild(app.canvas);
  const keyboard = new Keyboard();
  const input = createInputSource(() => keyboard.frame());
  const view = new GameView(content.world);
  app.stage.addChild(view.root);
  const initialFixture = content.fixtures["new-game"];
  if (initialFixture === undefined) throw new Error("Missing new-game fixture");
  state = createState(content.world, initialFixture);
  const render = (): void =>
    view.render(
      state,
      window.innerWidth,
      window.innerHeight,
      app.renderer.resolution,
    );
  const tick = (frame: ActionFrame): void => {
    state = step(content.world, state, frame).state;
  };
  window.addEventListener("resize", render);
  let last = performance.now();
  let accumulator = 0;
  app.ticker.add(() => {
    const now = performance.now();
    accumulator += Math.min(now - last, 250);
    last = now;
    if (!paused) {
      let ticks = 0;
      while (accumulator >= 1000 / 60 && ticks < 5) {
        tick(input.next());
        accumulator -= 1000 / 60;
        ticks += 1;
      }
      if (ticks === 5) accumulator = 0;
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
      render,
      paused: () => paused,
      setPaused: (value) => {
        paused = value;
      },
      reset: (options) => {
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
        view.resetCamera();
      },
    });
  }
}

void boot();
