import type { FeelingId } from "../core";

// Small icons drawn in code in the sticker style (warm-brown ink, soft
// fills), shared by the journal and the battle. Each is SVG markup for a
// 0 0 20 20 viewBox.

// A gold coin: Fae's coins.
export const coinMarkup =
  '<circle cx="10" cy="10" r="8.2" fill="#f2c94c" stroke="#47321f" stroke-width="1.4"/>' +
  '<circle cx="10" cy="10" r="4.6" fill="none" stroke="#c48a1c" stroke-width="1.3"/>';

// A chocolate-chip cookie: Fae's snacks, and a hungry critter's feeling.
export const cookieMarkup =
  '<circle cx="10" cy="10" r="8.2" fill="#dba468" stroke="#47321f" stroke-width="1.4"/>' +
  '<circle cx="7" cy="7.6" r="1.5" fill="#6b4226"/>' +
  '<circle cx="12.8" cy="7" r="1.3" fill="#6b4226"/>' +
  '<circle cx="11.4" cy="12.6" r="1.5" fill="#6b4226"/>' +
  '<circle cx="6.6" cy="12.8" r="1.1" fill="#6b4226"/>';

// What a chaos critter feels (spec 8.1): zoomy a lightning bolt, curious a
// question mark, bored a flat little face, grumpy a storm cloud, and hungry
// the snack it wants.
export const feelingMarkup: Record<FeelingId, string> = {
  zoomy: '<path d="M11.6 1.6 L4.4 11 L9.2 11 L7.6 18.4 L15.6 8.2 L10.6 8.2 Z" ' +
    'fill="#f6cf4f" stroke="#47321f" stroke-width="1.4" stroke-linejoin="round"/>',
  curious: '<circle cx="10" cy="10" r="8.4" fill="#addbd8" stroke="#47321f" stroke-width="1.4"/>' +
    '<path d="M7.2 7.6 C7.2 4.2 12.8 4.2 12.8 7.4 C12.8 9.6 10 9.8 10 12.2" fill="none" ' +
    'stroke="#47321f" stroke-width="1.8" stroke-linecap="round"/>' +
    '<circle cx="10" cy="15" r="1.2" fill="#47321f"/>',
  bored: '<circle cx="10" cy="10" r="8.4" fill="#f3ecda" stroke="#47321f" stroke-width="1.4"/>' +
    '<path d="M5.6 8.4 L8.4 8.4 M11.6 8.4 L14.4 8.4 M6.8 13.4 L13.2 13.4" fill="none" ' +
    'stroke="#47321f" stroke-width="1.6" stroke-linecap="round"/>',
  grumpy: '<path d="M4.6 13.6 C1.4 13.6 1.4 9 4.8 8.8 C5 5.2 10 4 11.8 6.8 C14.4 5.2 18 7.2 ' +
    '16.8 10.4 C19 11.4 18 13.6 16 13.6 Z" fill="#b6bfd6" stroke="#47321f" stroke-width="1.4" ' +
    'stroke-linejoin="round"/>' +
    '<path d="M10.8 13.6 L9 16.4 L11 16.4 L9.4 19" fill="none" stroke="#e0a43a" ' +
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  hungry: cookieMarkup,
};

// A heart, for a feeling answered.
export const heartMarkup =
  '<path d="M10 17.2 C3.6 12.6 1.8 9.6 2.6 6.6 C3.6 3.4 7.6 2.8 10 6 C12.4 2.8 16.4 3.4 17.4 6.6 ' +
  'C18.2 9.6 16.4 12.6 10 17.2 Z" fill="#ef8fa6" stroke="#47321f" stroke-width="1.4" ' +
  'stroke-linejoin="round"/>';

/** An icon as an SVG element (decoration: hidden from screen readers). */
export function icon(markup: string, className: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = markup;
  return svg;
}
