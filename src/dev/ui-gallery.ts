import "../ui/sticker.css";
import { createDialogueBox, createPrompt, type DialogueView } from "../ui/sticker";
import { mountTouchControls } from "../ui/touch-controls";

const root = document.querySelector<HTMLElement>("#gallery");
if (root === null) throw new Error("Missing gallery root");
document.body.className = "gallery-body";
document.body.style.backgroundColor = "#b8d5c0";
document.body.style.backgroundImage =
  "linear-gradient(#ffffff22, #ffffff22), url('assets/areas/plaza/ground_1_0.webp')";
document.body.style.backgroundSize = "cover";
const params = new URLSearchParams(window.location.search);
let touchMounted = false;
if (params.get("touch") === "1") {
  mountTouchControls();
  touchMounted = true;
}
const stage = document.createElement("div");
stage.className = "gallery-stage";
root.append(stage);
const dialogue = createDialogueBox(stage);
const prompt = createPrompt(stage);
declare global {
  interface Window {
    __stickerGallery: { render: (view: DialogueView) => void };
  }
}
window.__stickerGallery = { render: (view) => dialogue.render(view) };
const state = params.get("state") ?? "short";
if (touchMounted && state !== "prompt") {
  document.querySelector<HTMLElement>(".touch-stick")?.style.setProperty("display", "none");
}
const defaultView: DialogueView = { speaker: "Maddie", text: "The fountain is singing today!",
  revealed: 32, choices: [], selected: -1, canAdvance: true };
const views: Record<string, DialogueView> = {
  short: defaultView,
  long: { speaker: "Fae", text: "The town feels different. Maybe we should ask around and " +
    "find out what happened before the sun goes down.", revealed: 109, choices: [], selected: -1,
    canAdvance: true },
  "long-max": { speaker: "Fae",
    text: "Painted windows whisper clues about gentle magic in Cloverhollow today.",
    revealed: 71, choices: [], selected: -1, canAdvance: true },
  revealing: { speaker: "Sue", text: "I saw a curious sparkle by the old notice board.",
    revealed: 18,
    choices: [], selected: -1, canAdvance: false },
  "speaker-board": { speaker: "NOTICE BOARD", text: "A hand-painted note flutters in the breeze.",
    revealed: 100, choices: [], selected: -1, canAdvance: true },
  "two-choices": { speaker: "Fae", text: "What should we do first?", revealed: 100,
    choices: [{ text: "Investigate the window" }, { text: "Go to school" }], selected: 0,
    canAdvance: false },
  "three-choices": { speaker: "Maddie", text: "Which sticker should we take?", revealed: 100,
    choices: [{ text: "A bright leaf" }, { text: "A tiny moon" }, { text: "A friendly star" }],
    selected: 1, canAdvance: false },
  "touch-overlap": { speaker: "Fae", text: "The controls stay clear while we talk.", revealed: 100,
    choices: [{ text: "Okay!" }], selected: 0, canAdvance: false },
  prompt: { speaker: null, text: "", revealed: 0, choices: [], selected: -1, canAdvance: false },
};
dialogue.onChoose((index) => { root.dataset.chosen = String(index); });
if (state === "prompt") {
  dialogue.hide();
  prompt.render({ label: "TALK", x: window.innerWidth / 2, y: window.innerHeight / 2,
    visible: true });
} else {
  const selectedView = views[state];
  dialogue.render(selectedView === undefined ? defaultView : selectedView);
  prompt.render({ label: "TALK", x: 100, y: 100, visible: false });
}
