import { journalProgress, type ActionFrame, type State, type World } from "../core";
import type { CompanionAudioEffect } from "../platform/audio";
import type { TitleChoiceId } from "../ui/title";

export type TitleMode = "fresh" | "continue" | "confirm";
export type TitleAction = "continue" | "new-game" | null;
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
  action: TitleAction;
};

/** Maps a title screen transition to its storybook UI foley effect, or null on no-op. */
export function titleEffectForTransition(
  before: { mode: TitleMode; selected: TitleChoiceId },
  after: { mode: TitleMode | null; selected: TitleChoiceId; action: TitleAction },
): CompanionAudioEffect | null {
  if (after.action === "continue" || after.action === "new-game") return "title-start";
  if (before.mode !== after.mode) return after.mode === "confirm" ? "card-open" : "card-close";
  if (before.selected !== after.selected) return "title-move";
  return null;
}

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

// The line under Continue: where Fae is, sticker count, and up to two highlights.
export function continueDetail(world: World, state: State): string {
  const area = world.areas[state.area]?.name ?? state.area;
  const count = state.stickers.length;
  const parts = [`${area} · ${count} sticker${count === 1 ? "" : "s"}`];
  const progress = journalProgress(world, state);
  const highlights: string[] = [];
  if (progress.gems.owned > 0) {
    highlights.push(`${progress.gems.owned}/${progress.gems.total} gems`);
  }
  if (progress.keepsakes.owned > 0) {
    highlights.push(
      `${progress.keepsakes.owned} keepsake${progress.keepsakes.owned === 1 ? "" : "s"}`,
    );
  }
  if (progress.fish.owned > 0) {
    highlights.push(`${progress.fish.owned} fish`);
  }
  parts.push(...highlights.slice(0, 2));
  return parts.join(" · ");
}

/** Projects consecutive input frames into edge-triggered Title Screen navigation input. */
export function titleInputFromFrames(frame: ActionFrame, previous: ActionFrame): TitleInput {
  return {
    up: frame.move.y < -0.5 && previous.move.y >= -0.5,
    down: frame.move.y > 0.5 && previous.move.y <= 0.5,
    left: frame.move.x < -0.5 && previous.move.x >= -0.5,
    right: frame.move.x > 0.5 && previous.move.x <= 0.5,
    confirm: frame.confirm && !previous.confirm,
    cancel: frame.cancel && !previous.cancel,
  };
}
