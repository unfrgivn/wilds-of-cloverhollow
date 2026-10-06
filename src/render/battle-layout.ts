export type BattleLayout = {
  scale: number;
  frog: { x: number; baseline: number; height: number };
  fae: { x: number; baseline: number; height: number };
};

export function battleLayout(
  width: number,
  height: number,
  viewWidth: number,
  viewHeight: number,
  battleHeight: number,
  faeHeight: number,
): BattleLayout {
  const scale = Math.min(width / viewWidth, height / viewHeight);
  return {
    scale,
    frog: {
      x: width * 0.5,
      baseline: height * 0.42 + (battleHeight * scale) / 2,
      height: battleHeight * scale,
    },
    fae: {
      x: width * 0.22,
      baseline: height * 0.57,
      height: faeHeight * scale,
    },
  };
}
