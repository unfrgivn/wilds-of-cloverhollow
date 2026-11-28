// Pure, XSS-safe storybook kinetic rich-text tokenizer and incremental DOM
// renderer (Elevation Track E3). Never uses innerHTML; creates only text nodes
// and <span> elements from a closed set of inline tags.

export type RichTextColor = "berry" | "teal" | "gold" | "lavender";
export type RichTextEffect = "shake" | "wave" | "pop" | "whisper";

export type RichTextStyle = {
  shake: boolean;
  wave: boolean;
  pop: boolean;
  whisper: boolean;
  color: RichTextColor | null;
};

export type RichTextSpan = {
  text: string;
  style: RichTextStyle;
  /** Cumulative pause beats occurring directly before this span. */
  pauseBefore: number;
  plainStart: number;
  plainEnd: number;
};

export type RichTextPause = {
  plainIndex: number;
  beats: number;
};

export type ParsedRichText = {
  raw: string;
  plain: string;
  hasMarkup: boolean;
  spans: readonly RichTextSpan[];
  totalBeats: number;
  pauses: readonly RichTextPause[];
};

export type RichTextProgress = {
  visibleChars: number;
  inPause: boolean;
  complete: boolean;
};

export const MAX_PAUSE_BEATS = 60;

const DEFAULT_STYLE: RichTextStyle = {
  shake: false,
  wave: false,
  pop: false,
  whisper: false,
  color: null,
};

export function isRichTextColor(value: string): value is RichTextColor {
  return value === "berry" || value === "teal" || value === "gold" || value === "lavender";
}

function isRichTextEffect(value: string): value is RichTextEffect {
  return value === "shake" || value === "wave" || value === "pop" || value === "whisper";
}

function styleEquals(a: RichTextStyle, b: RichTextStyle): boolean {
  return (
    a.shake === b.shake &&
    a.wave === b.wave &&
    a.pop === b.pop &&
    a.whisper === b.whisper &&
    a.color === b.color
  );
}

type TagToken =
  | { kind: "open-effect"; effect: RichTextEffect }
  | { kind: "close-effect"; effect: RichTextEffect }
  | { kind: "open-color"; color: RichTextColor }
  | { kind: "close-color" }
  | { kind: "pause"; beats: number };

function parseTagToken(body: string): TagToken | null {
  const trimmed = body.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  if (isRichTextEffect(trimmed)) {
    return { kind: "open-effect", effect: trimmed };
  }
  if (trimmed.startsWith("/")) {
    const closing = trimmed.slice(1).trim();
    if (isRichTextEffect(closing)) {
      return { kind: "close-effect", effect: closing };
    }
    if (closing === "color") {
      return { kind: "close-color" };
    }
    return null;
  }
  if (trimmed.startsWith("color:")) {
    const color = trimmed.slice("color:".length).trim();
    if (isRichTextColor(color)) {
      return { kind: "open-color", color };
    }
    return null;
  }
  if (trimmed.startsWith("pause:")) {
    const countText = trimmed.slice("pause:".length).trim();
    if (!/^\d+$/.test(countText)) return null;
    const parsed = Number.parseInt(countText, 10);
    if (!Number.isFinite(parsed)) return null;
    return { kind: "pause", beats: Math.min(MAX_PAUSE_BEATS, Math.max(0, parsed)) };
  }
  return null;
}

/**
 * Parses inline storybook markup (`{shake}`, `{wave}`, `{pop}`, `{whisper}`,
 * `{color:berry|teal|gold|lavender}`, `{pause:N}`) into flat non-overlapping
 * spans and pause beats. Unrecognized `{...}` tokens remain literal text.
 */
export function parseRichText(raw: string): ParsedRichText {
  if (!raw.includes("{")) {
    return {
      raw,
      plain: raw,
      hasMarkup: false,
      spans:
        raw.length === 0
          ? []
          : [
              {
                text: raw,
                style: DEFAULT_STYLE,
                pauseBefore: 0,
                plainStart: 0,
                plainEnd: raw.length,
              },
            ],
      totalBeats: raw.length,
      pauses: [],
    };
  }

  const effectDepth: Record<RichTextEffect, number> = {
    shake: 0,
    wave: 0,
    pop: 0,
    whisper: 0,
  };
  const colorStack: RichTextColor[] = [];
  const spans: RichTextSpan[] = [];
  const pauses: RichTextPause[] = [];
  let plain = "";
  let hasMarkup = false;
  let pendingPause = 0;
  let totalPauseBeats = 0;
  let buffer = "";

  const currentStyle = (): RichTextStyle => ({
    shake: effectDepth.shake > 0,
    wave: effectDepth.wave > 0,
    pop: effectDepth.pop > 0,
    whisper: effectDepth.whisper > 0,
    color: colorStack[colorStack.length - 1] ?? null,
  });

  const flush = (): void => {
    if (buffer.length === 0) return;
    const style = currentStyle();
    const start = plain.length;
    plain += buffer;
    const end = plain.length;
    const last = spans[spans.length - 1];
    if (last !== undefined && pendingPause === 0 && styleEquals(last.style, style)) {
      spans[spans.length - 1] = {
        ...last,
        text: last.text + buffer,
        plainEnd: end,
      };
    } else {
      spans.push({
        text: buffer,
        style,
        pauseBefore: pendingPause,
        plainStart: start,
        plainEnd: end,
      });
    }
    pendingPause = 0;
    buffer = "";
  };

  let index = 0;
  while (index < raw.length) {
    const ch = raw[index];
    if (ch === "{") {
      const closeIdx = raw.indexOf("}", index + 1);
      if (closeIdx > index + 1) {
        const inner = raw.slice(index + 1, closeIdx);
        const token = inner.includes("{") ? null : parseTagToken(inner);
        if (token !== null) {
          flush();
          hasMarkup = true;
          if (token.kind === "open-effect") {
            effectDepth[token.effect] += 1;
          } else if (token.kind === "close-effect") {
            effectDepth[token.effect] = Math.max(0, effectDepth[token.effect] - 1);
          } else if (token.kind === "open-color") {
            colorStack.push(token.color);
          } else if (token.kind === "close-color") {
            if (colorStack.length > 0) colorStack.pop();
          } else if (token.kind === "pause" && token.beats > 0) {
            const plainIndex = plain.length;
            const prevPause = pauses[pauses.length - 1];
            if (prevPause !== undefined && prevPause.plainIndex === plainIndex) {
              pauses[pauses.length - 1] = {
                plainIndex,
                beats: Math.min(MAX_PAUSE_BEATS, prevPause.beats + token.beats),
              };
            } else {
              pauses.push({ plainIndex, beats: token.beats });
            }
            pendingPause += token.beats;
            totalPauseBeats += token.beats;
          }
          index = closeIdx + 1;
          continue;
        }
      }
    }
    buffer += ch ?? "";
    index += 1;
  }
  flush();

  return {
    raw,
    plain,
    hasMarkup,
    spans,
    totalBeats: plain.length + totalPauseBeats,
    pauses,
  };
}

/** Strips all recognized storybook markup tags, returning plain readable text. */
export function stripRichText(raw: string): string {
  return parseRichText(raw).plain;
}

/**
 * Projects core's numeric `revealed` cursor (`0..raw.length`) onto visible
 * plain-text character count while honoring `{pause:N}` dramatic beat holds.
 * Confirming (`revealed >= raw.length`) always reveals the full line at once.
 */
export function resolveRichTextProgress(
  parsed: ParsedRichText,
  revealed: number,
): RichTextProgress {
  if (parsed.plain.length === 0) {
    return { visibleChars: 0, inPause: false, complete: true };
  }
  if (!Number.isFinite(revealed) || revealed <= 0) {
    return { visibleChars: 0, inPause: false, complete: false };
  }
  if (revealed >= parsed.raw.length) {
    return { visibleChars: parsed.plain.length, inPause: false, complete: true };
  }
  if (parsed.pauses.length === 0) {
    const visibleChars = Math.min(parsed.plain.length, Math.floor(revealed));
    return {
      visibleChars,
      inPause: false,
      complete: visibleChars >= parsed.plain.length,
    };
  }

  const scale = parsed.totalBeats > parsed.raw.length ? parsed.totalBeats / parsed.raw.length : 1;
  const beatCursor = revealed * scale;
  let elapsed = 0;
  let pauseCursor = 0;
  let plainIndex = 0;

  while (plainIndex <= parsed.plain.length) {
    const nextPause = parsed.pauses[pauseCursor];
    if (nextPause !== undefined && nextPause.plainIndex === plainIndex) {
      if (beatCursor < elapsed + nextPause.beats) {
        return { visibleChars: plainIndex, inPause: true, complete: false };
      }
      elapsed += nextPause.beats;
      pauseCursor += 1;
      continue;
    }
    if (plainIndex >= parsed.plain.length) {
      return { visibleChars: parsed.plain.length, inPause: false, complete: true };
    }
    if (beatCursor < elapsed + 1) {
      return { visibleChars: plainIndex, inPause: false, complete: false };
    }
    elapsed += 1;
    plainIndex += 1;
  }

  return { visibleChars: parsed.plain.length, inPause: false, complete: true };
}

function isPerCharAnimated(style: RichTextStyle): boolean {
  return style.shake || style.wave || style.pop;
}

function styleClasses(style: RichTextStyle, animated: boolean): string[] {
  const classes: string[] = [];
  if (style.whisper) classes.push("rt-whisper");
  if (style.color !== null) classes.push(`rt-color-${style.color}`);
  if (style.pop) classes.push(animated ? "rt-pop" : "rt-pop-static");
  if (style.shake) classes.push(animated ? "rt-shake" : "rt-shake-static");
  if (style.wave && animated) classes.push("rt-wave");
  return classes;
}

function buildGhostDom(container: HTMLElement, parsed: ParsedRichText): void {
  container.replaceChildren();
  for (const span of parsed.spans) {
    const classes = styleClasses(span.style, false);
    if (classes.length === 0) {
      container.append(document.createTextNode(span.text));
    } else {
      const el = document.createElement("span");
      el.className = `rt-run ${classes.join(" ")}`;
      el.textContent = span.text;
      container.append(el);
    }
  }
}

export type RichTextRenderer = {
  render: (parsed: ParsedRichText, visibleChars: number) => void;
  reset: () => void;
};

/**
 * Incremental XSS-safe DOM renderer for `.sticker-text-full` and
 * `.sticker-text-revealed`. Identical renders touch zero DOM nodes; newly
 * revealed kinetic characters append cleanly without restarting earlier
 * characters' animations or splitting words mid-line.
 */
export function createRichTextRenderer(
  fullEl: HTMLElement,
  revealedEl: HTMLElement,
): RichTextRenderer {
  let lastRaw = "";
  let lastHasMarkup = false;
  let lastVisible = -1;
  let activeWordEl: HTMLSpanElement | null = null;
  let activeRunEl: HTMLSpanElement | null = null;
  let activeRunKey = "";

  const clearIncremental = (): void => {
    revealedEl.replaceChildren();
    activeWordEl = null;
    activeRunEl = null;
    activeRunKey = "";
    lastVisible = 0;
  };

  const appendChar = (char: string, style: RichTextStyle, plainIndex: number): void => {
    const isSpace = /\s/.test(char);
    if (isSpace) {
      activeWordEl = null;
      const classes = styleClasses(style, false);
      if (classes.length > 0) {
        const runKey = `r|${classes.join(" ")}`;
        if (activeRunEl === null || activeRunKey !== runKey) {
          activeRunEl = document.createElement("span");
          activeRunEl.className = `rt-run ${classes.join(" ")}`;
          revealedEl.append(activeRunEl);
          activeRunKey = runKey;
        }
        activeRunEl.append(document.createTextNode(char));
      } else {
        activeRunEl = null;
        activeRunKey = "";
        revealedEl.append(document.createTextNode(char));
      }
      return;
    }

    if (isPerCharAnimated(style)) {
      activeRunEl = null;
      activeRunKey = "";
      if (activeWordEl === null) {
        activeWordEl = document.createElement("span");
        activeWordEl.className = "rt-word";
        revealedEl.append(activeWordEl);
      }
      const glyph = document.createElement("span");
      glyph.className = `rt-char ${styleClasses(style, true).join(" ")}`;
      glyph.style.setProperty("--rt-i", String(plainIndex));
      glyph.textContent = char;
      activeWordEl.append(glyph);
      return;
    }

    activeWordEl = null;
    const classes = styleClasses(style, false);
    if (classes.length === 0) {
      activeRunEl = null;
      activeRunKey = "";
      revealedEl.append(document.createTextNode(char));
      return;
    }
    const runKey = `r|${classes.join(" ")}`;
    if (activeRunEl === null || activeRunKey !== runKey) {
      activeRunEl = document.createElement("span");
      activeRunEl.className = `rt-run ${classes.join(" ")}`;
      revealedEl.append(activeRunEl);
      activeRunKey = runKey;
    }
    activeRunEl.append(document.createTextNode(char));
  };

  const appendRange = (parsed: ParsedRichText, from: number, to: number): void => {
    if (to <= from) return;
    for (const span of parsed.spans) {
      if (span.plainEnd <= from) continue;
      if (span.plainStart >= to) break;
      const sliceStart = Math.max(span.plainStart, from);
      const sliceEnd = Math.min(span.plainEnd, to);
      for (let i = sliceStart; i < sliceEnd; i += 1) {
        const ch = span.text[i - span.plainStart];
        if (ch !== undefined) appendChar(ch, span.style, i);
      }
    }
  };

  return {
    render: (parsed, visibleChars) => {
      const clamped = Math.max(0, Math.min(parsed.plain.length, visibleChars));
      if (!parsed.hasMarkup) {
        if (lastRaw !== parsed.raw || lastHasMarkup) {
          fullEl.textContent = parsed.plain;
          lastRaw = parsed.raw;
          lastHasMarkup = false;
          lastVisible = -1;
        }
        if (clamped !== lastVisible) {
          revealedEl.textContent = parsed.plain.slice(0, clamped);
          lastVisible = clamped;
        }
        return;
      }

      if (lastRaw !== parsed.raw || !lastHasMarkup) {
        buildGhostDom(fullEl, parsed);
        clearIncremental();
        lastRaw = parsed.raw;
        lastHasMarkup = true;
      } else if (clamped < lastVisible) {
        clearIncremental();
      }
      if (clamped > lastVisible) {
        appendRange(parsed, Math.max(0, lastVisible), clamped);
        lastVisible = clamped;
      }
    },
    reset: () => {
      lastRaw = "";
      lastHasMarkup = false;
      lastVisible = -1;
      activeWordEl = null;
      activeRunEl = null;
      activeRunKey = "";
    },
  };
}
