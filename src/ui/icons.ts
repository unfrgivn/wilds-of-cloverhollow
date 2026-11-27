import type { FeelingId, KeepsakeId } from "../core";

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

// An orange arcade ticket with notched ends: Fae's tickets (spec 9.1).
export const ticketMarkup =
  '<path d="M2 5.2 L18 5.2 L18 8.2 A1.8 1.8 0 0 0 18 11.8 L18 14.8 L2 14.8 L2 11.8 ' +
  'A1.8 1.8 0 0 0 2 8.2 Z" fill="#f4a259" stroke="#47321f" stroke-width="1.4" ' +
  'stroke-linejoin="round"/>' +
  '<path d="M7 7.4 L7 12.6" stroke="#47321f" stroke-width="1" stroke-dasharray="1.2 1.2"/>' +
  '<path d="M11.6 7.6 L12.4 9.3 L14.2 9.5 L12.9 10.7 L13.2 12.5 L11.6 11.6 L10 12.5 ' +
  'L10.3 10.7 L9 9.5 L10.8 9.3 Z" fill="#fff3c4" stroke="#47321f" stroke-width=".8" ' +
  'stroke-linejoin="round"/>';

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

// A faceted amethyst Star Gem (collectibles_candy_gems.png): pastel lavender
// facets, warm-brown ink outline, and a crisp white star glint.
export const gemMarkup =
  '<polygon points="6.2,3.4 13.8,3.4 17.6,8.2 10,17.4 2.4,8.2" fill="#c8a8f0"/>' +
  '<polygon points="6.2,3.4 13.8,3.4 12.6,8.2 7.4,8.2" fill="#efe2ff"/>' +
  '<polygon points="2.4,8.2 6.2,3.4 7.4,8.2" fill="#dfc4fa"/>' +
  '<polygon points="13.8,3.4 17.6,8.2 12.6,8.2" fill="#b490e6"/>' +
  '<polygon points="2.4,8.2 7.4,8.2 10,17.4" fill="#b996e9"/>' +
  '<polygon points="12.6,8.2 17.6,8.2 10,17.4" fill="#9c7ad8"/>' +
  '<path d="M2.8 8.2 H17.2 M7.4 8.2 L10 17 M12.6 8.2 L10 17" ' +
  'stroke="#7f5db8" stroke-width="0.7" fill="none"/>' +
  '<polygon points="6.2,3.4 13.8,3.4 17.6,8.2 10,17.4 2.4,8.2" fill="none" ' +
  'stroke="#5B3530" stroke-width="1.4" stroke-linejoin="round"/>' +
  '<path d="M6.2 4.6 L6.8 5.9 L8.1 6.5 L6.8 7.1 L6.2 8.4 L5.6 7.1 L4.3 6.5 L5.6 5.9 Z" ' +
  'fill="#ffffff"/>';

export const gemIconSvg = `<svg viewBox="0 0 20 20" aria-hidden="true">${gemMarkup}</svg>`;

/** An icon as an SVG element (decoration: hidden from screen readers). */
export function icon(markup: string, className: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = markup;
  return svg;
}

// Hand-crafted 48x48 storybook keepsake charms (warm #47321f ink outlines,
// zero text nodes) matching Fae's Clubhouse keepsakes.
const keepsakeMarkup: Record<KeepsakeId, string> = {
  "star-crystal":
    '<polygon points="14,40 10,25 16,17 22,26 20,40" fill="#89dfd0" stroke="#47321f" ' +
    'stroke-width="2.2" stroke-linejoin="round"/>' +
    '<polygon points="27,40 28,25 34,19 38,28 33,40" fill="#9cd9ec" stroke="#47321f" ' +
    'stroke-width="2.2" stroke-linejoin="round"/>' +
    '<polygon points="18,41 16,22 24,7 32,22 30,41" fill="#67d5c4" stroke="#47321f" ' +
    'stroke-width="2.3" stroke-linejoin="round"/>' +
    '<polygon points="24,10 28.5,22 24,36 21.5,22" fill="#e8fff9" opacity="0.72"/>' +
    '<path d="M24 16 L25.8 21 L30.5 22.8 L25.8 24.5 L24 29.5 L22.2 24.5 L17.5 22.8 ' +
    'L22.2 21 Z" fill="#fff4b8" stroke="#47321f" stroke-width="1" stroke-linejoin="round"/>',
  "star-pin":
    '<polygon points="18,31 13,43 19.5,39.5 23.5,43 23.5,32" fill="#e87594" ' +
    'stroke="#47321f" stroke-width="2.1" stroke-linejoin="round"/>' +
    '<polygon points="30,31 35,43 28.5,39.5 24.5,43 24.5,32" fill="#e87594" ' +
    'stroke="#47321f" stroke-width="2.1" stroke-linejoin="round"/>' +
    '<circle cx="24" cy="21.5" r="14.5" fill="#fcefc8" stroke="#47321f" stroke-width="2.4"/>' +
    '<circle cx="24" cy="21.5" r="11.5" fill="none" stroke="#e4b448" stroke-width="1.6"/>' +
    '<polygon points="24,11.5 26.8,17.7 33.5,18.4 28.4,22.9 29.9,29.6 24,26.1 ' +
    '18.1,29.6 19.6,22.9 14.5,18.4 21.2,17.7" fill="#f8c846" stroke="#47321f" ' +
    'stroke-width="1.9" stroke-linejoin="round"/>' +
    '<ellipse cx="17.5" cy="14.5" rx="3" ry="1.6" transform="rotate(-30 17.5 14.5)" ' +
    'fill="#ffffff" opacity="0.8"/>',
  "star-geode":
    '<path d="M24 9 C36 9 41 18 39 29 C37 38 31 41 24 41 C16 41 10 36 9 27 ' +
    'C8 17 14 9 24 9 Z" fill="#c7b299" stroke="#47321f" stroke-width="2.4" ' +
    'stroke-linejoin="round"/>' +
    '<ellipse cx="24" cy="25.5" rx="11.5" ry="12.2" fill="#faf2e0" stroke="#7d6654" ' +
    'stroke-width="1.6"/>' +
    '<ellipse cx="24" cy="25.5" rx="8.6" ry="9.2" fill="#d8b8ff" stroke="#5b4374" ' +
    'stroke-width="1.5"/>' +
    '<polygon points="17,26 24,18 31,26 24,33" fill="#9cf2eb" opacity="0.72"/>' +
    '<polygon points="21,29 27,22 30,29 24,34" fill="#ffe48f" opacity="0.78"/>' +
    '<polygon points="21,19.8 23,22 21,24.2 19,22" fill="#ffffff"/>' +
    '<polygon points="26.5,22 29,24.5 26.5,27 24,24.5" fill="#ffffff"/>' +
    '<polygon points="23,27 24.8,29 23,31 21.2,29" fill="#ffffff"/>',
  "moon-feather":
    '<path d="M14 39 C13 27 18 14 33 8 C37 17 34 29 24 36 C21 38 17 39 14 39 Z" ' +
    'fill="#c4dcff" stroke="#47321f" stroke-width="2.3" stroke-linejoin="round"/>' +
    '<path d="M17 35 C17 26 21 16 32 10 C34 16 32 24 25 31 Z" fill="#f0f7ff" ' +
    'opacity="0.7"/>' +
    '<path d="M12 42 Q21 27 32 11" fill="none" stroke="#47321f" stroke-width="2.2" ' +
    'stroke-linecap="round"/>' +
    '<circle cx="28.4" cy="16" r="3.4" fill="#ffe694"/>' +
    '<circle cx="29.8" cy="15.1" r="2.5" fill="#c4dcff"/>' +
    '<path d="M22 26 L17 23 M25 22 L31 22" stroke="#47321f" stroke-width="1.4" ' +
    'stroke-linecap="round" opacity="0.5"/>',
  "taco-badge":
    '<path d="M11 28 C10 18 17 14 21 18 C23 13 30 13 31 18 C35 15 39 20 37 28 Z" ' +
    'fill="#7fd19c" stroke="#47321f" stroke-width="2.1" stroke-linejoin="round"/>' +
    '<circle cx="18" cy="21" r="2.8" fill="#e87594" stroke="#47321f" stroke-width="1.4"/>' +
    '<circle cx="25" cy="19" r="2.8" fill="#e87594" stroke="#47321f" stroke-width="1.4"/>' +
    '<circle cx="31" cy="22" r="2.8" fill="#e87594" stroke="#47321f" stroke-width="1.4"/>' +
    '<path d="M8 33 C8 19 40 19 40 33 Q24 38 8 33 Z" fill="#f6c95e" stroke="#47321f" ' +
    'stroke-width="2.4" stroke-linejoin="round"/>' +
    '<path d="M12 31 C13 24 35 24 36 31" fill="none" stroke="#fff0a8" stroke-width="2" ' +
    'stroke-linecap="round" opacity="0.75"/>' +
    '<circle cx="17" cy="29" r="1.3" fill="#8a5624" opacity="0.5"/>' +
    '<circle cx="23" cy="32" r="1.3" fill="#8a5624" opacity="0.5"/>' +
    '<circle cx="29" cy="28" r="1.3" fill="#8a5624" opacity="0.5"/>' +
    '<circle cx="33" cy="31" r="1.3" fill="#8a5624" opacity="0.5"/>',
  "clover-wreath":
    '<circle cx="24" cy="23" r="13.5" fill="none" stroke="#47321f" stroke-width="10"/>' +
    '<circle cx="24" cy="23" r="13.5" fill="none" stroke="#7ec682" stroke-width="6.2"/>' +
    '<circle cx="24" cy="23" r="13.5" fill="none" stroke="#b6e7b3" stroke-width="2.6" ' +
    'stroke-dasharray="5 5" stroke-linecap="round"/>' +
    '<circle cx="24" cy="9.5" r="3.6" fill="#ffe37d" stroke="#47321f" stroke-width="1.5"/>' +
    '<circle cx="24" cy="9.5" r="1.3" fill="#fff7cc"/>' +
    '<circle cx="36" cy="17" r="3.4" fill="#f49cb4" stroke="#47321f" stroke-width="1.5"/>' +
    '<circle cx="36" cy="17" r="1.2" fill="#fff7cc"/>' +
    '<circle cx="35.5" cy="30" r="3.4" fill="#d4b6fa" stroke="#47321f" stroke-width="1.5"/>' +
    '<circle cx="35.5" cy="30" r="1.2" fill="#fff7cc"/>' +
    '<circle cx="12.5" cy="30" r="3.4" fill="#ffe37d" stroke="#47321f" stroke-width="1.5"/>' +
    '<circle cx="12.5" cy="30" r="1.2" fill="#fff7cc"/>' +
    '<circle cx="12" cy="17" r="3.4" fill="#d4b6fa" stroke="#47321f" stroke-width="1.5"/>' +
    '<circle cx="12" cy="17" r="1.2" fill="#fff7cc"/>' +
    '<path d="M24 35.5 L17.5 43 L22 41 L24 37 L26 41 L30.5 43 Z" fill="#e8849f" ' +
    'stroke="#47321f" stroke-width="1.7" stroke-linejoin="round"/>' +
    '<ellipse cx="20.2" cy="36" rx="3.4" ry="2.2" transform="rotate(-18 20.2 36)" ' +
    'fill="#e8849f" stroke="#47321f" stroke-width="1.6"/>' +
    '<ellipse cx="27.8" cy="36" rx="3.4" ry="2.2" transform="rotate(18 27.8 36)" ' +
    'fill="#e8849f" stroke="#47321f" stroke-width="1.6"/>' +
    '<circle cx="24" cy="36" r="2" fill="#fff3c4" stroke="#47321f" stroke-width="1.4"/>',
};

/** Hand-crafted inline SVG icon for each of Fae's six quest keepsakes. */
export function keepsakeIcon(id: KeepsakeId): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "journal-keepsake-icon die-cut");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = keepsakeMarkup[id];
  return svg;
}
