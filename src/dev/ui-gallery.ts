import "../ui/sticker.css";
import {
  createDialogueBox,
  createPrompt,
  type DialogueView,
  type PromptView,
} from "../ui/sticker";
import { mountTouchControls } from "../ui/touch-controls";
import type { AtlasImage } from "../ui/atlas";
import {
  createBattleHud,
  createCommandMenu,
  createRewardSticker,
  createBattleCheck,
  createFeelingBubble,
  createWindUpBubbles,
  type BattleCheckView,
} from "../ui/battle";
import { createJournal } from "../ui/journal";
import { createArcade } from "../ui/arcade";
import { createTitleScreen } from "../ui/title";
import { createCredits } from "../ui/credits";
import {
  loadBrowserContent, parseClawCalibration, parseCookCalibration, parseFishCalibration,
  parseMoleCalibration, parseCometCalibration, parseSkeeCalibration, parseTacoCalibration,
} from "../content/load";
import { createState } from "../core";
import { atlasImage, atlasImagePath, type AtlasJson } from "../ui/atlas";
import { cropCreditFrame } from "../shell/assets";
import { clawGalleryView } from "./claw-gallery";
import { cookGalleryView } from "./cook-gallery";
import { fishGalleryView } from "./fish-gallery";
import { moleGalleryView } from "./mole-gallery";
import { cometGalleryView } from "./comet-gallery";
import { skeeGalleryView } from "./skee-gallery";
import { tacoGalleryView } from "./taco-gallery";
import {
  GALLERY_DEFAULT_DIALOGUE,
  GALLERY_DIALOGUE_VIEWS,
  buildGalleryBattleCheck,
  buildGalleryBattleHudView,
  buildGalleryCommandMenuView,
  buildGalleryCreditsEntries,
  buildGalleryFeelingBubble,
  buildGalleryJournalView,
  buildGalleryTitleView,
  buildGalleryWindUpBubbles,
  galleryBattleDialogue,
  galleryBattleTalk,
} from "./ui-gallery-fixtures";
import calibrationData from "../../public/assets/arcade/claw-machine.json";
import skeeCalibrationData from "../../public/assets/arcade/skee-lane.json";
import moleCalibrationData from "../../public/assets/arcade/mole-cabinet.json";
import cometCalibrationData from "../../public/assets/arcade/comet-cabinet.json";
import cookCalibrationData from "../../public/assets/arcade/microwave.json";
import fishCalibrationData from "../../public/assets/arcade/fishing-dock.json";
import tacoCalibrationData from "../../public/assets/arcade/taco-truck.json";
import foodAtlas from "../../public/assets/arcade/cook-food.json";
import fishAtlas from "../../public/assets/arcade/fish-catches.json";
import tacoAtlas from "../../public/assets/arcade/taco-ingredients.json";
import moleAtlas from "../../public/assets/arcade/moles.json";
import cometAtlas from "../../public/assets/arcade/comet.json";
import prizeAtlas from "../../public/assets/prizes/prizes.json";
import toysJson from "../../public/assets/battle/toys/toys.json";

// Load the runtime story asset before mounting any gallery DOM so tests that
// wait on `.sticker-dialogue` or `.battle-meter` always observe rendered state.
const content = await loadBrowserContent();
const root = document.querySelector<HTMLElement>("#gallery");
if (root === null) throw new Error("Missing gallery root");
document.body.className = "gallery-body";
document.body.style.backgroundColor = "#b8d5c0";
document.body.style.backgroundImage =
  "linear-gradient(#ffffff22, #ffffff22), url('assets/areas/plaza/ground_1_0.webp')";
document.body.style.backgroundSize = "cover";
const params = new URLSearchParams(window.location.search);
const insetValues = params.get("insets")?.split(",").map(Number);
if (insetValues?.length === 4 && insetValues.every(Number.isFinite)) {
  const [top, right, bottom, left] = insetValues;
  document.documentElement.style.setProperty("--safe-top", `${top}px`);
  document.documentElement.style.setProperty("--safe-right", `${right}px`);
  document.documentElement.style.setProperty("--safe-bottom", `${bottom}px`);
  document.documentElement.style.setProperty("--safe-left", `${left}px`);
}
if (params.get("touch") === "1") {
  mountTouchControls();
}
const stage = document.createElement("div");
stage.className = "gallery-stage";
root.append(stage);
const dialogue = createDialogueBox(stage);
const credits = createCredits(root);
const prompt = createPrompt(stage);
declare global {
  interface Window {
    __stickerGallery: {
      render: (view: DialogueView) => void;
      renderPrompt: (view: PromptView) => void;
      renderCheck: (view: BattleCheckView | null) => void;
      renderState: () => void;
    };
  }
}
const state = params.get("state") ?? "short";
const creditsState = state === "credits" || state === "credits-short";
const creditsFixture = content.fixtures["new-game"];
if (creditsFixture === undefined) throw new Error("Missing new-game fixture");
const creditsBase = createState(content.world, creditsFixture);
const atlasFiles = {
  ...import.meta.glob<AtlasJson>("../../public/assets/characters/*/*.json",
    { eager: true, import: "default" }),
  ...import.meta.glob<AtlasJson>("../../public/assets/critters/*/*.json",
    { eager: true, import: "default" }),
};
const creditsEntries = buildGalleryCreditsEntries(state, content.world, creditsBase);
const creditImage = (image: { atlas: string; frame: string }) => {
  const key = Object.keys(atlasFiles).find((path) => path.endsWith(image.atlas));
  const sheet = key === undefined ? undefined : atlasFiles[key];
  if (sheet === undefined) throw new Error(`Missing gallery atlas ${image.atlas}`);
  const loaded = atlasImage(sheet, atlasImagePath(image.atlas, sheet), image.frame);
  return { ...loaded, frame: cropCreditFrame(loaded.frame) };
};
const frogAtlasKey = Object.keys(atlasFiles).find(
  (path) => path.endsWith("assets/critters/frog/frog.json"),
);
const frogAtlasSheet = frogAtlasKey === undefined ? undefined : atlasFiles[frogAtlasKey];
if (frogAtlasSheet === undefined) throw new Error("Missing gallery frog atlas");
const frogAtlasSrc = atlasImagePath("assets/critters/frog/frog.json", frogAtlasSheet);
const arcadeFixture = content.fixtures.arcade;
if (arcadeFixture === undefined) throw new Error("Missing the arcade fixture");
const clawView = clawGalleryView(content.world, arcadeFixture, state);
const skeeView = skeeGalleryView(content.world, arcadeFixture, state);
const moleView = moleGalleryView(content.world, arcadeFixture, state);
const cometView = cometGalleryView(content.world, arcadeFixture, state);
const cookView = cookGalleryView(content.world, arcadeFixture, state);
const fishView = fishGalleryView(content.world, arcadeFixture, state);
const tacoView = tacoGalleryView(content.world, arcadeFixture, state);
const gameView = clawView ?? skeeView ?? moleView ?? cometView ?? cookView ?? fishView ?? tacoView;
const battleState = state.startsWith("battle-");
const journalState = state.startsWith("journal-");
const arcadeState = state.startsWith("arcade-") || state.startsWith("skee-") ||
  state.startsWith("mole-") || state.startsWith("comet-") || state.startsWith("cook-");
const titleState = state.startsWith("title-");
const dialogueShown = battleState
  ? state === "battle-command" || state === "battle-feelings" || state === "battle-windup" ||
    state === "battle-together" ||
    state === "battle-talk" || state === "battle-talk-reply" || state === "battle-level-up" ||
    state === "battle-reward"
  : state !== "prompt" && !journalState && !titleState && !creditsState &&
    (!arcadeState || state === "arcade-result" || state === "skee-result" ||
    state === "mole-result" || state === "comet-result" || state === "cook-result" ||
    state === "cook-burnt" || state === "arcade-fish-catch");
if (battleState) document.documentElement.dataset.battle = "open";
if (state === "battle-talk" || state === "battle-talk-reply")
  document.documentElement.dataset.talk = "open";
// A catch or a lean shows its touch arrows (spec 8.1).
if (state === "battle-catch") document.documentElement.dataset.check = "catch";
if (state === "battle-lean") document.documentElement.dataset.check = "lean";
if (state.startsWith("battle-trace")) document.documentElement.dataset.check = "trace";
if (state === "battle-echo") document.documentElement.dataset.check = "echo";
if (dialogueShown) document.documentElement.dataset.dialogue = "open";
if (journalState) document.documentElement.dataset.journal = "open";
if (arcadeState) document.documentElement.dataset.arcade = "open";
if (gameView !== null) document.documentElement.dataset.arcadeGame = gameView.game;
if (titleState) document.documentElement.dataset.title = "open";

const battleHud = createBattleHud(stage);
const commands = createCommandMenu(stage);
const check = createBattleCheck(stage);
const feelingBubble = createFeelingBubble(stage);
const windUpBubbles = createWindUpBubbles(stage);
const reward = createRewardSticker(stage);
const journal = createJournal(stage);

function atlasLookup(
  atlasPath: string,
  atlas: AtlasJson & { meta: { image: string; size: { w: number; h: number } } },
): { src: string; art: (frame: string) => AtlasImage | null } {
  const src = atlasImagePath(atlasPath, atlas);
  const frames = new Map(
    Object.entries(atlas.frames).map(([name, entry]) => [name, entry.frame]),
  );
  return {
    src,
    art: (frame) => {
      const rect = frames.get(frame);
      return rect === undefined
        ? null
        : {
            src,
            frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
            atlas: { w: atlas.meta.size.w, h: atlas.meta.size.h },
          };
    },
  };
}

const prizes = atlasLookup("assets/prizes/prizes.json", prizeAtlas);
const moles = atlasLookup("assets/arcade/moles.json", moleAtlas);
const comets = atlasLookup("assets/arcade/comet.json", cometAtlas);
const foods = atlasLookup("assets/arcade/cook-food.json", foodAtlas);
const fishes = atlasLookup("assets/arcade/fish-catches.json", fishAtlas);
const tacos = atlasLookup("assets/arcade/taco-ingredients.json", tacoAtlas);
const toysAtlasSrc = atlasImagePath("assets/battle/toys/toys.json", toysJson);

const arcade = createArcade(stage, prizes.art, {
  calibration: parseClawCalibration(calibrationData, "public/assets/arcade/claw-machine.json"),
  image: "assets/arcade/claw-machine.webp",
}, {
  calibration: parseSkeeCalibration(skeeCalibrationData, "public/assets/arcade/skee-lane.json"),
  image: "assets/arcade/skee-lane.webp",
}, {
  calibration: parseMoleCalibration(moleCalibrationData, "public/assets/arcade/mole-cabinet.json"),
  image: "assets/arcade/mole-cabinet.webp",
  art: moles.art,
  onHole: () => undefined,
}, {
  calibration: parseCometCalibration(cometCalibrationData,
    "public/assets/arcade/comet-cabinet.json"),
  image: "assets/arcade/comet-cabinet.webp",
  art: comets.art,
}, {
  calibration: parseCookCalibration(cookCalibrationData, "public/assets/arcade/microwave.json"),
  image: "assets/arcade/microwave.webp",
  art: foods.art,
}, {
  calibration: parseFishCalibration(fishCalibrationData, "public/assets/arcade/fishing-dock.json"),
  image: "assets/arcade/fishing-dock.webp",
  art: fishes.art,
}, undefined, undefined, {
  calibration: parseTacoCalibration(tacoCalibrationData, "public/assets/arcade/taco-truck.json"),
  image: "assets/arcade/taco-truck.webp",
  art: tacos.art,
});

const title = createTitleScreen(stage);
title.onChoose((id) => {
  root.dataset.titleChosen = id;
});
journal.onClose(() => {
  root.dataset.journalClosed = "true";
});
journal.onSetAudioLevel(() => undefined);
journal.onToggleMusic(() => undefined);
journal.onSetMusicLevel(() => undefined);
journal.onToggleAmbience(() => undefined);
journal.onToggleGentleTiming(() => undefined);
journal.onToggleKeyHints(() => undefined);
commands.onChoose((index) => {
  root.dataset.battleChosen = String(index);
});
battleHud.onTogether(() => {
  root.dataset.battleTogether = "true";
});
battleHud.onFlute(() => {
  root.dataset.battleFlute = "true";
});
check.onEchoNote((note) => {
  root.dataset.echoNote = String(note);
});
dialogue.onChoose((index) => {
  root.dataset.chosen = String(index);
});

const galleryTalk = galleryBattleTalk(state);
const tennisBall = (index: 0 | 1): AtlasImage => atlasImage(
  toysJson,
  toysAtlasSrc,
  index === 0 ? "tennis-ball-01" : "tennis-ball-02",
);

function renderGalleryState(): void {
  title.render(buildGalleryTitleView(state, titleState));
  journal.render(buildGalleryJournalView({
    state,
    journalState,
    world: content.world,
    creditsBase,
    frogAtlasSrc,
    galleryPrizeArt: prizes.art,
  }));
  if (state === "journal-options") journal.setPage("options");
  battleHud.render(buildGalleryBattleHudView(state, battleState, galleryTalk));
  const friends = Math.max(1, Number(params.get("party") ?? "1"));
  commands.render(buildGalleryCommandMenuView(state, friends));
  const cloudAt = { x: Math.round(innerWidth * 0.36), y: 96 };
  feelingBubble.render(buildGalleryFeelingBubble(state, cloudAt));
  windUpBubbles.render(buildGalleryWindUpBubbles(state, cloudAt));
  check.render(buildGalleryBattleCheck(
    state,
    { width: innerWidth, height: innerHeight },
    tennisBall,
  ));
  const prize = clawView?.prize ?? null;
  reward.render(prize !== null ? {
    visible: true, title: prize.title, name: prize.name, image: prizes.art(prize.frame),
  } : {
    visible: state === "battle-reward",
    title: "NEW STICKER!",
    name: "Fountain Frog",
    image: {
      src: frogAtlasSrc,
      frame: { x: 0, y: 512, w: 512, h: 512 },
      atlas: { w: 1536, h: 1024 },
    },
  });
  credits.render({
    visible: creditsState,
    entries: creditsEntries.map((entry) => ({ ...entry, image: creditImage(entry.image) })),
  });
  if (creditsState) document.documentElement.dataset.credits = "open";
  else delete document.documentElement.dataset.credits;
  arcade.render(gameView);
  prompt.render({
    label: "TALK",
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    visible: state === "prompt",
  });
  if (!dialogueShown) dialogue.hide();
  else if (battleState) dialogue.render(galleryBattleDialogue(state, galleryTalk));
  else if (gameView !== null) {
    dialogue.render({
      speaker: null,
      text: gameView.message,
      revealed: gameView.revealed,
      choices: [],
      selected: -1,
      canAdvance: true,
    });
  } else dialogue.render(GALLERY_DIALOGUE_VIEWS[state] ?? GALLERY_DEFAULT_DIALOGUE);
}
window.__stickerGallery = {
  render: (view) => dialogue.render(view),
  renderPrompt: (view) => prompt.render(view),
  renderCheck: (view) => check.render(view),
  renderState: renderGalleryState,
};
renderGalleryState();
window.addEventListener("resize", renderGalleryState);
// The arcade's paintings and atlases are CSS backgrounds, which neither the
// fonts nor a frame wait for: decode the ones this state shows, then mark ready.
const arcadeArt = ["assets/arcade/claw-machine.webp", "assets/arcade/skee-lane.webp",
  "assets/arcade/mole-cabinet.webp", moles.src, prizes.src,
  "assets/arcade/microwave.webp", foods.src,
  "assets/arcade/fishing-dock.webp", fishes.src,
  "assets/arcade/taco-truck.webp", tacos.src,
  "assets/arcade/comet-cabinet.webp", comets.src];
const backgrounds = [...document.body.querySelectorAll<HTMLElement>("*")]
  .filter((element) => element.checkVisibility())
  .map((element) => getComputedStyle(element).backgroundImage);
const decoded = (src: string): Promise<void> => {
  const image = new Image();
  image.src = src;
  return image.decode();
};
void Promise.all([document.fonts.ready, ...arcadeArt
  .filter((src) => backgrounds.some((image) => image.includes(src))).map(decoded)])
  .then(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      }),
  )
  .then(() => {
    renderGalleryState();
    root.dataset.ready = "true";
  });
