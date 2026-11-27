import type { ArcadeRecordBadge } from "./arcade-popups";
import { createClaw, type ClawInfo } from "./claw";
import { createCook, type CookInfo } from "./cook";
import { createFish, type FishInfo } from "./fish";
import { createMole, type MoleInfo } from "./mole";
import { createComet, type CometInfo } from "./comet";
import { createSkee, type SkeeInfo } from "./skee";
import type { AtlasImage } from "./atlas";
import type {
  ArcadeView, ClawCalibration, CookCalibration, FishCalibration, MoleCalibration, MoleHole,
  SkeeCalibration, CometCalibration,
} from "../core";

// What renderInfo().arcade reports (spec 11): the open game's close-up as drawn.
export type ArcadeInfo = ClawInfo | SkeeInfo | MoleInfo | CometInfo | CookInfo | FishInfo;

// The arcade's close-ups (spec 8.2), one per game (the clubhouse microwave and
// Bubblegum Bay fishing dock too): each frame, the open game's view goes to its
// own, and the others are hidden.
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
  comet: {
    calibration: CometCalibration;
    image: string;
    art: (frame: string) => AtlasImage | null;
  },
  cook: {
    calibration: CookCalibration;
    image: string;
    art: (frame: string) => AtlasImage | null;
  },
  fish: {
    calibration: FishCalibration;
    image: string;
    art: (frame: string) => AtlasImage | null;
  },
): {
  render: (view: ArcadeView | null, record?: ArcadeRecordBadge | null) => void;
  info: () => ArcadeInfo | null;
} {
  const clawUp = createClaw(root, prizeArt, claw.calibration, claw.image);
  const skeeUp = createSkee(root, skee.calibration, skee.image);
  const moleUp = createMole(root, mole.art, mole.calibration, mole.image, mole.onHole);
  const cometUp = createComet(root, comet.art, comet.calibration, comet.image);
  const cookUp = createCook(root, cook.art, cook.calibration, cook.image);
  const fishUp = createFish(root, fish.art, fish.calibration, fish.image);
  return {
    render: (view, record = null) => {
      clawUp.render(view?.game === "claw" ? view : null);
      skeeUp.render(view?.game === "skee" ? view : null, view?.game === "skee" ? record : null);
      moleUp.render(view?.game === "mole" ? view : null, view?.game === "mole" ? record : null);
      cometUp.render(
        view?.game === "comet" ? view : null,
        view?.game === "comet" ? record : null,
      );
      cookUp.render(
        view?.game === "cook" ? view : null,
        view?.game === "cook" ? record : null,
      );
      fishUp.render(view?.game === "fish" ? view : null, view?.game === "fish" ? record : null);
    },
    info: () => clawUp.info() ?? skeeUp.info() ?? moleUp.info() ?? cometUp.info() ??
      cookUp.info() ?? fishUp.info(),
  };
}
