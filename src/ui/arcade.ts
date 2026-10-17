import { createClaw, type ClawInfo } from "./claw";
import { createMole, type MoleInfo } from "./mole";
import { createSkee, type SkeeInfo } from "./skee";
import type { AtlasImage } from "./atlas";
import type {
  ArcadeView, ClawCalibration, MoleCalibration, MoleHole, SkeeCalibration,
} from "../core";

// What renderInfo().arcade reports (spec 11): the open game's close-up as drawn.
export type ArcadeInfo = ClawInfo | SkeeInfo | MoleInfo;

// The arcade's close-ups (spec 8.2), one per game: each frame, the open game's
// view goes to its own, and the others are hidden.
export function createArcade(
  root: HTMLElement,
  prizeArt: (frame: string) => AtlasImage | null,
  claw: { calibration: ClawCalibration; image: string },
  skee: { calibration: SkeeCalibration; image: string },
  mole: {
    calibration: MoleCalibration;
    image: string;
    art: (frame: string) => AtlasImage | null;
    onHole: (hole: MoleHole, down: boolean) => void;
  },
): { render: (view: ArcadeView | null) => void; info: () => ArcadeInfo | null } {
  const clawUp = createClaw(root, prizeArt, claw.calibration, claw.image);
  const skeeUp = createSkee(root, skee.calibration, skee.image);
  const moleUp = createMole(root, mole.art, mole.calibration, mole.image, mole.onHole);
  return {
    render: (view) => {
      clawUp.render(view?.game === "claw" ? view : null);
      skeeUp.render(view?.game === "skee" ? view : null);
      moleUp.render(view?.game === "mole" ? view : null);
    },
    info: () => clawUp.info() ?? skeeUp.info() ?? moleUp.info(),
  };
}
