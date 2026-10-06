export type BattleLayout = {
  scale: number;
  critter: { x: number; baseline: number; height: number };
  fae: { x: number; baseline: number; height: number };
  // Where each party member stands (CSS px; y is the baseline): member 0 at
  // Fae's side toward the critter, the rest spaced out on her far side.
  party: { x: number; y: number }[];
};

// Logical units from Fae's feet: member 0 sits 42 toward the critter; each
// further member stands partySpacing further from the critter.
const firstMemberOffset = 42;
const partySpacing = 64;

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
    x: width * 0.22,
    baseline: height * 0.57,
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
      x:
        index === 0
          ? fae.x + firstMemberOffset * scale
          : fae.x - index * partySpacing * scale,
      y: fae.baseline,
    })),
  };
}
