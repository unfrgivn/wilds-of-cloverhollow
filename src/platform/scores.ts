export type {
  InstrumentVoice,
  NoteEvent,
  PlayableTrack,
  Score,
  ScoreTrack,
} from "./scores-helpers";
import type { PlayableTrack, Score } from "./scores-helpers";
import { townScores } from "./scores-town";
import { wildsScores } from "./scores-wilds";

export const scores: Record<PlayableTrack, Score> = {
  title: townScores.title,
  home: townScores.home,
  cafe: townScores.cafe,
  hills: wildsScores.hills,
  sanctuary: wildsScores.sanctuary,
  school: townScores.school,
  bay: wildsScores.bay,
  fishing: townScores.fishing,
  pass: wildsScores.pass,
  lodge: townScores.lodge,
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
