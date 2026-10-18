import "./credits.css";
import { applyAtlasCrop, type AtlasImage } from "./atlas";

export type CreditsEntryView = {
  section: "friends" | "met";
  name: string;
  image: AtlasImage | null;
};
export type CreditsView = { visible: boolean; entries: CreditsEntryView[] };

export function createCredits(root: HTMLElement): { render: (view: CreditsView) => void } {
  const screen = document.createElement("section");
  screen.className = "credits-screen";
  screen.setAttribute("aria-label", "Credits");
  const title = document.createElement("h1");
  title.className = "credits-title";
  title.textContent = "THE END";
  const friends = document.createElement("h2");
  friends.textContent = "FRIENDS";
  const friendsList = document.createElement("ul");
  friendsList.className = "credits-list";
  const met = document.createElement("h2");
  met.textContent = "MET ALONG THE WAY";
  const thanks = document.createElement("p");
  thanks.className = "credits-thanks";
  thanks.textContent = "Thank you for playing!";
  const metList = document.createElement("ul");
  metList.className = "credits-list";
  screen.append(title, friends, friendsList, met, metList, thanks);
  root.append(screen);
  // The list is rebuilt only when what it shows changes: the shell renders
  // every frame while the credits are up, and they hold still.
  let shown = "";
  return { render: (view) => {
    screen.hidden = !view.visible;
    if (!view.visible) return;
    const key = JSON.stringify(view.entries);
    if (key === shown) return;
    shown = key;
    friends.hidden = !view.entries.some((entry) => entry.section === "friends");
    met.hidden = !view.entries.some((entry) => entry.section === "met");
    const renderEntry = (entry: CreditsEntryView): HTMLLIElement => {
      const item = document.createElement("li");
      item.className = `credits-entry credits-entry-${entry.section}`;
      const image = document.createElement("div");
      image.className = "credits-entry-image";
      const atlas = entry.image;
      if (atlas !== null) applyAtlasCrop(image, atlas);
      const label = document.createElement("span");
      label.className = "credits-entry-name";
      label.textContent = entry.name;
      item.append(image, label);
      return item;
    };
    friendsList.replaceChildren(...view.entries.filter((entry) => entry.section === "friends")
      .map(renderEntry));
    metList.replaceChildren(...view.entries.filter((entry) => entry.section === "met")
      .map(renderEntry));
  } };
}
