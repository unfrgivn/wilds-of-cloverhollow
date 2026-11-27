#!/usr/bin/env bun
/*
 * Deterministic brand artwork builder for Wilds of Cloverhollow (Milestone 112):
 * renders hand-crafted storybook SVG art via headless Chromium, then flattens
 * and resizes with ImageMagick into strictly opaque RGB PNGs (zero alpha
 * channel per Apple App Store rules) plus a 1200x640 review sheet JPEG.
 *
 *   bun tools/art/build-brand-icons.ts
 */
import { chromium } from "@playwright/test";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SCRATCH = "art/scratch/m112-brand-icons";
const APP_ICON_OUT =
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";
const SPLASH_FILES = [
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png",
] as const;
const PWA_ICON_512 = "public/icons/icon-512.png";
const APPLE_TOUCH_180 = "public/icons/apple-touch-icon.png";
const REVIEW_SHEET = "art/review/m112-brand-icons.jpg";

function im(...args: string[]): string {
  const result = Bun.spawnSync(["magick", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(`magick ${args.join(" ")}\n${result.stderr.toString()}`);
  }
  return result.stdout.toString().trim();
}

function sparklePath(cx: number, cy: number, r: number): string {
  const inner = r * 0.27;
  return [
    `M ${cx} ${cy - r}`,
    `Q ${cx + inner * 0.52} ${cy - inner * 0.52} ${cx + r} ${cy}`,
    `Q ${cx + inner * 0.52} ${cy + inner * 0.52} ${cx} ${cy + r}`,
    `Q ${cx - inner * 0.52} ${cy + inner * 0.52} ${cx - r} ${cy}`,
    `Q ${cx - inner * 0.52} ${cy - inner * 0.52} ${cx} ${cy - r} Z`,
  ].join(" ");
}

// Four subtly distinct hand-drawn heart leaves (organic asymmetry, no stamped
// mirror clone) radiating from (0, 0).
const LEAF_SHAPES: readonly {
  angle: number;
  sx: number;
  sy: number;
  grad: string;
}[] = [
  { angle: -3, sx: 1.02, sy: 1.03, grad: "url(#leafSunGrad)" },
  { angle: 88, sx: 0.99, sy: 1.01, grad: "url(#leafMidGrad)" },
  { angle: 183, sx: 0.98, sy: 0.97, grad: "url(#leafDeepGrad)" },
  { angle: 272, sx: 1.01, sy: 0.99, grad: "url(#leafMidGrad)" },
];

const HEART_LEAF = [
  "M 0 0",
  "C -28 -30 -122 -84 -130 -166",
  "C -136 -234 -78 -268 -28 -244",
  "C -12 -236 -4 -220 0 -202",
  "C 4 -220 12 -236 28 -244",
  "C 78 -268 136 -234 130 -166",
  "C 122 -84 28 -30 0 0 Z",
].join(" ");

// Soft watercolor wash lobe (upper-left sunlit side) — painterly, not glossy.
const WATERCOLOR_LIGHT = [
  "M -8 -24",
  "C -52 -66 -108 -114 -112 -168",
  "C -116 -214 -76 -242 -36 -228",
  "C -16 -220 -8 -202 -4 -184",
  "C -4 -126 -4 -66 -8 -24 Z",
].join(" ");

// Soft watercolor shadow wash on lower-right lobe.
const WATERCOLOR_SHADE = [
  "M 6 -18",
  "C 46 -56 106 -108 112 -166",
  "C 116 -208 88 -236 52 -234",
  "C 84 -210 92 -170 76 -122",
  "C 62 -80 32 -44 6 -18 Z",
].join(" ");

function cloverEmblemSvg(
  cx: number,
  cy: number,
  scale: number,
  tiltDeg: number,
  stemEndY: number,
): string {
  const stemPath = `M 2 14 C 14 104 46 186 98 ${stemEndY}`;
  const leaves = LEAF_SHAPES.map((leaf) => [
    `<g transform="rotate(${leaf.angle}) scale(${leaf.sx} ${leaf.sy})">`,
    `  <path d="${HEART_LEAF}" fill="${leaf.grad}" stroke="#47321f"`,
    `    stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>`,
    `  <path d="${WATERCOLOR_LIGHT}" fill="#e6f5cf" opacity="0.38"/>`,
    `  <path d="${WATERCOLOR_SHADE}" fill="#487c38" opacity="0.22"/>`,
    `  <path d="M 0 -16 Q -4 -96 0 -180" fill="none" stroke="#47321f"`,
    `    stroke-width="7" stroke-linecap="round" opacity="0.46"/>`,
    `  <path d="M -2 -98 Q -28 -124 -52 -140" fill="none" stroke="#47321f"`,
    `    stroke-width="5" stroke-linecap="round" opacity="0.30"/>`,
    `  <path d="M 2 -114 Q 26 -138 48 -150" fill="none" stroke="#47321f"`,
    `    stroke-width="5" stroke-linecap="round" opacity="0.30"/>`,
    `</g>`,
  ].join("\n")).join("\n");

  return [
    `<g transform="translate(${cx} ${cy}) rotate(${tiltDeg}) scale(${scale})">`,
    // Gracefully curved hand-inked stem tucked behind the leaves
    `  <path d="${stemPath}" fill="none" stroke="#47321f"`,
    `    stroke-width="38" stroke-linecap="round"/>`,
    `  <path d="${stemPath}" fill="none" stroke="#6aa457"`,
    `    stroke-width="18" stroke-linecap="round"/>`,
    `  <path d="M -2 18 C 8 102 40 180 88 ${stemEndY - 8}" fill="none"`,
    `    stroke="#b7df9b" stroke-width="5.5" stroke-linecap="round" opacity="0.62"/>`,
    leaves,
    // Natural folded-stem heart junction (soft watercolor, not a pinwheel button)
    `  <circle cx="0" cy="0" r="16" fill="#77b060" stroke="#47321f" stroke-width="9"/>`,
    `  <path d="M -6 -4 Q 0 -10 6 -4" fill="none" stroke="#e8f6d3"`,
    `    stroke-width="4" stroke-linecap="round" opacity="0.8"/>`,
    `</g>`,
  ].join("\n");
}

function wildflower(
  cx: number,
  cy: number,
  petalRadius: number,
  petalColor: string,
  centerColor: string,
  strokeWidth: number,
): string {
  const petals = [0, 72, 144, 216, 288].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const px = (cx + Math.cos(rad) * petalRadius * 1.1).toFixed(1);
    const py = (cy + Math.sin(rad) * petalRadius * 1.1).toFixed(1);
    return `<circle cx="${px}" cy="${py}" r="${petalRadius}" fill="${petalColor}" ` +
      `stroke="#47321f" stroke-width="${strokeWidth}"/>`;
  }).join("\n");
  return [
    `<g>`,
    petals,
    `  <circle cx="${cx}" cy="${cy}" r="${(petalRadius * 0.8).toFixed(1)}" ` +
      `fill="${centerColor}" stroke="#47321f" stroke-width="${strokeWidth}"/>`,
    `</g>`,
  ].join("\n");
}

function appIconSvg(): string {
  // Three sparkles positioned in open sky with zero hill or leaf tangents.
  const sparkles = [
    { x: 204, y: 196, r: 52, sw: 8.5 },
    { x: 842, y: 198, r: 44, sw: 7.5 },
    { x: 132, y: 626, r: 34, sw: 6.5 },
  ].map((sp) => [
    `<path d="${sparklePath(sp.x, sp.y, sp.r)}" fill="url(#sparkleGrad)"`,
    `  stroke="#47321f" stroke-width="${sp.sw}" stroke-linejoin="round"/>`,
    `<circle cx="${(sp.x - sp.r * 0.1).toFixed(1)}" cy="${(sp.y - sp.r * 0.12).toFixed(1)}"`,
    `  r="${(sp.r * 0.15).toFixed(1)}" fill="#ffffff" opacity="0.82"/>`,
  ].join("\n")).join("\n");

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; width: 1024px; height: 1024px; overflow: hidden; }
</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff4cf"/>
      <stop offset="52%" stop-color="#faeac3"/>
      <stop offset="100%" stop-color="#f3ddb0"/>
    </linearGradient>
    <radialGradient id="sunGlow" cx="24%" cy="18%" r="58%">
      <stop offset="0%" stop-color="#fffef5" stop-opacity="0.96"/>
      <stop offset="34%" stop-color="#ffe7a3" stop-opacity="0.68"/>
      <stop offset="72%" stop-color="#f8d892" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#f3ddb0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cloverHalo" cx="50%" cy="44%" r="36%">
      <stop offset="0%" stop-color="#fffef6" stop-opacity="0.88"/>
      <stop offset="58%" stop-color="#fff8e0" stop-opacity="0.48"/>
      <stop offset="100%" stop-color="#fff8e0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="backHillGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#cde5b3"/>
      <stop offset="60%" stop-color="#b9dc9e"/>
      <stop offset="100%" stop-color="#9fc884"/>
    </linearGradient>
    <linearGradient id="frontHillGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a8d38d"/>
      <stop offset="55%" stop-color="#8ec074"/>
      <stop offset="100%" stop-color="#76aa5d"/>
    </linearGradient>
    <linearGradient id="leafSunGrad" x1="-0.4" y1="-1" x2="0.4" y2="0.3">
      <stop offset="0%" stop-color="#b4df97"/>
      <stop offset="48%" stop-color="#85be6c"/>
      <stop offset="100%" stop-color="#5d994c"/>
    </linearGradient>
    <linearGradient id="leafMidGrad" x1="-0.3" y1="-1" x2="0.4" y2="0.3">
      <stop offset="0%" stop-color="#a5d48a"/>
      <stop offset="50%" stop-color="#78b360"/>
      <stop offset="100%" stop-color="#538d43"/>
    </linearGradient>
    <linearGradient id="leafDeepGrad" x1="-0.3" y1="-1" x2="0.4" y2="0.3">
      <stop offset="0%" stop-color="#96c97c"/>
      <stop offset="50%" stop-color="#6ca756"/>
      <stop offset="100%" stop-color="#4b833c"/>
    </linearGradient>
    <radialGradient id="sparkleGrad" cx="38%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fff9cf"/>
      <stop offset="55%" stop-color="#ffdc6b"/>
      <stop offset="100%" stop-color="#eab13c"/>
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="16" flood-color="#4d361d" flood-opacity="0.24"/>
    </filter>
    <filter id="paperGrain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="3" seed="11"
        result="noise"/>
      <feColorMatrix type="matrix"
        values="0 0 0 0 0.45  0 0 0 0 0.34  0 0 0 0 0.20  0 0 0 0.055 0"/>
    </filter>
    <filter id="cloudWash" x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>

  <!-- Warm sunlit golden-cream sky -->
  <rect width="1024" height="1024" fill="url(#skyGrad)"/>
  <rect width="1024" height="1024" fill="url(#sunGlow)"/>

  <!-- Painterly sunlit morning cloud washes -->
  <g filter="url(#cloudWash)" opacity="0.72">
    <ellipse cx="218" cy="170" rx="220" ry="120" fill="#fffdf3"/>
    <ellipse cx="830" cy="316" rx="190" ry="74" fill="#fffaf0"/>
    <ellipse cx="174" cy="542" rx="170" ry="64" fill="#fff9e8"/>
  </g>

  <!-- Back rolling Cloverhollow meadow hill (lowered for clean silhouette) -->
  <path d="M -20 778 Q 220 688 504 748 T 1044 720 L 1044 1044 L -20 1044 Z"
    fill="url(#backHillGrad)"/>
  <path d="M -20 778 Q 220 688 504 748 T 1044 720"
    fill="none" stroke="#47321f" stroke-width="9.5" stroke-linecap="round" opacity="0.68"/>

  <!-- Front rolling Cloverhollow meadow hill -->
  <path d="M -20 868 Q 312 792 634 854 T 1044 812 L 1044 1044 L -20 1044 Z"
    fill="url(#frontHillGrad)"/>
  <path d="M -20 868 Q 312 792 634 854 T 1044 812"
    fill="none" stroke="#47321f" stroke-width="11" stroke-linecap="round" opacity="0.78"/>
  <path d="M 8 880 Q 312 806 634 868 T 1030 826"
    fill="none" stroke="#d9efc3" stroke-width="9" stroke-linecap="round" opacity="0.46"/>

  <!-- Two clean, well-spaced storybook wildflowers nestled well inside the foreground meadow -->
  ${wildflower(214, 906, 16, "#fffbf0", "#f5c84c", 5.2)}
  ${wildflower(780, 934, 16, "#ffe4de", "#f5c84c", 5.2)}

  <!-- Warm sunlit halo separating the clover from sky & meadow -->
  <rect width="1024" height="1024" fill="url(#cloverHalo)"/>

  <!-- Soft grounding shadow where the clover stem meets the sunlit meadow -->
  <ellipse cx="634" cy="798" rx="46" ry="12" fill="#4f7c3c" opacity="0.28"/>

  <!-- Centerpiece hand-inked four-leaf clover hero emblem -->
  <g filter="url(#softShadow)">
    ${cloverEmblemSvg(498, 456, 1.24, -6, 266)}
  </g>

  <!-- Delicate golden storybook sparkles in open sky -->
  ${sparkles}

  <!-- Subtle watercolor paper tooth over the full composition -->
  <rect width="1024" height="1024" filter="url(#paperGrain)" opacity="0.8"/>
</svg>
</body>
</html>`;
}

function splashSvg(): string {
  const cx = 1366;
  const cy = 1366;
  // Sparkles orbiting cleanly inside the medallion with generous ring margin.
  const sparkles = [
    { x: cx - 196, y: cy - 184, r: 34, sw: 6.2 },
    { x: cx + 198, y: cy - 172, r: 28, sw: 5.5 },
    { x: cx + 188, y: cy + 174, r: 24, sw: 5 },
  ].map((sp) => [
    `<path d="${sparklePath(sp.x, sp.y, sp.r)}" fill="url(#sparkleGrad)"`,
    `  stroke="#47321f" stroke-width="${sp.sw}" stroke-linejoin="round"/>`,
  ].join("\n")).join("\n");

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; width: 2732px; height: 2732px; overflow: hidden; }
</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <radialGradient id="paperHalo" cx="50%" cy="50%" r="28%">
      <stop offset="0%" stop-color="#fffbf0" stop-opacity="0.90"/>
      <stop offset="60%" stop-color="#fbf2da" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#f8edcf" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="medallionGrad" cx="42%" cy="34%" r="68%">
      <stop offset="0%" stop-color="#fffef9"/>
      <stop offset="70%" stop-color="#fcf4e2"/>
      <stop offset="100%" stop-color="#f3e4c3"/>
    </radialGradient>
    <linearGradient id="leafSunGrad" x1="-0.4" y1="-1" x2="0.4" y2="0.3">
      <stop offset="0%" stop-color="#b4df97"/>
      <stop offset="48%" stop-color="#85be6c"/>
      <stop offset="100%" stop-color="#5d994c"/>
    </linearGradient>
    <linearGradient id="leafMidGrad" x1="-0.3" y1="-1" x2="0.4" y2="0.3">
      <stop offset="0%" stop-color="#a5d48a"/>
      <stop offset="50%" stop-color="#78b360"/>
      <stop offset="100%" stop-color="#538d43"/>
    </linearGradient>
    <linearGradient id="leafDeepGrad" x1="-0.3" y1="-1" x2="0.4" y2="0.3">
      <stop offset="0%" stop-color="#96c97c"/>
      <stop offset="50%" stop-color="#6ca756"/>
      <stop offset="100%" stop-color="#4b833c"/>
    </linearGradient>
    <radialGradient id="sparkleGrad" cx="38%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fff9cf"/>
      <stop offset="55%" stop-color="#ffdc6b"/>
      <stop offset="100%" stop-color="#eab13c"/>
    </radialGradient>
    <filter id="medallionShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#5a4326" flood-opacity="0.14"/>
    </filter>
    <filter id="cloverShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#4d361d" flood-opacity="0.18"/>
    </filter>
  </defs>

  <!-- Seamless warm cream paper matching capacitor.config.ts (#f8edcf) -->
  <rect width="2732" height="2732" fill="#f8edcf"/>
  <rect width="2732" height="2732" fill="url(#paperHalo)"/>

  <!-- Centered warm ivory storybook medallion with generous breathing room -->
  <g filter="url(#medallionShadow)">
    <circle cx="${cx}" cy="${cy}" r="362" fill="url(#medallionGrad)"
      stroke="#47321f" stroke-width="11"/>
  </g>
  <!-- Crisp stitched storybook ring outside & delicate dotted ring inside -->
  <circle cx="${cx}" cy="${cy}" r="434" fill="none"
    stroke="#856544" stroke-width="7" stroke-dasharray="18 18" stroke-linecap="round"
    opacity="0.78"/>
  <circle cx="${cx}" cy="${cy}" r="330" fill="none"
    stroke="#b79a72" stroke-width="4.5" stroke-dasharray="6 14" stroke-linecap="round"
    opacity="0.68"/>

  <!-- Centered four-leaf clover with airy margins inside the medallion -->
  <g filter="url(#cloverShadow)">
    ${cloverEmblemSvg(cx - 4, cy - 16, 0.76, -6, 248)}
  </g>

  <!-- Balanced storybook wildflower sprigs resting on the medallion border -->
  <g transform="translate(${cx - 260} ${cy + 252}) rotate(-10)">
    <path d="M -26 30 Q 14 12 62 -4" fill="none" stroke="#47321f"
      stroke-width="9" stroke-linecap="round"/>
    <ellipse cx="52" cy="18" rx="28" ry="14" transform="rotate(-24 52 18)"
      fill="#96c97c" stroke="#47321f" stroke-width="6.5"/>
    <ellipse cx="-2" cy="-14" rx="24" ry="13" transform="rotate(30 -2 -14)"
      fill="#a8d58f" stroke="#47321f" stroke-width="6.5"/>
    ${wildflower(20, 4, 18, "#fffbf0", "#f5c84c", 6)}
  </g>
  <g transform="translate(${cx + 260} ${cy - 252}) rotate(14)">
    <path d="M -46 14 Q -8 6 34 -12" fill="none" stroke="#47321f"
      stroke-width="9" stroke-linecap="round"/>
    <ellipse cx="-38" cy="14" rx="26" ry="13" transform="rotate(-22 -38 14)"
      fill="#96c97c" stroke="#47321f" stroke-width="6.5"/>
    <ellipse cx="16" cy="-14" rx="22" ry="12" transform="rotate(26 16 -14)"
      fill="#a8d58f" stroke="#47321f" stroke-width="6.5"/>
    ${wildflower(-4, 2, 17, "#ffe4de", "#f5c84c", 6)}
  </g>

  <!-- Golden storybook sparkles -->
  ${sparkles}
</svg>
</body>
</html>`;
}

function reviewSheetSvg(iconDataUri: string, splashDataUri: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><style>
  html, body {
    margin: 0;
    padding: 0;
    width: 1200px;
    height: 640px;
    overflow: hidden;
    background: #f5eedb;
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
    color: #47321f;
  }
</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640">
  <defs>
    <clipPath id="iosSquircle">
      <rect x="434" y="132" width="220" height="220" rx="49" ry="49"/>
    </clipPath>
    <clipPath id="iosSmall60">
      <rect x="462" y="420" width="60" height="60" rx="13.5" ry="13.5"/>
    </clipPath>
    <clipPath id="iosTiny29">
      <rect x="574" y="436" width="29" height="29" rx="6.5" ry="6.5"/>
    </clipPath>
    <clipPath id="splashCard">
      <rect x="752" y="116" width="400" height="400" rx="20" ry="20"/>
    </clipPath>
    <linearGradient id="wallpaperGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3c5678"/>
      <stop offset="55%" stop-color="#5c7696"/>
      <stop offset="100%" stop-color="#8b9ab2"/>
    </linearGradient>
    <filter id="cardShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#47321f" flood-opacity="0.16"/>
    </filter>
    <filter id="iconShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#1d2838" flood-opacity="0.34"/>
    </filter>
  </defs>

  <rect width="1200" height="640" fill="#f5eedb"/>
  <rect x="18" y="18" width="1164" height="604" rx="22" fill="#fbf6e9"
    stroke="#d8c7a3" stroke-width="2"/>

  <!-- Header -->
  <text x="48" y="64" font-size="24" font-weight="700" fill="#47321f">
    Wilds of Cloverhollow — Brand Icon &amp; Launch Splash Review (M112)
  </text>
  <text x="48" y="90" font-size="14" fill="#7a5e42">
    Opaque 1024x1024 RGB AppIcon · iOS Squircle / 60px / 29px Spotlight · 2732x2732 Launch Splash
  </text>

  <!-- Panel 1: Raw 1024x1024 App Icon -->
  <g filter="url(#cardShadow)">
    <image href="${iconDataUri}" x="48" y="116" width="320" height="320"/>
  </g>
  <rect x="48" y="116" width="320" height="320" fill="none" stroke="#c8b48e" stroke-width="2"/>
  <text x="208" y="466" text-anchor="middle" font-size="15" font-weight="700" fill="#47321f">
    AppIcon-512@2x.png (1024x1024)
  </text>
  <text x="208" y="488" text-anchor="middle" font-size="13" fill="#7a5e42">
    Opaque RGB PNG · Zero alpha channel
  </text>

  <!-- Panel 2: iOS Home Screen & Spotlight preview -->
  <rect x="396" y="116" width="296" height="400" rx="24" fill="url(#wallpaperGrad)"
    filter="url(#cardShadow)"/>
  <g filter="url(#iconShadow)">
    <image href="${iconDataUri}" x="434" y="132" width="220" height="220"
      clip-path="url(#iosSquircle)"/>
  </g>
  <text x="544" y="382" text-anchor="middle" font-size="18" font-weight="600" fill="#ffffff">
    Cloverhollow
  </text>
  <g filter="url(#iconShadow)">
    <image href="${iconDataUri}" x="462" y="420" width="60" height="60"
      clip-path="url(#iosSmall60)"/>
  </g>
  <text x="492" y="500" text-anchor="middle" font-size="12" fill="#e8eef7">60px</text>
  <g filter="url(#iconShadow)">
    <image href="${iconDataUri}" x="574" y="436" width="29" height="29"
      clip-path="url(#iosTiny29)"/>
  </g>
  <text x="588" y="500" text-anchor="middle" font-size="12" fill="#e8eef7">29px</text>
  <text x="544" y="544" text-anchor="middle" font-size="15" font-weight="700" fill="#47321f">
    iOS Home Screen &amp; Spotlight
  </text>
  <text x="544" y="566" text-anchor="middle" font-size="13" fill="#7a5e42">
    Apple squircle mask &amp; small-size check
  </text>

  <!-- Panel 3: Launch Splash 2732x2732 with iPhone landscape crop frame -->
  <g filter="url(#cardShadow)">
    <image href="${splashDataUri}" x="752" y="116" width="400" height="400"
      clip-path="url(#splashCard)"/>
  </g>
  <rect x="752" y="116" width="400" height="400" rx="20" fill="none"
    stroke="#c8b48e" stroke-width="2"/>
  <rect x="754" y="224" width="396" height="184" fill="none"
    stroke="#7a5e42" stroke-width="1.5" stroke-dasharray="7 6" opacity="0.72"/>
  <text x="764" y="242" font-size="11" fill="#7a5e42" opacity="0.9">
    iPhone landscape viewport
  </text>
  <text x="952" y="544" text-anchor="middle" font-size="15" font-weight="700" fill="#47321f">
    Launch Splash (2732x2732)
  </text>
  <text x="952" y="566" text-anchor="middle" font-size="13" fill="#7a5e42">
    Seamless #f8edcf paper · centered medallion
  </text>
</svg>
</body>
</html>`;
}

async function renderHtmlToPng(
  html: string,
  width: number,
  height: number,
  outPath: string,
): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: outPath, type: "png" });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  mkdirSync(SCRATCH, { recursive: true });
  mkdirSync("public/icons", { recursive: true });
  mkdirSync("art/review", { recursive: true });

  const rawIcon = join(SCRATCH, "app-icon-raw.png");
  const rawSplash = join(SCRATCH, "splash-raw.png");
  const rawReview = join(SCRATCH, "review-raw.png");

  await renderHtmlToPng(appIconSvg(), 1024, 1024, rawIcon);
  await renderHtmlToPng(splashSvg(), 2732, 2732, rawSplash);

  // Flatten strictly to opaque 24-bit RGB PNG (zero alpha channel).
  im(
    rawIcon,
    "-background", "#f8edcf",
    "-alpha", "remove",
    "-alpha", "off",
    "-type", "TrueColor",
    "-define", "png:color-type=2",
    `PNG24:${APP_ICON_OUT}`,
  );
  im(
    APP_ICON_OUT,
    "-filter", "Lanczos",
    "-resize", "512x512!",
    "-alpha", "off",
    "-type", "TrueColor",
    "-define", "png:color-type=2",
    `PNG24:${PWA_ICON_512}`,
  );
  im(
    APP_ICON_OUT,
    "-filter", "Lanczos",
    "-resize", "180x180!",
    "-alpha", "off",
    "-type", "TrueColor",
    "-define", "png:color-type=2",
    `PNG24:${APPLE_TOUCH_180}`,
  );

  const primarySplash = SPLASH_FILES[0];
  im(
    rawSplash,
    "-background", "#f8edcf",
    "-alpha", "remove",
    "-alpha", "off",
    "-type", "TrueColor",
    "-define", "png:color-type=2",
    `PNG24:${primarySplash}`,
  );
  for (const target of SPLASH_FILES.slice(1)) {
    copyFileSync(primarySplash, target);
  }

  // Build crisp 1200x640 JPEG review sheet using the real flattened outputs.
  const iconSmall = join(SCRATCH, "icon-preview.png");
  const splashSmall = join(SCRATCH, "splash-preview.png");
  im(APP_ICON_OUT, "-filter", "Lanczos", "-resize", "512x512!", iconSmall);
  im(primarySplash, "-filter", "Lanczos", "-resize", "680x680!", splashSmall);

  const iconUri = `data:image/png;base64,${Buffer.from(
    await Bun.file(iconSmall).arrayBuffer(),
  ).toString("base64")}`;
  const splashUri = `data:image/png;base64,${Buffer.from(
    await Bun.file(splashSmall).arrayBuffer(),
  ).toString("base64")}`;

  await renderHtmlToPng(reviewSheetSvg(iconUri, splashUri), 1200, 640, rawReview);
  im(rawReview, "-quality", "90", REVIEW_SHEET);

  const iconInfo = im(APP_ICON_OUT, "-format", "%w %h %[channels] %[type]", "info:");
  const splashInfo = im(primarySplash, "-format", "%w %h %[channels] %[type]", "info:");
  const pwaInfo = im(PWA_ICON_512, "-format", "%w %h %[channels]", "info:");
  const touchInfo = im(APPLE_TOUCH_180, "-format", "%w %h %[channels]", "info:");
  const reviewInfo = im(REVIEW_SHEET, "-format", "%w %h", "info:");

  writeFileSync(
    join(SCRATCH, "summary.json"),
    `${JSON.stringify({ iconInfo, splashInfo, pwaInfo, touchInfo, reviewInfo }, null, 2)}\n`,
  );
  rmSync(rawIcon, { force: true });
  rmSync(rawSplash, { force: true });
  rmSync(rawReview, { force: true });

  console.log(`brand icons built:
  AppIcon: ${iconInfo}
  Splash:  ${splashInfo}
  PWA 512: ${pwaInfo}
  Touch:   ${touchInfo}
  Review:  ${reviewInfo}`);
}

await main();
