import type { State, World } from "../core";
import type { TitleChoiceId } from "../ui/title";

export type TitleMode = "fresh" | "continue" | "confirm";
export type TitleInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  cancel: boolean;
  choose?: TitleChoiceId;
};
export type TitleResult = {
  mode: TitleMode | null;
  selected: TitleChoiceId;
  action: "continue" | "new-game" | null;
};

export function titleFlow(
  mode: TitleMode,
  selected: TitleChoiceId,
  input: TitleInput,
): TitleResult {
  if (input.choose !== undefined) {
    if (
      mode === "confirm" &&
      (input.choose === "confirm-yes" || input.choose === "confirm-no")
    )
      return input.choose === "confirm-yes"
        ? { mode: null, selected, action: "new-game" }
        : { mode: "continue", selected: "continue", action: null };
    if (
      (mode === "continue" && input.choose === "continue") ||
      (mode !== "confirm" && input.choose === "new-game")
    )
      return input.choose === "continue"
        ? { mode: null, selected, action: "continue" }
        : {
            mode: mode === "fresh" ? null : "confirm",
            selected: mode === "fresh" ? selected : "confirm-no",
            action: mode === "fresh" ? "new-game" : null,
          };
  }
  if (mode === "confirm") {
    const picked =
      input.left || input.up
        ? "confirm-yes"
        : input.right || input.down
          ? "confirm-no"
          : selected;
    if (input.cancel)
      return { mode: "continue", selected: "continue", action: null };
    if (input.confirm)
      return picked === "confirm-yes"
        ? { mode: null, selected: picked, action: "new-game" }
        : { mode: "continue", selected: "continue", action: null };
    return { mode, selected: picked, action: null };
  }
  const picked =
    mode === "fresh"
      ? "new-game"
      : input.up || input.left
        ? "continue"
        : input.down || input.right
          ? "new-game"
          : selected;
  if (input.confirm)
    return picked === "continue"
      ? { mode: null, selected: picked, action: "continue" }
      : mode === "fresh"
        ? { mode: null, selected: picked, action: "new-game" }
        : { mode: "confirm", selected: "confirm-no", action: null };
  return { mode, selected: picked, action: null };
}

// The line under Continue: where Fae is and how many stickers she has.
export function continueDetail(world: World, state: State): string {
  const area = world.areas[state.area]?.name ?? state.area;
  const count = state.stickers.length;
  return `${area} · ${count} sticker${count === 1 ? "" : "s"}`;
}
