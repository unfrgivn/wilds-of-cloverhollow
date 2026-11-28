import type { BattleCheckView, BattleView, Point, State, World } from "../core";

export type BattleLayout = {
  scale: number;
  critter: { x: number; baseline: number; height: number };
  fae: { x: number; baseline: number; height: number };
  // Where each party member stands (CSS px; y is the baseline): spaced out
  // behind Fae in party order, keeping pets at the end of the line.
  party: { x: number; y: number }[];
};

export type FormationFoeLayout = {
  x: number;
  baseline: number;
  height: number;
};

export type BattleCheckGeometryV2 =
  | {
      kind: "which-one";
      x: number;
      y: number;
      cupSize: number;
      cupSpacing: number;
      hintAt: Point;
    }
  | {
      kind: "whack";
      x: number;
      y: number;
      slotSize: number;
      spread: number;
      hintAt: Point;
    }
  | {
      kind: "spin-snag";
      rect: { x: number; y: number; width: number; height: number };
      hintAt: Point;
    };

// Where a battle check is drawn, in CSS px (spec 8.1).
// `hintAt` is where the check's hint sticker hangs (its top centre).
export type BattleCheckGeometry =
  | { kind: "ring"; x: number; y: number; radius: number; hintAt: Point }
  | { kind: "charge"; x: number; y: number; width: number; height: number; hintAt: Point }
  | { kind: "chain"; from: Point; to: Point; radius: number; hintAt: Point }
  | {
      kind: "catch";
      lanes: [number, number, number];
      fromX: number;
      catcherX: number;
      radius: number;
      toyScale: number;
      hintAt: Point;
    }
  | {
      kind: "lean";
      track: { x: number; y: number; width: number; height: number };
      wind: { x: number; rows: number[]; length: number };
      hintAt: Point;
    }
  | {
      kind: "trace";
      rect: { x: number; y: number; width: number; height: number };
      brush: Point;
      points: Point[];
      checkpoint: number;
      hintAt: Point;
    }
  | {
      kind: "peekaboo";
      x: number;
      y: number;
      track: { x: number; y: number; width: number; height: number };
      hintAt: Point;
    }
  | { kind: "echo"; x: number; y: number; hintAt: Point }
  | BattleCheckGeometryV2;

// Logical units between Fae and each fighting party member behind her.
const partySpacing = 68;
// Half the widest hint sticker, in CSS px, to keep hints on screen.
const hintHalfWidth = 130;

export function battleLayout(
  width: number,
  height: number,
  viewWidth: number,
  viewHeight: number,
  critterHeight: number,
  faeHeight: number,
  partySize: number,
): BattleLayout {
  const scale = Math.min(width / viewWidth, height / viewHeight);
  const fae = {
    x: width * 0.27,
    baseline: height * 0.59,
    height: faeHeight * scale,
  };
  return {
    scale,
    critter: {
      x: width * 0.5,
      baseline: height * 0.42 + (critterHeight * scale) / 2,
      height: critterHeight * scale,
    },
    fae,
    party: Array.from({ length: partySize }, (_, index) => ({
      x: fae.x - (index + 1) * partySpacing * scale,
      y: fae.baseline,
    })),
  };
}

/**
 * Pure CSS-pixel slots for 1..3 critters on the battle stage.
 * A single foe lands at the exact `battleLayout` coordinates so existing
 * single-foe baselines stay 100% pixel-identical.
 */
export function formationFoeLayouts(
  width: number,
  height: number,
  scale: number,
  foes: readonly { battleHeight: number }[],
): FormationFoeLayout[] {
  if (foes.length <= 1) {
    const h = (foes[0]?.battleHeight ?? 145) * scale;
    return [{ x: width * 0.5, baseline: height * 0.42 + h / 2, height: h }];
  }
  const desktop = width >= 960;
  if (foes.length === 2) {
    const xs: readonly number[] = desktop ? [0.48, 0.64] : [0.44, 0.59];
    const ys: readonly number[] = [0.39, 0.47];
    return foes.map((foe, index) => {
      const h = foe.battleHeight * scale;
      return {
        x: width * (xs[index] ?? 0.5),
        baseline: height * (ys[index] ?? 0.42) + h / 2,
        height: h,
      };
    });
  }
  const xs: readonly number[] = desktop ? [0.44, 0.56, 0.68] : [0.42, 0.53, 0.64];
  const ys: readonly number[] = [0.37, 0.46, 0.39];
  return foes.map((foe, index) => {
    const h = foe.battleHeight * scale;
    return {
      x: width * (xs[index] ?? 0.56),
      baseline: height * (ys[index] ?? 0.42) + h / 2,
      height: h,
    };
  });
}

/** Pure CSS-pixel geometry for the 3 Track E7 v2 battle check overlays. */
export function computeBattleCheckGeometryV2(
  check: BattleCheckView,
  layout: BattleLayout,
  width: number,
  height: number,
): BattleCheckGeometryV2 | null {
  const hintAt = (x: number): Point => ({
    x: Math.min(width - hintHalfWidth, Math.max(hintHalfWidth, x)),
    y: layout.fae.baseline + 0.18 * layout.fae.height,
  });
  if (check.kind === "which-one") {
    const x = width * 0.5;
    const y = height * 0.44;
    return {
      kind: "which-one",
      x,
      y,
      cupSize: width >= 1000 ? 96 : 72,
      cupSpacing: width >= 1000 ? 132 : 94,
      hintAt: hintAt(x),
    };
  }
  if (check.kind === "whack") {
    const x = width * 0.54;
    const y = height * (width >= 1000 ? 0.39 : 0.41);
    const slotSize = width >= 1000 ? 74 : 56;
    const spread = width >= 1000 ? 84 : 62;
    const baseHint = hintAt(x);
    const belowBoard = y + spread + slotSize * 0.5 + 34;
    return {
      kind: "whack",
      x,
      y,
      slotSize,
      spread,
      hintAt: {
        x: baseHint.x,
        y: Math.min(height - 32, Math.max(baseHint.y, belowBoard)),
      },
    };
  }
  if (check.kind === "spin-snag") {
    const size = width >= 1000 ? 220 : 168;
    const x = Math.max(88, Math.min(width - size - 88, width * 0.5 - size / 2));
    const y = Math.max(
      96,
      Math.min(height - size - 78, height * 0.44 - size / 2),
    );
    const baseHint = hintAt(x + size / 2);
    return {
      kind: "spin-snag",
      rect: { x, y, width: size, height: size },
      hintAt: {
        x: baseHint.x,
        y: Math.min(height - 32, Math.max(baseHint.y, y + size + 16)),
      },
    };
  }
  return null;
}

/** Pure CSS-pixel geometry for every active battle check (v1 + v2). */
export function computeBattleCheckGeometry(
  world: Pick<World, "critters">,
  state: Pick<State, "battle">,
  view: BattleView | null,
  layout: BattleLayout,
  width: number,
  height: number,
): BattleCheckGeometry | null {
  const check = view?.check ?? null;
  if (check === null || state.battle?.phase === "reward") return null;
  if (check.kind === "which-one" || check.kind === "whack" || check.kind === "spin-snag") {
    return computeBattleCheckGeometryV2(check, layout, width, height);
  }
  const fae = layout.fae;
  const faeCentre = { x: fae.x, y: fae.baseline - fae.height / 2 };
  const foes = view?.foes ?? [];
  const targetFoeLayout = foes.length > 1
    ? formationFoeLayouts(width, height, layout.scale, foes)[view?.targetIndex ?? 0]
    : undefined;
  const critter = targetFoeLayout ?? layout.critter;
  const critterCentre = { x: critter.x, y: critter.baseline - critter.height / 2 };
  const hintAt = (x: number): Point => ({
    x: Math.min(width - hintHalfWidth, Math.max(hintHalfWidth, x)),
    y: fae.baseline + 0.18 * fae.height,
  });
  if (check.kind === "ring") {
    return check.side === "fae"
      ? { kind: "ring", ...faeCentre, radius: 0.55 * fae.height, hintAt: hintAt(fae.x) }
      : {
          kind: "ring",
          ...critterCentre,
          radius: 0.55 * critter.height,
          hintAt: hintAt(critter.x),
        };
  }
  if (check.kind === "catch") {
    const entry = world.critters[state.battle?.critterId ?? ""];
    const figure = entry?.figureHeight ?? 1;
    return {
      kind: "catch",
      lanes: [
        fae.baseline - 1.05 * fae.height,
        fae.baseline - 0.55 * fae.height,
        fae.baseline - 0.1 * fae.height,
      ],
      fromX: critter.x - 0.35 * critter.height,
      catcherX: fae.x + 0.7 * fae.height,
      radius: 0.2 * fae.height,
      toyScale: (critter.height / figure) * (entry?.toyScale ?? 1),
      hintAt: hintAt((fae.x + 0.7 * fae.height + critter.x) / 2),
    };
  }
  if (check.kind === "lean") {
    return {
      kind: "lean",
      track: {
        x: fae.x,
        y: fae.baseline - 1.45 * fae.height,
        width: 1.6 * fae.height,
        height: Math.max(12, 0.12 * fae.height),
      },
      wind: {
        x: fae.x + fae.height,
        rows: [1.05, 0.8, 0.55, 0.3].map((share) => fae.baseline - share * fae.height),
        length: Math.max(56, 0.6 * fae.height),
      },
      hintAt: hintAt((fae.x + critter.x) / 2),
    };
  }
  if (check.kind === "peekaboo") {
    const trackWidth = Math.max(128, Math.min(200, 1.65 * fae.height));
    const trackHeight = Math.max(14, Math.min(20, 0.13 * fae.height));
    const x = Math.max(trackWidth / 2 + 24, fae.x);
    const y = Math.max(131, fae.baseline - 1.52 * fae.height);
    return {
      kind: "peekaboo",
      x,
      y,
      track: { x, y, width: trackWidth, height: trackHeight },
      hintAt: hintAt((fae.x + critter.x) / 2),
    };
  }
  if (check.kind === "echo") {
    const x = Math.min(
      width - (width >= 1000 ? 164 : 206),
      Math.max(critter.x + critter.height * 0.56 + 132, Math.round(width * 0.77)),
    );
    const y = width >= 1000
      ? Math.max(214, Math.round(critterCentre.y))
      : Math.max(166, Math.round(critterCentre.y));
    const baseHint = hintAt((fae.x + critter.x) / 2);
    return {
      kind: "echo",
      x,
      y,
      hintAt: { x: baseHint.x, y: Math.min(height - 46, Math.max(baseHint.y, 268)) },
    };
  }
  if (check.side === "fae" && check.kind !== "trace") {
    return {
      kind: "chain",
      from: critterCentre,
      to: faeCentre,
      radius: 0.3 * fae.height,
      hintAt: hintAt(fae.x),
    };
  }
  if (check.kind === "trace") {
    const size = Math.min(360, Math.max(180, height - 150), width * 0.42);
    const x = Math.max(88, Math.min(width - size - 250, (fae.x + critter.x) / 2 - size / 2));
    const y = Math.max(88, Math.min(height - size - 92, fae.baseline - fae.height - size * 0.08));
    return {
      kind: "trace",
      rect: { x, y, width: size, height: size },
      brush: check.brush,
      points: check.path.points,
      checkpoint: check.checkpoint,
      hintAt: hintAt(x + size / 2),
    };
  }
  const feet = (check.actor === null ? undefined : layout.party[check.actor]) ??
    { x: fae.x, y: fae.baseline };
  if (check.kind === "chain") {
    return {
      kind: "chain",
      from: { x: feet.x, y: feet.y - 1.6 * fae.height },
      to: { x: feet.x, y: feet.y - 0.6 * fae.height },
      radius: 0.16 * fae.height,
      hintAt: hintAt(feet.x),
    };
  }
  const meterHeight = 1.1 * fae.height;
  const meterWidth = Math.max(22, 0.18 * fae.height);
  const meterX = feet.x - 0.3 * fae.height - meterWidth;
  return {
    kind: "charge",
    x: meterX,
    y: feet.y - meterHeight,
    width: meterWidth,
    height: meterHeight,
    hintAt: hintAt(meterX + meterWidth / 2),
  };
}
