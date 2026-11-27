export type {
  InstrumentVoice,
  NoteEvent,
  PlayableTrack,
  Score,
  ScoreTrack,
} from "./scores-helpers";
import type { PlayableTrack, Score } from "./scores-helpers";
import { interiorScores } from "./scores-interiors";
import { townScores } from "./scores-town";
import { wildsScores } from "./scores-wilds";

export const scores: Record<PlayableTrack, Score> = {
  title: townScores.title,
  home: townScores.home,
  cafe: townScores.cafe,
  market: interiorScores.market,
  parlor: interiorScores.parlor,
  hills: wildsScores.hills,
  sanctuary: wildsScores.sanctuary,
  school: townScores.school,
  bay: wildsScores.bay,
  fishing: townScores.fishing,
  cottage: interiorScores.cottage,
  pass: wildsScores.pass,
  lodge: townScores.lodge,
  cabin: interiorScores.cabin,
  cavern: wildsScores.cavern,
  woods: wildsScores.woods,
  clubhouse: townScores.clubhouse,
  arcade: townScores.arcade,
  enchanted: wildsScores.enchanted,
  "enchanted-calm": wildsScores["enchanted-calm"],
  battle: wildsScores.battle,
  boss: wildsScores.boss,
  talk: townScores.talk,
  morning: townScores.morning,
};
