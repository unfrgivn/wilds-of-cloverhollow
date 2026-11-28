import "../ui/qa.css";
import { Preferences } from "@capacitor/preferences";
import type { State, TextSpeed } from "../core";
import {
  readQaCheatSnapshot,
  thresholdForLevel,
  type ConsoleContext,
  type ConsoleOutcome,
  type ToolName,
} from "./console";

export { levelForThresholds, runConsoleCommand, thresholdForLevel } from "./console";
export type { ConsoleContext, ConsoleOutcome } from "./console";

export type QaPack = {
  id: string; label: string; note: string; fixture: string; run: string;
  tick: number; interim: boolean; hash: string;
};
type RawModule = string | Record<string, unknown>;
export type PackState = { pack: QaPack; save: string };

// Console saves live beside the player's slot, never inside it (spec 11).
const slotIndexKey = "cloverhollow-qa-slots";
const slotKey = (name: string): string => `cloverhollow-qa-save:${name}`;
export type QaSlotMeta = { name: string; tick: number; hash: string };

function isSlotMeta(value: unknown): value is QaSlotMeta {
  if (typeof value !== "object" || value === null) return false;
  const entry: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  return typeof entry.name === "string" && entry.name !== "" &&
    /^[a-z0-9][a-z0-9-]{0,23}$/.test(entry.name) &&
    typeof entry.tick === "number" && typeof entry.hash === "string";
}

async function readSlotIndex(): Promise<QaSlotMeta[]> {
  const { value } = await Preferences.get({ key: slotIndexKey });
  if (value === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isSlotMeta);
}

// The console's saved slots, listed in the QA menu after the packs. A slot
// whose save is missing (cleared storage) drops out of the list.
export async function loadQaSlots(): Promise<PackState[]> {
  const slots: PackState[] = [];
  for (const meta of await readSlotIndex()) {
    const { value } = await Preferences.get({ key: slotKey(meta.name) });
    if (value === null) continue;
    slots.push({
      pack: {
        id: `slot:${meta.name}`, label: `Saved: ${meta.name}`,
        note: `A console save at tick ${meta.tick}.`, fixture: "console", run: "",
        tick: meta.tick, interim: true, hash: meta.hash,
      },
      save: value,
    });
  }
  return slots;
}

export async function saveQaSlot(meta: QaSlotMeta, save: string): Promise<void> {
  const index = (await readSlotIndex()).filter((entry) => entry.name !== meta.name);
  index.push(meta);
  await Preferences.set({ key: slotKey(meta.name), value: save });
  await Preferences.set({ key: slotIndexKey, value: JSON.stringify(index) });
}

const metadata = import.meta.glob("../../content/qa/saves.json", {
  eager: true, import: "default",
});
const saveFiles = import.meta.glob("../../content/qa/saves/*.json", {
  eager: true, query: "?raw", import: "default",
});

function isPack(item: unknown): item is QaPack {
  if (typeof item !== "object" || item === null) return false;
  const value: Record<string, unknown> = Object.fromEntries(Object.entries(item));
  return typeof value.id === "string" && typeof value.label === "string" &&
    typeof value.note === "string" && typeof value.fixture === "string" &&
    typeof value.run === "string" && typeof value.tick === "number" &&
    typeof value.interim === "boolean" && typeof value.hash === "string";
}

function readMetadata(): QaPack[] {
  const value = Object.values(metadata)[0];
  if (!Array.isArray(value)) throw new Error("QA save manifest is not an array");
  return value.map((item, index) => {
    if (!isPack(item)) throw new Error(`Invalid QA save manifest entry ${index}`);
    return item;
  });
}

function rawString(value: RawModule | undefined): string | null {
  if (typeof value === "string") return value;
  if (value !== undefined && typeof value.default === "string") return value.default;
  return null;
}

export function loadQaPacks(): PackState[] {
  return readMetadata().map((pack) => {
    const path = Object.keys(saveFiles).find((item) => item.endsWith(`/${pack.id}.json`));
    const save = rawString(path === undefined ? undefined : saveFiles[path]);
    if (save === null) throw new Error(`Missing QA save ${pack.id}`);
    return { pack, save };
  });
}

export function qaPackFromUrl(packs: PackState[], search: string): PackState | null {
  const id = new URLSearchParams(search).get("qa");
  if (id === null) return null;
  const found = packs.find((item) => item.pack.id === id);
  if (found === undefined)
    throw new Error(
      `Unknown QA save "${id}". Known saves: ${packs.map((item) => item.pack.id).join(", ")}`,
    );
  return found;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className; return node;
}

export function createQaMenu(root: HTMLElement, entries: PackState[]): {
  render: (visible: boolean, selected: number) => void;
  onChoose: (callback: (pack: PackState) => void) => void;
  onCancel: (callback: () => void) => void;
  setEntries: (entries: PackState[]) => void;
} {
  let choose: (pack: PackState) => void = () => undefined;
  let cancel: () => void = () => undefined;
  const menu = el("main", "qa-menu");
  menu.hidden = true; menu.setAttribute("aria-label", "QA save library");
  const card = el("div", "qa-card");
  const heading = el("h1", "qa-heading");
  heading.textContent = "QA save library";
  const list = el("div", "qa-list"); list.setAttribute("role", "listbox");
  let buttons: HTMLButtonElement[] = [];
  const buildOptions = (items: PackState[]): void => {
    for (const button of buttons) button.remove();
    buttons = items.map((item) => {
      const button = el("button", "qa-option");
      button.type = "button"; button.dataset.id = item.pack.id;
      const label = el("strong", "qa-option-label");
      label.textContent = item.pack.label;
      const note = el("small", "qa-option-note");
      note.textContent = item.pack.note;
      button.append(label, note);
      button.addEventListener("click", () => choose(item));
      list.append(button); return button;
    });
  };
  buildOptions(entries);
  card.append(heading, list); menu.append(card); root.append(menu);
  const back = el("button", "qa-back"); back.type = "button"; back.textContent = "Back to title";
  back.addEventListener("click", () => cancel()); card.append(back);
  return {
    onChoose: (callback) => { choose = callback; },
    onCancel: (callback) => { cancel = callback; },
    setEntries: (items) => { buildOptions(items); },
    render: (visible, selected) => {
      menu.hidden = !visible;
      buttons.forEach((button, index) => button.setAttribute(
        "aria-selected", String(index === selected),
      ));
    },
  };
}

export function createQaBadge(root: HTMLElement): {
  render: (pack: QaPack | null) => void;
  onOpen: (callback: () => void) => void;
} {
  let open: () => void = () => undefined;
  const badge = el("button", "qa-badge");
  badge.type = "button"; badge.hidden = true;
  badge.addEventListener("click", () => open());
  root.append(badge);
  return {
    onOpen: (callback) => { open = callback; },
    render: (pack) => {
      badge.hidden = pack === null;
      badge.textContent = pack === null ? "" : `QA · ${pack.label}`;
    },
  };
}

export function createSandboxPack(tick: number): QaPack {
  return {
    id: "sandbox",
    label: "Sandbox",
    note: "Live QA sandbox.",
    fixture: "sandbox",
    run: "",
    tick,
    interim: true,
    hash: "",
  };
}

/** Enters a synthetic Sandbox QA pack when a live-game edit occurs outside QA mode. */
export function ensureSandboxPack(
  activePack: PackState | null,
  tick: number,
): { pack: PackState; enteredSandbox: boolean } {
  if (activePack !== null) return { pack: activePack, enteredSandbox: false };
  return { pack: { pack: createSandboxPack(tick), save: "" }, enteredSandbox: true };
}

/** Returns true when the dev/harness touch QA trigger pill should be visible. */
export function shouldShowQaTouchTrigger(flags: {
  blocked: boolean;
  hasActivePack: boolean;
  menuOpen: boolean;
  consoleOpen: boolean;
  titleOpen: boolean;
  photoMode: boolean;
}): boolean {
  return (
    !flags.blocked &&
    !flags.hasActivePack &&
    !flags.menuOpen &&
    !flags.consoleOpen &&
    !flags.titleOpen &&
    !flags.photoMode
  );
}

export function createQaTouchTrigger(root: HTMLElement): {
  render: (visible: boolean) => void;
  onOpen: (callback: () => void) => void;
} {
  let open: () => void = () => undefined;
  const trigger = el("button", "qa-touch-trigger");
  trigger.type = "button";
  trigger.hidden = true;
  trigger.textContent = "QA";
  trigger.setAttribute("aria-label", "Open QA console");
  trigger.addEventListener("click", () => open());
  root.append(trigger);
  return {
    onOpen: (callback) => { open = callback; },
    render: (visible) => {
      trigger.hidden = !visible;
    },
  };
}

export function createQaError(root: HTMLElement, message: string): void {
  const menu = el("main", "qa-menu");
  const card = el("div", "qa-card");
  const heading = el("h1", "qa-heading"); heading.textContent = "QA save error";
  const detail = el("p", "qa-error"); detail.textContent = message;
  card.append(heading, detail); menu.append(card); root.append(menu);
}

export type QaSettingToggleId =
  | "gentleTiming"
  | "keyHints"
  | "reducedMotion"
  | "muted"
  | "photoMode"
  | "navOverlay";

export const QA_SETTING_TOGGLES: readonly { id: QaSettingToggleId; label: string }[] = [
  { id: "gentleTiming", label: "Gentle Timing" },
  { id: "keyHints", label: "Key Hints" },
  { id: "reducedMotion", label: "Reduced Motion" },
  { id: "muted", label: "Mute Audio" },
  { id: "photoMode", label: "Photo Mode" },
  { id: "navOverlay", label: "Nav Heatmap" },
];

export function qaSettingPressed(
  settings: QaSettingsSnapshot,
  id: QaSettingToggleId,
): "true" | "false" {
  return settings[id] === true ? "true" : "false";
}

export type QaSettingsSnapshot = {
  gentleTiming: boolean;
  keyHints: boolean;
  reducedMotion: boolean;
  muted: boolean;
  textSpeed: TextSpeed;
  photoMode: boolean;
  canPhotoMode: boolean;
  navOverlay?: boolean;
};

export type QaConsoleSnapshot = {
  open: boolean;
  focusInput: boolean;
  activePack: QaPack | null;
  entries: readonly PackState[];
  state: State;
  context: ConsoleContext;
  partyNames: Readonly<Record<string, string>>;
  settings: QaSettingsSnapshot;
};

// The QA console (Milestone 67, spec 11): a tabbed GUI + command line over
// runConsoleCommand. The shell owns state, save slots, and settings; this DOM
// panel stays lazy until first open so unused controls never enter the page.
export type QaConsoleHandlers = {
  getSnapshot: () => QaConsoleSnapshot;
  run: (line: string) => ConsoleOutcome;
  saveSlot: (name: string) => Promise<string>;
  saveFile: () => string;
  loadPack: (pack: PackState) => void;
  resetGame: () => void;
  close: () => void;
  toggleGentleTiming: () => void;
  toggleKeyHints: () => void;
  toggleReducedMotion: () => void;
  toggleMute: () => void;
  setTextSpeed: (speed: TextSpeed) => void;
  togglePhotoMode: () => void;
  toggleNavOverlay?: () => void;
};

type QaTabId = "cheats" | "saves" | "settings";

const TOOL_BUTTONS: readonly { id: ToolName; label: string }[] = [
  { id: "lantern", label: "Lantern" },
  { id: "lasso", label: "Lasso" },
  { id: "flute", label: "Flute" },
  { id: "map", label: "Map" },
];

const TEXT_SPEED_OPTIONS: readonly { id: TextSpeed; label: string }[] = [
  { id: "cozy", label: "Cozy" },
  { id: "brisk", label: "Brisk" },
  { id: "instant", label: "Instant" },
];

const SUPPLY_SLIDERS: readonly { id: "coins" | "snacks" | "tickets"; label: string; max: number }[]
  = [
    { id: "coins", label: "Coins", max: 999 },
    { id: "snacks", label: "Snacks", max: 99 },
    { id: "tickets", label: "Tickets", max: 999 },
  ];

const ACTION_BUTTONS: readonly { id: string; label: string; command: string }[] = [
  { id: "stickers-all", label: "All Stickers", command: "stickers all" },
  { id: "prizes-all", label: "All Prizes", command: "prizes all" },
  { id: "treats-all", label: "+1 All Treats", command: "treats all" },
  { id: "garden-ripe", label: "Ripen Garden", command: "garden ripe" },
];

export function createQaConsole(root: HTMLElement, handlers: QaConsoleHandlers): {
  render: (snapshot: QaConsoleSnapshot) => void;
} {
  // Built on first open: the dev-only panel never sits in the page's DOM
  // while unused, so no game test can trip over its words (the kid's battle
  // asserts the word "Run" is nowhere on the page, and a hidden button would
  // count).
  let panel: HTMLElement | null = null;
  let input: HTMLInputElement | null = null;
  let syncView: (snapshot: QaConsoleSnapshot) => void = () => undefined;
  let wasOpen = false;

  const build = (): void => {
    let activeTab: QaTabId = "cheats";
    let draggingSlider: HTMLInputElement | null = null;
    let lastSnapshot = handlers.getSnapshot();
    let lastMembersKey = "";
    let lastPacksKey = "";

    const madePanel = el("main", "qa-console");
    madePanel.hidden = true;
    madePanel.setAttribute("aria-label", "QA console");
    const card = el("div", "qa-console-card");

    // Header: title, active mode badge, and tab strip.
    const header = el("header", "qa-console-header");
    const titleRow = el("div", "qa-console-title-row");
    const heading = el("h1", "qa-heading qa-console-heading");
    heading.textContent = "QA console";
    const modeBadge = el("span", "qa-console-mode");
    titleRow.append(heading, modeBadge);

    const tabsBar = el("div", "qa-console-tabs");
    tabsBar.setAttribute("role", "tablist");
    tabsBar.setAttribute("aria-label", "QA console sections");
    const tabSpecs: readonly { id: QaTabId; label: string }[] = [
      { id: "cheats", label: "Cheats" },
      { id: "saves", label: "Saves" },
      { id: "settings", label: "Settings" },
    ];
    const tabButtons = new Map<QaTabId, HTMLButtonElement>();
    const tabPanels = new Map<QaTabId, HTMLElement>();

    const selectTab = (tab: QaTabId): void => {
      activeTab = tab;
      for (const [id, button] of tabButtons) {
        button.setAttribute("aria-selected", String(id === tab));
      }
      for (const [id, section] of tabPanels) {
        section.hidden = id !== tab;
      }
    };

    for (const spec of tabSpecs) {
      const button = el("button", "qa-console-tab");
      button.type = "button";
      button.setAttribute("role", "tab");
      button.dataset.qaTab = spec.id;
      button.textContent = spec.label;
      button.addEventListener("click", () => selectTab(spec.id));
      tabButtons.set(spec.id, button);
      tabsBar.append(button);
    }
    header.append(titleRow, tabsBar);

    const body = el("div", "qa-console-body");

    // Bottom bar: log + command input + close (created before command helpers).
    const footer = el("div", "qa-console-footer");
    const madeLog = el("div", "qa-console-log");
    madeLog.setAttribute("aria-live", "polite");
    const bar = el("div", "qa-console-bar");
    const form = el("form", "qa-console-form");
    const madeInput = document.createElement("input");
    madeInput.type = "text";
    madeInput.className = "qa-console-input";
    madeInput.autocomplete = "off";
    madeInput.spellcheck = false;
    madeInput.placeholder = "Type a command; help lists them";
    const run = el("button", "qa-console-run");
    run.type = "submit";
    run.textContent = "Run";
    form.append(madeInput, run);
    const close = el("button", "qa-console-close");
    close.type = "button";
    close.textContent = "Close (Esc)";
    close.addEventListener("click", () => handlers.close());
    bar.append(form, close);
    footer.append(madeLog, bar);

    const scrollLog = (): void => { madeLog.scrollTop = madeLog.scrollHeight; };
    const appendLog = (text: string, className: string): void => {
      const line = el("p", className);
      line.textContent = text;
      madeLog.append(line);
      while (madeLog.children.length > 200) madeLog.firstElementChild?.remove();
      scrollLog();
    };

    const executeCommand = async (rawLine: string): Promise<ConsoleOutcome | null> => {
      const line = rawLine.trim();
      if (line === "") return null;
      appendLog(`> ${line}`, "qa-console-cmd");
      const outcome = handlers.run(line);
      if (outcome.kind === "applied") appendLog(outcome.message, "qa-console-ok");
      else if (outcome.kind === "help") appendLog(outcome.message, "qa-console-help");
      else if (outcome.kind === "error") appendLog(outcome.message, "qa-console-error");
      else if (outcome.kind === "save")
        appendLog(await handlers.saveSlot(outcome.name), "qa-console-ok");
      else if (outcome.kind === "reset") {
        madeLog.replaceChildren();
        handlers.resetGame();
        return outcome;
      } else {
        const block = el("pre", "qa-console-save");
        block.dataset.qaExport = "";
        block.textContent = handlers.saveFile();
        madeLog.append(block);
        while (madeLog.children.length > 200) madeLog.firstElementChild?.remove();
        scrollLog();
      }
      syncView(handlers.getSnapshot());
      return outcome;
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const line = madeInput.value.trim();
      if (line === "") return;
      madeInput.value = "";
      void executeCommand(line);
    });

    const attachDragTracking = (slider: HTMLInputElement): void => {
      slider.addEventListener("pointerdown", () => { draggingSlider = slider; });
      const release = (): void => {
        if (draggingSlider === slider) draggingSlider = null;
      };
      slider.addEventListener("pointerup", release);
      slider.addEventListener("pointercancel", release);
      slider.addEventListener("blur", release);
    };

    // Tab 1: Cheats
    const cheatsPanel = el("section", "qa-console-panel qa-cheats-panel");
    cheatsPanel.setAttribute("role", "tabpanel");
    cheatsPanel.dataset.qaPanel = "cheats";
    tabPanels.set("cheats", cheatsPanel);

    const suppliesSection = el("div", "qa-section");
    const suppliesTitle = el("h2", "qa-section-title");
    suppliesTitle.textContent = "Supplies";
    suppliesSection.append(suppliesTitle);
    const supplySliders = new Map<
      "coins" | "snacks" | "tickets",
      { slider: HTMLInputElement; value: HTMLSpanElement }
    >();
    for (const spec of SUPPLY_SLIDERS) {
      const row = el("label", "qa-slider-row");
      const name = el("span", "qa-slider-label");
      name.textContent = spec.label;
      const readout = el("span", "qa-slider-value");
      readout.textContent = "0";
      const slider = document.createElement("input");
      slider.type = "range";
      slider.className = "qa-slider";
      slider.min = "0";
      slider.max = String(spec.max);
      slider.step = "1";
      slider.dataset.qaSlider = spec.id;
      slider.setAttribute("aria-label", spec.label);
      attachDragTracking(slider);
      slider.addEventListener("input", () => {
        readout.textContent = slider.value;
      });
      slider.addEventListener("change", () => {
        if (draggingSlider === slider) draggingSlider = null;
        void executeCommand(`${spec.id} ${slider.value}`);
      });
      row.append(name, slider, readout);
      suppliesSection.append(row);
      supplySliders.set(spec.id, { slider, value: readout });
    }

    const levelSection = el("div", "qa-section");
    const levelTitle = el("h2", "qa-section-title");
    levelTitle.textContent = "Party Level";
    const levelRow = el("div", "qa-level-row");
    const memberSelect = document.createElement("select");
    memberSelect.className = "qa-select";
    memberSelect.dataset.qaMember = "";
    memberSelect.setAttribute("aria-label", "Party member");
    const levelSlider = document.createElement("input");
    levelSlider.type = "range";
    levelSlider.className = "qa-slider";
    levelSlider.min = "1";
    levelSlider.max = "99";
    levelSlider.step = "1";
    levelSlider.dataset.qaSlider = "level";
    levelSlider.setAttribute("aria-label", "Level");
    const levelReadout = el("span", "qa-slider-value qa-level-value");
    levelReadout.textContent = "Lv 1 (0 XP)";
    attachDragTracking(levelSlider);
    const formatLevelReadout = (level: number, xp: number): string => `Lv ${level} (${xp} XP)`;
    const syncSelectedMemberLevel = (snapshot: QaConsoleSnapshot): void => {
      const cheats = readQaCheatSnapshot(snapshot.context, snapshot.state, snapshot.partyNames);
      const picked =
        cheats.members.find((member) => member.id === memberSelect.value) ?? cheats.members[0];
      if (picked === undefined) return;
      if (draggingSlider !== levelSlider) {
        levelSlider.value = String(picked.level);
        levelReadout.textContent = formatLevelReadout(picked.level, picked.xp);
      }
    };
    memberSelect.addEventListener("change", () => {
      draggingSlider = null;
      syncSelectedMemberLevel(lastSnapshot);
    });
    levelSlider.addEventListener("input", () => {
      const level = Number(levelSlider.value);
      const xp = thresholdForLevel(lastSnapshot.context.thresholds, level);
      levelReadout.textContent = formatLevelReadout(level, xp);
    });
    levelSlider.addEventListener("change", () => {
      if (draggingSlider === levelSlider) draggingSlider = null;
      const who = memberSelect.value === "" ? "fae" : memberSelect.value;
      void executeCommand(`level ${who} ${levelSlider.value}`);
    });
    levelRow.append(memberSelect, levelSlider, levelReadout);
    levelSection.append(levelTitle, levelRow);

    const toolsSection = el("div", "qa-section");
    const toolsTitle = el("h2", "qa-section-title");
    toolsTitle.textContent = "Tools";
    const toolsGrid = el("div", "qa-chip-grid");
    const toolButtons = new Map<ToolName, HTMLButtonElement>();
    for (const spec of TOOL_BUTTONS) {
      const button = el("button", "qa-toggle");
      button.type = "button";
      button.dataset.qaTool = spec.id;
      button.setAttribute("aria-pressed", "false");
      button.textContent = spec.label;
      button.addEventListener("click", () => {
        const currentOn = button.getAttribute("aria-pressed") === "true";
        void executeCommand(`${spec.id} ${currentOn ? "off" : "on"}`);
      });
      toolButtons.set(spec.id, button);
      toolsGrid.append(button);
    }
    toolsSection.append(toolsTitle, toolsGrid);

    const storySection = el("div", "qa-section");
    const storyTitle = el("h2", "qa-section-title");
    storyTitle.textContent = "Collections & Story";
    const storyGrid = el("div", "qa-chip-grid");
    const keepsakesButton = el("button", "qa-toggle");
    keepsakesButton.type = "button";
    keepsakesButton.dataset.qaToggle = "keepsakes";
    keepsakesButton.setAttribute("aria-pressed", "false");
    keepsakesButton.textContent = "Keepsakes";
    keepsakesButton.addEventListener("click", () => {
      const on = keepsakesButton.getAttribute("aria-pressed") === "true";
      void executeCommand(`keepsakes ${on ? "off" : "on"}`);
    });
    const gemsButton = el("button", "qa-toggle");
    gemsButton.type = "button";
    gemsButton.dataset.qaToggle = "gems";
    gemsButton.setAttribute("aria-pressed", "false");
    gemsButton.textContent = "Star Gems";
    gemsButton.addEventListener("click", () => {
      const all = gemsButton.getAttribute("aria-pressed") === "true";
      void executeCommand(`gems ${all ? "clear" : "all"}`);
    });
    const fishButton = el("button", "qa-toggle");
    fishButton.type = "button";
    fishButton.dataset.qaToggle = "fish";
    fishButton.setAttribute("aria-pressed", "false");
    fishButton.textContent = "Fish";
    fishButton.addEventListener("click", () => {
      const all = fishButton.getAttribute("aria-pressed") === "true";
      void executeCommand(`fish ${all ? "clear" : "all"}`);
    });
    storyGrid.append(keepsakesButton, gemsButton, fishButton);
    for (const spec of ACTION_BUTTONS) {
      const button = el("button", "qa-action");
      button.type = "button";
      button.dataset.qaAction = spec.id;
      button.textContent = spec.label;
      button.addEventListener("click", () => {
        void executeCommand(spec.command);
      });
      storyGrid.append(button);
    }
    storySection.append(storyTitle, storyGrid);
    cheatsPanel.append(suppliesSection, levelSection, toolsSection, storySection);

    // Tab 2: Saves
    const savesPanel = el("section", "qa-console-panel qa-saves-panel");
    savesPanel.setAttribute("role", "tabpanel");
    savesPanel.dataset.qaPanel = "saves";
    tabPanels.set("saves", savesPanel);

    const slotBar = el("div", "qa-slot-bar");
    const slotInput = document.createElement("input");
    slotInput.type = "text";
    slotInput.className = "qa-slot-input";
    slotInput.dataset.qaSlotInput = "";
    slotInput.autocomplete = "off";
    slotInput.spellcheck = false;
    slotInput.placeholder = "slot-name";
    slotInput.setAttribute("aria-label", "QA slot name");
    const saveSlotButton = el("button", "qa-action qa-slot-save");
    saveSlotButton.type = "button";
    saveSlotButton.dataset.qaSlotSave = "";
    saveSlotButton.textContent = "Save Slot";
    const submitSlot = async (): Promise<void> => {
      const name = slotInput.value.trim();
      const outcome = await executeCommand(`save ${name}`);
      if (outcome?.kind === "save") slotInput.value = "";
    };
    saveSlotButton.addEventListener("click", () => { void submitSlot(); });
    slotInput.addEventListener("keydown", (event) => {
      if (event.code === "Enter") {
        event.preventDefault();
        void submitSlot();
      }
    });
    const exportButton = el("button", "qa-action qa-slot-export");
    exportButton.type = "button";
    exportButton.dataset.qaSlotExport = "";
    exportButton.textContent = "Export Save";
    exportButton.addEventListener("click", () => { void executeCommand("export"); });
    const resetButton = el("button", "qa-reset-btn");
    resetButton.type = "button";
    resetButton.dataset.qaReset = "";
    resetButton.textContent = "New Game (Clean Reset)";
    resetButton.addEventListener("click", () => {
      madeLog.replaceChildren();
      handlers.resetGame();
    });
    slotBar.append(slotInput, saveSlotButton, exportButton, resetButton);

    const packsList = el("div", "qa-console-packs");
    packsList.setAttribute("role", "list");
    packsList.setAttribute("aria-label", "QA saves");
    savesPanel.append(slotBar, packsList);

    // Tab 3: Settings
    const settingsPanel = el("section", "qa-console-panel qa-settings-panel");
    settingsPanel.setAttribute("role", "tabpanel");
    settingsPanel.dataset.qaPanel = "settings";
    tabPanels.set("settings", settingsPanel);

    const togglesGrid = el("div", "qa-chip-grid");
    const settingActions: Record<QaSettingToggleId, () => void> = {
      gentleTiming: handlers.toggleGentleTiming,
      keyHints: handlers.toggleKeyHints,
      reducedMotion: handlers.toggleReducedMotion,
      muted: handlers.toggleMute,
      photoMode: handlers.togglePhotoMode,
      navOverlay: () => { handlers.toggleNavOverlay?.(); },
    };
    const settingButtons = new Map<QaSettingToggleId, HTMLButtonElement>();
    for (const spec of QA_SETTING_TOGGLES) {
      const button = el("button", "qa-toggle");
      button.type = "button";
      button.dataset.qaSetting = spec.id;
      button.setAttribute("aria-pressed", "false");
      button.textContent = spec.label;
      button.addEventListener("click", () => {
        settingActions[spec.id]();
        syncView(handlers.getSnapshot());
      });
      settingButtons.set(spec.id, button);
      togglesGrid.append(button);
    }

    const speedRow = el("div", "qa-speed-row");
    const speedLabel = el("span", "qa-section-title");
    speedLabel.textContent = "Text Speed";
    const speedGroup = el("div", "qa-segmented");
    speedGroup.setAttribute("role", "group");
    speedGroup.setAttribute("aria-label", "Text speed");
    const speedButtons = new Map<TextSpeed, HTMLButtonElement>();
    for (const spec of TEXT_SPEED_OPTIONS) {
      const button = el("button", "qa-seg-btn");
      button.type = "button";
      button.dataset.qaTextSpeed = spec.id;
      button.setAttribute("aria-pressed", "false");
      button.textContent = spec.label;
      button.addEventListener("click", () => {
        handlers.setTextSpeed(spec.id);
        syncView(handlers.getSnapshot());
      });
      speedButtons.set(spec.id, button);
      speedGroup.append(button);
    }
    speedRow.append(speedLabel, speedGroup);
    settingsPanel.append(togglesGrid, speedRow);

    body.append(cheatsPanel, savesPanel, settingsPanel);
    card.append(header, body, footer);
    madePanel.append(card);
    root.append(madePanel);
    selectTab(activeTab);

    syncView = (snapshot) => {
      lastSnapshot = snapshot;
      modeBadge.textContent =
        snapshot.activePack === null
          ? "Live game (edits enter QA)"
          : snapshot.activePack.label;
      modeBadge.classList.toggle("is-qa", snapshot.activePack !== null);

      // Sync Cheats tab.
      const cheats = readQaCheatSnapshot(snapshot.context, snapshot.state, snapshot.partyNames);
      const supplyValues: Record<"coins" | "snacks" | "tickets", number> = {
        coins: cheats.coins,
        snacks: cheats.snacks,
        tickets: cheats.tickets,
      };
      for (const spec of SUPPLY_SLIDERS) {
        const pair = supplySliders.get(spec.id);
        if (pair === undefined) continue;
        if (draggingSlider !== pair.slider) {
          const amount = supplyValues[spec.id];
          pair.slider.value = String(amount);
          pair.value.textContent = String(amount);
        }
      }

      const membersKey = cheats.members.map((member) => `${member.id}:${member.name}`).join("|");
      if (membersKey !== lastMembersKey) {
        const prior = memberSelect.value;
        lastMembersKey = membersKey;
        memberSelect.replaceChildren();
        for (const member of cheats.members) {
          const option = document.createElement("option");
          option.value = member.id;
          option.textContent = member.name;
          memberSelect.append(option);
        }
        if (cheats.members.some((member) => member.id === prior)) memberSelect.value = prior;
        else memberSelect.value = "fae";
      }
      syncSelectedMemberLevel(snapshot);

      for (const spec of TOOL_BUTTONS) {
        toolButtons.get(spec.id)?.setAttribute("aria-pressed", String(cheats.tools[spec.id]));
      }
      keepsakesButton.setAttribute("aria-pressed", String(cheats.keepsakesOn));
      gemsButton.setAttribute("aria-pressed", String(cheats.gemsAll));
      fishButton.setAttribute("aria-pressed", String(cheats.fishAll));

      // Sync Saves tab list only when entries or active pack id changed.
      const activeId = snapshot.activePack?.id ?? "";
      const packsKey = `${activeId}::${snapshot.entries
        .map((item) => `${item.pack.id}:${item.pack.label}:${item.pack.tick}`)
        .join("|")}`;
      if (packsKey !== lastPacksKey) {
        lastPacksKey = packsKey;
        packsList.replaceChildren();
        for (const item of snapshot.entries) {
          const button = el("button", "qa-console-pack");
          button.type = "button";
          button.dataset.id = item.pack.id;
          if (item.pack.id === activeId) button.setAttribute("aria-current", "true");
          const label = el("strong", "qa-console-pack-label");
          label.textContent = item.pack.label;
          const note = el("small", "qa-console-pack-note");
          note.textContent = item.pack.note;
          button.append(label, note);
          button.addEventListener("click", () => handlers.loadPack(item));
          packsList.append(button);
        }
      }

      // Sync Settings tab.
      for (const spec of QA_SETTING_TOGGLES) {
        settingButtons
          .get(spec.id)
          ?.setAttribute("aria-pressed", qaSettingPressed(snapshot.settings, spec.id));
      }
      const photoToggle = settingButtons.get("photoMode");
      if (photoToggle !== undefined) {
        photoToggle.disabled = !snapshot.settings.photoMode && !snapshot.settings.canPhotoMode;
      }
      for (const spec of TEXT_SPEED_OPTIONS) {
        speedButtons
          .get(spec.id)
          ?.setAttribute("aria-pressed", String(snapshot.settings.textSpeed === spec.id));
      }
    };

    panel = madePanel;
    input = madeInput;
  };

  return {
    render: (snapshot) => {
      if (snapshot.open && panel === null) build();
      if (panel === null) return;
      panel.hidden = !snapshot.open;
      if (snapshot.open) syncView(snapshot);
      if (wasOpen !== snapshot.open) {
        wasOpen = snapshot.open;
        if (input === null) return;
        if (snapshot.open && snapshot.focusInput) input.focus();
        else if (!snapshot.open) input.blur();
      }
    },
  };
}
