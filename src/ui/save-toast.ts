import "./save-toast.css";
import { element, svgElement } from "./dom";

export const SAVE_TOAST_DURATION_MS = 1800;

export type SaveToast = {
  show: () => void;
  hide: () => void;
  visible: () => boolean;
};

function makeQuillIcon(): SVGSVGElement {
  const svg = svgElement("svg", "save-toast-icon");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("aria-hidden", "true");
  const vane = svgElement("path", "save-toast-quill-vane", svg);
  vane.setAttribute(
    "d",
    "M 14.8 2.6 C 10.6 2.8 7.0 5.3 5.2 9.4 L 6.6 10.8 C 10.7 9.6 14.2 6.8 14.8 2.6 Z",
  );
  const shaft = svgElement("path", "save-toast-quill-shaft", svg);
  shaft.setAttribute("d", "M 3.2 14.8 Q 7.6 10.4 13.4 4.2");
  const flourish = svgElement("path", "save-toast-quill-shaft", svg);
  flourish.setAttribute("d", "M 2.6 15.4 Q 5.2 14.6 7.8 15.2");
  return svg;
}

export function createSaveToast(root: HTMLElement): SaveToast {
  const toast = element("div", "sticker-ui save-toast", root);
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.hidden = true;

  const icon = makeQuillIcon();
  const label = element("span", "save-toast-label");
  label.textContent = "Saved";
  toast.append(icon, label);

  let timer: number | null = null;

  const clearTimer = (): void => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const hide = (): void => {
    clearTimer();
    toast.hidden = true;
  };

  const show = (): void => {
    clearTimer();
    toast.hidden = false;
    timer = window.setTimeout(() => {
      timer = null;
      toast.hidden = true;
    }, SAVE_TOAST_DURATION_MS);
  };

  return {
    show,
    hide,
    visible: () => !toast.hidden,
  };
}
