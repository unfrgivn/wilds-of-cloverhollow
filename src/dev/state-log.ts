import type { State } from "../core";

export function createStateLogger(): (state: State) => void {
  let previous: State | undefined;
  let lastPositionLog = -Infinity;
  let first = true;
  return (state: State): void => {
    const areaChanged = previous !== undefined && state.area !== previous.area;
    const facingChanged = previous !== undefined && state.facing !== previous.facing;
    const positionChanged =
      previous !== undefined &&
      (state.player.x !== previous.player.x || state.player.y !== previous.player.y);
    const now = performance.now();
    if (
      first ||
      areaChanged ||
      facingChanged ||
      (positionChanged && now - lastPositionLog >= 250)
    ) {
      console.log(
        `[cloverhollow] state ${JSON.stringify({
          tick: state.tick,
          area: state.area,
          x: Math.round(state.player.x),
          y: Math.round(state.player.y),
          facing: state.facing,
        })}`,
      );
      lastPositionLog = now;
      first = false;
    }
    previous = state;
  };
}
