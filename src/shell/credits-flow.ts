export const CREDITS_BEAT_TICKS = 12;

export function creditsConfirmAllowed(ticksSinceOpen: number, confirmEdge: boolean): boolean {
  return confirmEdge && ticksSinceOpen >= CREDITS_BEAT_TICKS;
}
