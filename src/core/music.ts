import type { State, World } from "./types";

export type MusicTrack =
  | "title"
  | "home"
  | "cafe"
  | "market"
  | "parlor"
  | "loft"
  | "bloom"
  | "hills"
  | "sanctuary"
  | "school"
  | "bay"
  | "fishing"
  | "cottage"
  | "island"
  | "pass"
  | "lodge"
  | "cabin"
  | "summit"
  | "cavern"
  | "woods"
  | "clubhouse"
  | "arcade"
  | "taco"
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
  "market",
  "parlor",
  "loft",
  "bloom",
  "school",
  "bay",
  "fishing",
  "cottage",
  "island",
  "pass",
  "lodge",
  "cabin",
  "summit",
  "cavern",
  "woods",
  "clubhouse",
  "hills",
  "sanctuary",
  "arcade",
  "taco",
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
  market: "Pippin's Basket Waltz",
  parlor: "Sweet Scoop Rag",
  loft: "Paper Plane Sketchbook",
  bloom: "Rosie's Flower Window",
  hills: "Clover Meadow",
  sanctuary: "Meadow of Friends",
  school: "Bell & Chalk",
  bay: "Bubblegum Breeze",
  fishing: "Docked by the Tide",
  cottage: "Sea-Glass Sunroom",
  island: "Starlight Beacon",
  pass: "Pinecone Snowfall",
  lodge: "Hearth & Cocoa",
  cabin: "Timber & Tea",
  summit: "Above the Pines",
  cavern: "Crystal Echoes",
  woods: "Whispering Canopy",
  clubhouse: "Our Secret Treehouse",
  arcade: "Star Racer Tokens",
  taco: "Mateo's Fiesta Truck",
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
  market: "market",
  parlor: "parlor",
  park: "home",
  "milo-house": "loft",
  "rosie-cottage": "bloom",
  hills: "hills",
  sanctuary: "sanctuary",
  school: "school",
  "east-hall": "school",
  classroom: "school",
  gym: "school",
  music: "school",
  "art-room": "school",
  field: "school",
  bay: "bay",
  island: "island",
  "sue-cottage": "cottage",
  trail: "bay",
  pass: "pass",
  summit: "summit",
  lodge: "lodge",
  "jordan-cabin": "cabin",
  cavern: "cavern",
  woods: "woods",
  clubhouse: "clubhouse",
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
  market: "cafe-murmur",
  parlor: "cafe-murmur",
  park: "town-breeze",
  hills: "town-breeze",
  sanctuary: "forest",
  field: "town-breeze",
  bay: "ocean",
  island: "ocean",
  "sue-cottage": "ocean",
  trail: "ocean",
  pass: "mountain-wind",
  summit: "mountain-wind",
  lodge: "hearth",
  "jordan-cabin": "hearth",
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
  if (state.arcade?.game === "fish") {
    return makeSoundtrack("fishing", "ocean", state.dialogue !== null);
  }
  if (state.arcade?.game === "taco") {
    return makeSoundtrack("taco", "town-breeze", state.dialogue !== null);
  }
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
