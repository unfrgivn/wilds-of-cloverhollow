/**
 * Splits accumulated real time into whole simulation ticks. At most `maxTicks`
 * run per animation frame; when more time has piled up than that (a hitch, a
 * background tab), the excess is dropped instead of fast-forwarding the game.
 */
export function drainTicks(
  accumulatorMs: number,
  stepMs: number,
  maxTicks: number,
): { ticks: number; remainingMs: number } {
  const available = Math.max(0, Math.floor(accumulatorMs / stepMs));
  const ticks = Math.min(available, maxTicks);
  return {
    ticks,
    remainingMs: available > maxTicks ? 0 : accumulatorMs - ticks * stepMs,
  };
}
