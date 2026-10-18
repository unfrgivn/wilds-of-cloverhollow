export type QaInput = { up: boolean; down: boolean; confirm: boolean; cancel: boolean };
export type QaResult = { open: boolean; selected: number; action: number | null };

export function qaFlow(count: number, selected: number, input: QaInput): QaResult {
  if (count <= 0) return { open: false, selected: 0, action: null };
  const next = input.up
    ? (selected + count - 1) % count
    : input.down
      ? (selected + 1) % count
      : selected;
  if (input.cancel) return { open: false, selected: next, action: null };
  return { open: true, selected: next, action: input.confirm ? next : null };
}
