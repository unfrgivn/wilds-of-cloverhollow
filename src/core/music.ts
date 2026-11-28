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
  | "road"
  | "sanctuary"
  | "festival"
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
  | "encore"
  | "talk"
  | "hearts"
  | "morning"
  | "silent";

export type JukeboxTrack = Exclude<MusicTrack, "silent">;

export type TrackCategory = "town" | "interiors" | "wilds" | "festive" | "story";

export type TrackAlbumMeta = {
  track: JukeboxTrack;
  number: number;
  title: string;
  region: string;
  category: TrackCategory;
  mood: string;
  accent: string;
};

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
  "road",
  "sanctuary",
  "festival",
  "arcade",
  "taco",
  "enchanted",
  "enchanted-calm",
  "battle",
  "boss",
  "encore",
  "talk",
  "hearts",
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
  road: "Sunberry Road",
  sanctuary: "Meadow of Friends",
  festival: "Cloverhollow Jubilee",
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
  encore: "Starlight Encore!",
  talk: "Listening Heart",
  hearts: "Warm Hearth Hearts",
  morning: "Waking Up",
  silent: "Quiet",
};

type TrackLinerNote = Omit<TrackAlbumMeta, "track" | "number" | "title">;

const note = (
  region: string,
  category: TrackCategory,
  mood: string,
  accent: string,
): TrackLinerNote => ({ region, category, mood, accent });

const TRACK_ALBUM_NOTES: Readonly<Record<JukeboxTrack, TrackLinerNote>> = {
  title: note("Title Screen", "town", "Sunbeams & paper-cut opening overture", "#e6b85c"),
  home: note("Cloverhollow", "town", "Warm village stroll through sunny plazas", "#7ab874"),
  cafe: note("Bon Appétit Café", "interiors", "Buttery 3/4 waltz of scones & cocoa", "#d48a62"),
  market: note("Pippin's Market", "interiors", "Jaunty grocer waltz by berry baskets", "#de7d63"),
  parlor: note(
    "Sweet Scoop Parlor", "interiors", "Bouncy parlor ragtime & waffle cones", "#e88db0",
  ),
  loft: note("Milo's Loft", "interiors", "Daydreaming doodles & paper gliders", "#7d9fd6"),
  bloom: note(
    "Rosie's Cottage", "interiors", "Sunlit flowerbeds & sweet pastoral bloom", "#e592b0",
  ),
  school: note("Cloverhollow School", "town", "Crisp morning bells, chalk & recess joy", "#d99a52"),
  bay: note("Bubblegum Bay", "wilds", "Sparkling boardwalk waves & pastel skies", "#5cb4cf"),
  fishing: note("Bay Fishing Dock", "wilds", "Easygoing bobber sway & tide catches", "#4ea4bf"),
  cottage: note(
    "Sue's Cottage", "interiors", "Lulling sea-glass chime by the sunroom", "#64b5c9",
  ),
  island: note("Starlight Island", "wilds", "Dreamy lighthouse nocturne across water", "#6a88cf"),
  pass: note("Pinecone Pass", "wilds", "Crisp alpine air & fluttering snowflakes", "#7bb3de"),
  lodge: note(
    "Alpine Lodge", "interiors", "Crackling hearth warmth after snowy trails", "#cf7c52",
  ),
  cabin: note("Jordan's Cabin", "interiors", "Cedar mountain folk air & steeped tea", "#b88856"),
  summit: note("Alpine Summit", "wilds", "Soaring mountaintop waltz over the valley", "#6d9ed4"),
  cavern: note("Crystal Cavern", "wilds", "Glinting amethyst chimes below the pass", "#9b7cd4"),
  woods: note("Whispering Woods", "wilds", "Dappled mossy trails & rustling pines", "#5b9e76"),
  clubhouse: note(
    "Fae's Clubhouse", "town", "Cozy loft hideout of keepsakes & plushies", "#c78f54",
  ),
  hills: note("Clover Hills", "town", "Rolling emerald hillsides & drifting seeds", "#85bf6e"),
  road: note("East Road", "town", "Breezy country lane linking town to woods", "#c9a653"),
  sanctuary: note(
    "Wildlife Sanctuary", "town", "Peaceful clearing where calmed friends rest", "#6fb58a",
  ),
  festival: note(
    "Sanctuary Festival", "festive", "Sunlit ensemble jubilee across the valley", "#e3a93b",
  ),
  arcade: note(
    "Mr. Pip's Arcade", "festive", "Playful prize-counter bounce & star tokens", "#e07b6c",
  ),
  taco: note(
    "Clover Hills Truck", "festive", "Zesty kitchen groove & lunch-rush cheer", "#e38f3d",
  ),
  enchanted: note(
    "Enchanted Forest", "wilds", "Swirling silver mist & deep-woods mystery", "#8c7cc9",
  ),
  "enchanted-calm": note(
    "Restored Forest", "festive", "Golden bloom & serene harmony reborn", "#72ba8e",
  ),
  battle: note("Critter Battle", "story", "Peppy chamber rhythm for soothing critters", "#e37c68"),
  boss: note("Mini-Boss", "story", "Spirited showdown with a mysterious rival", "#8d68c7"),
  encore: note("Boss Encore", "story", "Heroic sunlit remix at the Dream Shrine", "#d9a032"),
  talk: note("Heartfelt Talk", "story", "Tender pause when a friend opens their heart", "#d984a2"),
  hearts: note("Heart-to-Heart", "story", "Intimate 3/4 waltz shared with friends", "#e07b9b"),
  morning: note("Finale & Credits", "story", "Golden sunrise glow after a cozy dream", "#e6b34e"),
};

/** Exhaustive 33-track soundtrack album catalog ordered identically to `jukeboxTracks`. */
export const JUKEBOX_ALBUM: readonly TrackAlbumMeta[] = jukeboxTracks.map((track, index) => ({
  track,
  number: index + 1,
  title: trackTitles[track],
  ...TRACK_ALBUM_NOTES[track],
}));

const ALBUM_BY_TRACK = new Map<JukeboxTrack, TrackAlbumMeta>(
  JUKEBOX_ALBUM.map((entry) => [entry.track, entry]),
);

/** Returns the album liner-notes metadata entry for any playable Jukebox track. */
export function trackAlbumEntry(track: JukeboxTrack): TrackAlbumMeta {
  const entry = ALBUM_BY_TRACK.get(track);
  if (entry !== undefined) return entry;
  return {
    track,
    number: jukeboxTracks.indexOf(track) + 1,
    title: trackTitles[track],
    ...TRACK_ALBUM_NOTES[track],
  };
}

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
  lane: "road",
  crossing: "road",
  sanctuary: "sanctuary",
  school: "school",
  "east-hall": "school",
  classroom: "school",
  gym: "school",
  music: "school",
  "art-room": "school",
  field: "school",
  bay: "bay",
  boardwalk: "bay",
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
  lane: "town-breeze",
  crossing: "forest",
  sanctuary: "forest",
  field: "town-breeze",
  bay: "ocean",
  boardwalk: "ocean",
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
    const isEncore = state.battle.encore !== undefined;
    const isBoss =
      critter !== undefined &&
      (critter.windUp !== null || critterTalk !== null || !critter.canRun);
    const track: MusicTrack = talkActive
      ? "talk"
      : isEncore
        ? "encore"
        : isBoss
          ? "boss"
          : "battle";
    return makeSoundtrack(
      track,
      "none",
      state.battle.phase === "reward" || state.battle.phase === "rest",
    );
  }
  if (state.area === "harness") return makeSoundtrack("silent", "none", false);
  if (state.arcade?.game === "fish") {
    return makeSoundtrack("fishing", "ocean", state.dialogue !== null);
  }
  if (state.arcade?.game === "taco") {
    return makeSoundtrack("taco", "town-breeze", state.dialogue !== null);
  }
  const ambience: AmbienceBed = areaAmbience[state.area] ?? "none";
  if (state.arcade === null && state.dialogue !== null && state.dialogue.knot.startsWith("h2h_")) {
    return makeSoundtrack("hearts", ambience, true);
  }
  let track: MusicTrack;
  if (state.area === "enchanted") {
    track = world.storyVariable(state.ink, "forest_fizzy") === false
      ? "enchanted-calm"
      : "enchanted";
  } else if (state.area === "sanctuary") {
    track = world.storyVariable(state.ink, "milo_revealed") === true
      ? "festival"
      : "sanctuary";
  } else {
    const byArea = areaTracks[state.area];
    if (byArea !== undefined) {
      track = byArea;
    } else {
      const land = world.areas[state.area]?.land;
      track = (land !== undefined ? landTracks[land] : undefined) ?? "home";
    }
  }
  const duck = state.dialogue !== null || state.journalOpen || state.arcade !== null;
  return makeSoundtrack(track, ambience, duck);
}
