import "./hud-hints.css";

export type HudHintsView = {
  visible: boolean;
  canInteract: boolean;
  interactLabel: string;
  hasLantern: boolean;
  lanternOn: boolean;
  hasFlute: boolean;
  muted: boolean;
};

type HintPill = {
  root: HTMLSpanElement;
  label: HTMLSpanElement;
};

function makeHintPill(id: string, keyText: string, labelText: string): HintPill {
  const root = document.createElement("span");
  root.className = "hud-hint";
  root.setAttribute("data-hint", id);
  const key = document.createElement("kbd");
  key.className = "hud-hint-key";
  key.textContent = keyText;
  const label = document.createElement("span");
  label.className = "hud-hint-label";
  label.textContent = labelText;
  root.append(key, label);
  return { root, label };
}

function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function createHudHints(root: HTMLElement): {
  render: (view: HudHintsView) => void;
} {
  const ribbon = document.createElement("aside");
  ribbon.className = "hud-hints";
  ribbon.setAttribute("aria-label", "Keyboard controls");
  ribbon.hidden = true;

  const journalPill = makeHintPill("journal", "J", "Journal");
  const interactPill = makeHintPill("interact", "Z", "Talk");
  const lanternPill = makeHintPill("lantern", "L", "Lantern");
  lanternPill.root.hidden = true;
  const flutePill = makeHintPill("flute", "F", "Flute");
  flutePill.root.hidden = true;
  const mutePill = makeHintPill("mute", "M", "Mute");

  ribbon.append(
    journalPill.root,
    interactPill.root,
    lanternPill.root,
    flutePill.root,
    mutePill.root,
  );
  root.append(ribbon);

  let lastSignature = "";

  return {
    render: (view) => {
      const signature =
        `${view.visible}|${view.canInteract}|${view.interactLabel}|` +
        `${view.hasLantern}|${view.lanternOn}|${view.hasFlute}|${view.muted}`;
      if (signature === lastSignature) return;
      lastSignature = signature;

      ribbon.hidden = !view.visible;
      if (!view.visible) return;

      interactPill.root.classList.toggle("is-active", view.canInteract);
      setText(interactPill.label, view.canInteract ? view.interactLabel : "Talk");

      lanternPill.root.hidden = !view.hasLantern;
      lanternPill.root.classList.toggle("is-on", view.hasLantern && view.lanternOn);

      flutePill.root.hidden = !view.hasFlute;

      mutePill.root.classList.toggle("is-muted", view.muted);
      setText(mutePill.label, view.muted ? "Muted" : "Mute");
    },
  };
}
