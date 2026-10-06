import { Application } from "pixi.js";
import {
  createState,
  drainTicks,
  step,
  type ActionFrame,
  type State,
  battleView,
} from "./core";
import { loadContent } from "./content/load";
import { Keyboard } from "./platform/keyboard";
import { createInputSource } from "./platform/input";
import { mountTouchControls } from "./ui/touch-controls";
import { GameView } from "./render/view";
import { preventPinchZoom } from "./platform/gestures";
import { createDialogueBox, createPrompt } from "./ui/sticker";
import {
  createBattleHud,
  createCommandMenu,
  createTimingRing,
  createRewardSticker,
} from "./ui/battle";
import { assetUrl } from "./platform/assets";

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
  const uiRoot = document.createElement("div");
  document.body.append(uiRoot);
  const dialogueBox = createDialogueBox(uiRoot);
  const prompt = createPrompt(uiRoot);
  const battleHud = createBattleHud(uiRoot);
  const commandMenu = createCommandMenu(uiRoot);
  const timingRing = createTimingRing(uiRoot);
  const rewardSticker = createRewardSticker(uiRoot);
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
      choose: touchFrame.choose,
    };
  });
  dialogueBox.onChoose((index) => touch.tapChoice(index));
  commandMenu.onChoose((index) => touch.tapChoice(index));
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
  let lastBattleLog = "";
  let lastBattleButtonsLog = "";
  if (import.meta.env.DEV || import.meta.env.MODE === "harness") {
    const { createStateLogger, logPointers, logTouchLayout } =
      await import("./dev/state-log");
    logTouchLayout();
    logPointers();
    afterTick = createStateLogger(content.world);
    afterTick(state);
  }
  const render = (): void => {
    view.render(
      state,
      window.innerWidth,
      window.innerHeight,
      app.renderer.resolution,
    );
    prompt.render(
      state.battle === null
        ? view.promptView(state)
        : { visible: false, label: "", x: 0, y: 0 },
    );
    const battle = battleView(content.world, state);
    const activeBattle = battle !== null;
    if (activeBattle) document.documentElement.dataset.battle = "open";
    else delete document.documentElement.dataset.battle;
    battleHud.render({
      visible: activeBattle && state.battle?.phase !== "reward",
      energy: battle?.energy ?? 0,
      energyMax: battle?.energyMax ?? 0,
      calm: battle === null ? 0 : battle.calm / Math.max(1, battle.calmMax),
      critterName: activeBattle
        ? (content.world.critters[state.battle?.critterId ?? ""]?.name ?? "")
        : "",
    });
    commandMenu.render({
      visible: activeBattle && state.battle?.phase === "command",
      commands: battle?.commands ?? [],
      selected: battle?.selected ?? 0,
    });
    if (
      activeBattle &&
      state.battle?.phase === "command" &&
      (import.meta.env.DEV || import.meta.env.MODE === "harness")
    ) {
      const rects = [
        ...uiRoot.querySelectorAll<HTMLElement>(".battle-command"),
      ].map((item) => {
        const rect = item.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      const encoded = JSON.stringify(rects);
      if (encoded !== lastBattleButtonsLog) {
        console.log(`[cloverhollow] battle-buttons ${encoded}`);
        lastBattleButtonsLog = encoded;
      }
    }
    const ring = view.battleRingView(
      state,
      window.innerWidth,
      window.innerHeight,
    );
    timingRing.render({
      visible: activeBattle && battle?.aim !== null,
      x: ring?.x ?? 0,
      y: ring?.y ?? 0,
      radius: ring?.radius ?? 0,
      progress: battle?.aim?.progress ?? 0,
      target: battle?.aim?.target ?? 0,
      grade: battle?.lastGrade ?? null,
    });
    const frog = content.world.critters.frog;
    rewardSticker.render({
      visible: activeBattle && state.battle?.phase === "reward",
      title: "NEW STICKER!",
      name: frog?.sticker.name ?? "",
      image: {
        src: assetUrl(
          frog?.atlas.replace(".json", ".png") ??
            "assets/critters/frog/frog.png",
        ),
        frame: { x: 0, y: 512, w: 512, h: 512 },
        atlas: { w: 1536, h: 1024 },
      },
    });
    if (activeBattle) dialogueBox.hide();
    if (activeBattle && (battle?.message ?? "") !== "") {
      dialogueBox.render({
        speaker: null,
        text: battle?.message ?? "",
        revealed: battle?.revealed ?? 0,
        choices: [],
        selected: -1,
        canAdvance: battle !== null && battle.revealed >= battle.message.length,
      });
      document.documentElement.dataset.dialogue = "open";
    } else if (activeBattle) {
      dialogueBox.hide();
      delete document.documentElement.dataset.dialogue;
    } else if (state.dialogue === null) {
      dialogueBox.hide();
      delete document.documentElement.dataset.dialogue;
    } else {
      document.documentElement.dataset.dialogue = "open";
      dialogueBox.render({
        speaker: state.dialogue.speaker,
        text: state.dialogue.text,
        revealed: state.dialogue.revealed,
        // Choices appear once the line has finished typing (spec section 7).
        choices:
          state.dialogue.revealed >= state.dialogue.text.length
            ? state.dialogue.choices.map((text) => ({ text }))
            : [],
        selected: state.dialogue.selected,
        canAdvance: state.dialogue.choices.length === 0,
      });
    }
  };
  const tick = (frame: ActionFrame): void => {
    state = step(content.world, state, frame).state;
    if (import.meta.env.DEV || import.meta.env.MODE === "harness") {
      const log =
        state.battle === null
          ? "closed"
          : `${state.battle.phase}|${state.battle.message}`;
      if (log !== lastBattleLog) {
        const payload = {
          phase: state.battle?.phase ?? null,
          message: state.battle?.message ?? "",
        };
        console.log(`[cloverhollow] battle ${JSON.stringify(payload)}`);
        lastBattleLog = log;
      }
    }
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
      areaLoad = view
        .setArea(area)
        .then(() => view.resetCamera())
        .finally(() => {
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
  const detail =
    error instanceof Error
      ? `${error.message}\n${error.stack ?? ""}`
      : String(error);
  console.error(`[cloverhollow] boot failed: ${detail}`);
});
