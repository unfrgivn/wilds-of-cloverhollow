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
  sanctuary: wildsScores.sanctuary,
  school: townScores.school,
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
  talk: townScores.talk,
  morning: townScores.morning,
};
