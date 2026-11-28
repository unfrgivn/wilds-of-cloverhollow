import "./credits.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";
import { svgElement } from "./dom";

export type CreditsEntryView = {
  section: "friends" | "met";
  name: string;
  image: AtlasImage | null;
};

export type CreditsPostcardView = {
  src: string;
  alt: string;
  caption: string;
};

export const DEFAULT_ENDING_POSTCARD: CreditsPostcardView = {
  src: "assets/ending/morning-postcard.webp",
  alt:
    "Fae, Maddie, Milo, Sue, and Jordan walking together along " +
    "Cloverhollow's sunlit lane beneath drifting petals.",
  caption: "Morning walk to school · Cloverhollow",
};

export type CreditsView = {
  visible: boolean;
  entries: CreditsEntryView[];
  summary?: readonly string[];
  postcard?: CreditsPostcardView | null;
};

function cloverStampSvg(): SVGSVGElement {
  const svg = svgElement("svg", "credits-postcard-stamp-svg");
  svg.setAttribute("viewBox", "0 0 36 40");
  svg.setAttribute("aria-hidden", "true");
  const field = svgElement("rect", "credits-stamp-field", svg);
  field.setAttribute("x", "3");
  field.setAttribute("y", "3");
  field.setAttribute("width", "30");
  field.setAttribute("height", "34");
  field.setAttribute("rx", "3");
  const stem = svgElement("path", "credits-stamp-stem", svg);
  stem.setAttribute("d", "M18 20 C19 26 22 30 26 33");
  const leaves: readonly (readonly [number, number])[] = [
    [18, 12],
    [25, 19],
    [18, 26],
    [11, 19],
  ];
  for (const [cx, cy] of leaves) {
    const leaf = svgElement("circle", "credits-stamp-leaf", svg);
    leaf.setAttribute("cx", String(cx));
    leaf.setAttribute("cy", String(cy));
    leaf.setAttribute("r", "5.5");
  }
  const center = svgElement("circle", "credits-stamp-dot", svg);
  center.setAttribute("cx", "18");
  center.setAttribute("cy", "19");
  center.setAttribute("r", "2.1");
  return svg;
}

export function createCredits(root: HTMLElement): {
  render: (view: CreditsView) => void;
  onClose: (callback: () => void) => void;
} {
  let closeHandler: () => void = () => undefined;
  const screen = document.createElement("section");
  screen.className = "credits-screen";
  screen.setAttribute("aria-label", "Credits");
  screen.addEventListener("click", () => {
    if (!screen.hidden) closeHandler();
  });

  const hero = document.createElement("div");
  hero.className = "credits-hero";
  const title = document.createElement("h1");
  title.className = "credits-title";
  title.textContent = "THE END";

  const postcardFigure = document.createElement("figure");
  postcardFigure.className = "credits-postcard";
  const postcardFrame = document.createElement("div");
  postcardFrame.className = "credits-postcard-frame";
  const postcardImg = document.createElement("img");
  postcardImg.className = "credits-postcard-img";
  postcardImg.decoding = "sync";
  postcardImg.draggable = false;
  const postcardStamp = document.createElement("span");
  postcardStamp.className = "credits-postcard-stamp";
  postcardStamp.setAttribute("aria-hidden", "true");
  postcardStamp.append(cloverStampSvg());
  postcardFrame.append(postcardImg, postcardStamp);
  const postcardCaption = document.createElement("figcaption");
  postcardCaption.className = "credits-postcard-caption";
  postcardFigure.append(postcardFrame, postcardCaption);
  hero.append(title, postcardFigure);

  const cast = document.createElement("div");
  cast.className = "credits-cast";
  const friends = document.createElement("h2");
  friends.textContent = "FRIENDS";
  const friendsList = document.createElement("ul");
  friendsList.className = "credits-list";
  const met = document.createElement("h2");
  met.textContent = "MET ALONG THE WAY";
  const metList = document.createElement("ul");
  metList.className = "credits-list";
  cast.append(friends, friendsList, met, metList);

  const footer = document.createElement("div");
  footer.className = "credits-footer";
  const summaryList = document.createElement("ul");
  summaryList.className = "credits-summary";
  summaryList.setAttribute("aria-label", "Journey summary");
  summaryList.hidden = true;
  const thanks = document.createElement("p");
  thanks.className = "credits-thanks";
  thanks.textContent = "Thank you for playing!";
  footer.append(summaryList, thanks);

  screen.append(hero, cast, footer);
  root.append(screen);
  // The list is rebuilt only when what it shows changes: the shell renders
  // every frame while the credits are up, and they hold still.
  let shown = "";
  // The stickers' atlases and ending postcard, decoded and held while up.
  let atlases: HTMLImageElement[] = [];
  return {
    onClose: (callback) => {
      closeHandler = callback;
    },
    render: (view) => {
      screen.hidden = !view.visible;
      if (!view.visible) {
        shown = "";
        atlases = [];
        return;
      }
      const summary = view.summary ?? [];
      const postcard = view.postcard === undefined ? DEFAULT_ENDING_POSTCARD : view.postcard;
      const key = JSON.stringify({ entries: view.entries, summary, postcard });
      if (key === shown) return;
      shown = key;

      if (postcard === null) {
        postcardFigure.hidden = true;
        postcardImg.removeAttribute("src");
        postcardImg.alt = "";
        postcardCaption.textContent = "";
      } else {
        postcardFigure.hidden = false;
        postcardImg.src = postcard.src;
        postcardImg.alt = postcard.alt;
        postcardCaption.textContent = postcard.caption;
      }

      friends.hidden = !view.entries.some((entry) => entry.section === "friends");
      met.hidden = !view.entries.some((entry) => entry.section === "met");
      summaryList.hidden = summary.length === 0;
      summaryList.replaceChildren(
        ...summary.map((text) => {
          const item = document.createElement("li");
          item.className = text.startsWith("★ ")
            ? "credits-summary-pill is-master"
            : "credits-summary-pill";
          item.textContent = text;
          return item;
        }),
      );
      const renderEntry = (entry: CreditsEntryView): HTMLLIElement => {
        const item = document.createElement("li");
        item.className = `credits-entry credits-entry-${entry.section}`;
        const image = document.createElement("div");
        image.className = "credits-entry-image die-cut";
        const atlas = entry.image;
        if (atlas !== null) applyAtlasCrop(image, atlas);
        const label = document.createElement("span");
        label.className = "credits-entry-name";
        label.textContent = entry.name;
        item.append(image, label);
        return item;
      };
      friendsList.replaceChildren(
        ...view.entries.filter((entry) => entry.section === "friends").map(renderEntry),
      );
      metList.replaceChildren(
        ...view.entries.filter((entry) => entry.section === "met").map(renderEntry),
      );
      // The stickers and ending postcard show once their images are decoded.
      // A new layer's first paint in WebKit decodes a large image at draw size
      // unless a whole decode is ready, which pops in when it finishes.
      const sources = new Set(
        view.entries.flatMap((entry) => (entry.image === null ? [] : [entry.image.src])),
      );
      if (postcard !== null) sources.add(postcard.src);
      const decoding = [...sources].map((src) => {
        const image = new Image();
        image.src = src;
        return image;
      });
      atlases = decoding;
      screen.dataset.stickers = "decoding";
      const pending = decoding.map((image) => image.decode());
      if (postcard !== null) pending.push(postcardImg.decode());
      void Promise.allSettled(pending).then(() => {
        if (atlases === decoding) screen.dataset.stickers = "ready";
      });
    },
  };
}
