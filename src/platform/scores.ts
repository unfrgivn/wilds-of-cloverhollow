export type {
  InstrumentVoice,
  NoteEvent,
  PlayableTrack,
  Score,
  ScoreTrack,
} from "./scores-helpers";
import type { PlayableTrack, Score } from "./scores-helpers";
import { expansionScores } from "./scores-expansion";
import { interiorScores } from "./scores-interiors";
import { schoolScores } from "./scores-school";
import { townScores } from "./scores-town";
import { wildsScores } from "./scores-wilds";

export const scores: Record<PlayableTrack, Score> = {
  title: townScores.title,
  home: townScores.home,
  cafe: townScores.cafe,
  market: interiorScores.market,
  parlor: interiorScores.parlor,
  loft: expansionScores.loft,
  bloom: expansionScores.bloom,
  hills: wildsScores.hills,
  road: expansionScores.road,
  sanctuary: wildsScores.sanctuary,
  festival: expansionScores.festival,
  school: townScores.school,
  melody: schoolScores.melody,
  canvas: schoolScores.canvas,
  bay: wildsScores.bay,
  fishing: townScores.fishing,
  cottage: interiorScores.cottage,
  island: expansionScores.island,
  pass: wildsScores.pass,
  lodge: townScores.lodge,
  cabin: interiorScores.cabin,
  summit: expansionScores.summit,
  cavern: wildsScores.cavern,
  woods: wildsScores.woods,
  clubhouse: townScores.clubhouse,
  arcade: townScores.arcade,
  taco: expansionScores.taco,
  enchanted: wildsScores.enchanted,
  "enchanted-calm": wildsScores["enchanted-calm"],
  battle: wildsScores.battle,
  boss: wildsScores.boss,
  encore: interiorScores.encore,
  talk: townScores.talk,
  hearts: interiorScores.hearts,
  morning: townScores.morning,
};
