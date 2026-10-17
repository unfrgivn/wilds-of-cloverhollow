import { createClaw, type ClawInfo } from "./claw";
import { createSkee, type SkeeInfo } from "./skee";
import type { AtlasImage } from "./atlas";
import type { ArcadeView, ClawCalibration, SkeeCalibration } from "../core";

// What renderInfo().arcade reports (spec 11): the open game's close-up as drawn.
export type ArcadeInfo = ClawInfo | SkeeInfo;

// The arcade's close-ups (spec 8.2), one per game: each frame, the open game's
// view goes to its own, and the other is hidden.
export function createArcade(
  root: HTMLElement,
  art: (frame: string) => AtlasImage | null,
  claw: { calibration: ClawCalibration; image: string },
  skee: { calibration: SkeeCalibration; image: string },
): { render: (view: ArcadeView | null) => void; info: () => ArcadeInfo | null } {
  const clawUp = createClaw(root, art, claw.calibration, claw.image);
  const skeeUp = createSkee(root, skee.calibration, skee.image);
  return {
    render: (view) => {
      clawUp.render(view?.game === "claw" ? view : null);
      skeeUp.render(view?.game === "skee" ? view : null);
    },
    info: () => clawUp.info() ?? skeeUp.info(),
  };
}
