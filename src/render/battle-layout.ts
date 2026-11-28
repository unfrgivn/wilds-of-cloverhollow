export type BattleLayout = {
  scale: number;
  critter: { x: number; baseline: number; height: number };
  fae: { x: number; baseline: number; height: number };
  // Where each party member stands (CSS px; y is the baseline): spaced out
  // behind Fae in party order, keeping pets at the end of the line.
  party: { x: number; y: number }[];
};

// Logical units between Fae and each fighting party member behind her.
const partySpacing = 68;

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
