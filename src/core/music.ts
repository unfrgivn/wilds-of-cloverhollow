import type { State, World } from "./types";

export type MusicTrack =
  | "title"
  | "home"
  | "cafe"
  | "hills"
  | "school"
  | "bay"
  | "pass"
  | "cavern"
  | "woods"
  | "arcade"
  | "enchanted"
  | "enchanted-calm"
  | "battle"
  | "boss"
  | "talk"
  | "morning"
  | "silent";

export type JukeboxTrack = Exclude<MusicTrack, "silent">;

export const jukeboxTracks: readonly JukeboxTrack[] = [
  "title",
  "home",
  "cafe",
  "school",
  "bay",
  "pass",
  "cavern",
  "woods",
  "hills",
  "arcade",
  "enchanted",
  "enchanted-calm",
  "battle",
  "boss",
  "talk",
  "morning",
];

export type AmbienceBed =
  | "none"
  | "town-breeze"
  | "ocean"
  | "mountain-wind"
  | "hearth"
  | "forest"
  | "enchanted-shimmer"
  | "arcade-hum"
  | "cavern-drips"
  | "cafe-murmur";

export type SoundtrackState = {
  track: MusicTrack;
  ambience: AmbienceBed;
  duck: boolean;
  title: string;
};

export const trackTitles: Record<MusicTrack, string> = {
  title: "Watercolor Morning",
  home: "Cloverhollow Town",
  cafe: "Cinnamon Waltz",
  hills: "Clover Meadow",
  school: "Bell & Chalk",
  bay: "Bubblegum Breeze",
  pass: "Pinecone Snowfall",
  cavern: "Crystal Echoes",
  woods: "Whispering Canopy",
  arcade: "Star Racer Tokens",
  enchanted: "Misty Dream",
  "enchanted-calm": "Ancient Tree's Song",
  battle: "Fizzy Calm-Down!",
  boss: "The Purple Hood",
  talk: "Listening Heart",
  morning: "Waking Up",
  silent: "Quiet",
};

const areaTracks: Record<string, MusicTrack> = {
  bedroom: "home",
  kitchen: "home",
  plaza: "home",
  cafe: "cafe",
  park: "home",
  hills: "hills",
  sanctuary: "hills",
  school: "school",
  "east-hall": "school",
  classroom: "school",
  gym: "school",
  music: "school",
  "art-room": "school",
  field: "school",
  bay: "bay",
  trail: "bay",
  pass: "pass",
  lodge: "pass",
  cavern: "cavern",
  woods: "woods",
  clubhouse: "woods",
  arcade: "arcade",
  mist: "enchanted",
};

const landTracks: Record<string, MusicTrack> = {
  cloverhollow: "home",
  hills: "hills",
  bay: "bay",
  trail: "bay",
  pass: "pass",
  forest: "woods",
  enchanted: "enchanted",
};

const areaAmbience: Record<string, AmbienceBed> = {
  plaza: "town-breeze",
  cafe: "cafe-murmur",
  park: "town-breeze",
  hills: "town-breeze",
  sanctuary: "forest",
  field: "town-breeze",
  bay: "ocean",
  trail: "ocean",
  pass: "mountain-wind",
  lodge: "hearth",
  cavern: "cavern-drips",
  woods: "forest",
  mist: "enchanted-shimmer",
  enchanted: "enchanted-shimmer",
  arcade: "arcade-hum",
};

function makeSoundtrack(
  track: MusicTrack,
  ambience: AmbienceBed,
  duck: boolean,
): SoundtrackState {
  return { track, ambience, duck, title: trackTitles[track] };
}

/** Pure projection from game state to active music track, ambience bed, and ducking. */
export function soundtrackFor(
  world: Pick<World, "areas" | "critters" | "storyVariable">,
  state: State,
  options: { titleOpen: boolean },
): SoundtrackState {
  if (options.titleOpen) return makeSoundtrack("title", "none", false);
  if (state.finale === "morning" || state.finale === "credits") {
    const ambience: AmbienceBed =
      state.finale === "morning" && state.area === "bedroom" ? "town-breeze" : "none";
    return makeSoundtrack("morning", ambience, state.dialogue !== null);
  }
  if (state.battle !== null) {
    const critter = world.critters[state.battle.critterId];
    const critterTalk = critter?.talk ?? null;
    const talkActive =
      (state.battle.talk !== null && state.battle.talk !== undefined) ||
      (critterTalk !== null && state.battle.calm >= critterTalk.talkAt);
    const isBoss =
      critter !== undefined &&
      (critter.windUp !== null || critterTalk !== null || !critter.canRun);
    const track: MusicTrack = talkActive ? "talk" : isBoss ? "boss" : "battle";
    return makeSoundtrack(track, "none", state.battle.phase === "reward");
  }
  if (state.area === "harness") return makeSoundtrack("silent", "none", false);
  let track: MusicTrack;
  if (state.area === "enchanted") {
    track = world.storyVariable(state.ink, "forest_fizzy") === false
      ? "enchanted-calm"
      : "enchanted";
  } else {
    const byArea = areaTracks[state.area];
    if (byArea !== undefined) {
      track = byArea;
    } else {
      const land = world.areas[state.area]?.land;
      track = (land !== undefined ? landTracks[land] : undefined) ?? "home";
    }
  }
  const ambience: AmbienceBed = areaAmbience[state.area] ?? "none";
  const duck = state.dialogue !== null || state.journalOpen || state.arcade !== null;
  return makeSoundtrack(track, ambience, duck);
}
