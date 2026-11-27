import type { World } from "../core";
import type { AtlasFrame } from "./atlas";

export type SpeakerAccent =
  | "fae"
  | "family"
  | "friend"
  | "town"
  | "school"
  | "fairy"
  | "critter"
  | "mystery"
  | "default";

export type PortraitCropMode = "kid" | "adult" | "small" | "critter";

export type PortraitSource = {
  atlas: string;
  frame: string;
  cropMode: PortraitCropMode;
};

const FAMILY_SPEAKERS = new Set(["mom", "dad", "oliver", "maddie"]);
const FRIEND_SPEAKERS = new Set([
  "sue",
  "jordan",
  "milo",
  "rosie",
  "toby",
  "pond pup",
  "acorn squirrel",
  "ribbon bunny",
]);
const SCHOOL_SPEAKERS = new Set([
  "ms. clover",
  "ms. maple",
  "teacher",
  "nurse holly",
  "holly",
  "coach ash",
  "coach",
  "ms. reed",
  "ms. willow",
  "music teacher",
  "ms. rowan",
  "art teacher",
  "mr. bell",
  "principal",
]);
const TOWN_SPEAKERS = new Set([
  "chef bea",
  "chef mateo",
  "fizzy chef mateo",
  "grandpa barnaby",
  "barnaby",
  "bree",
  "ranger fern",
  "fern",
  "ms. coral",
  "lifeguard",
  "mrs. flurry",
  "lodge keeper",
  "mr. pip",
  "arcade keeper",
  "baker",
  "grocer",
  "scoops",
  "cocoa seller",
  "buster",
  "bay keeper",
  "pass keeper",
]);
const FAIRY_SPEAKERS = new Set(["lavender", "mint", "sky", "peach"]);
const MYSTERY_SPEAKERS = new Set([
  "hooded kid",
  "purple hood",
  "kid in purple",
  "mysterious voice",
  "???",
]);
const SIGN_SPEAKERS = new Set(["sign", "notice board", "chalkboard", "sanctuary board"]);
const CRITTER_KEYWORDS = [
  "frog",
  "pup",
  "cat",
  "bird",
  "squirrel",
  "hamster",
  "gull",
  "raccoon",
  "owl",
  "bunny",
  "lamb",
  "hedgehog",
  "crab",
  "penguin",
  "bat",
  "mole",
] as const;

export function speakerAccent(speaker: string | null): SpeakerAccent {
  if (speaker === null) return "default";
  const key = speaker.trim().toLowerCase();
  if (key.length === 0 || SIGN_SPEAKERS.has(key)) return "default";
  if (key === "fae") return "fae";
  if (FAMILY_SPEAKERS.has(key)) return "family";
  if (FRIEND_SPEAKERS.has(key)) return "friend";
  if (SCHOOL_SPEAKERS.has(key)) return "school";
  if (TOWN_SPEAKERS.has(key)) return "town";
  if (FAIRY_SPEAKERS.has(key) || key.includes("fairy")) return "fairy";
  if (MYSTERY_SPEAKERS.has(key)) return "mystery";
  if (CRITTER_KEYWORDS.some((word) => key.includes(word))) return "critter";
  return "default";
}

function characterSource(
  world: World,
  id: string,
  frame: string,
  cropMode: PortraitCropMode,
): PortraitSource | null {
  const character = world.characters[id];
  if (character === undefined) return null;
  return { atlas: character.atlas, frame, cropMode };
}

function partySource(
  world: World,
  id: string,
  frame: string,
  cropMode: PortraitCropMode,
): PortraitSource | null {
  const member = world.party[id];
  if (member === undefined) return null;
  return { atlas: member.atlas, frame, cropMode };
}

function critterSource(world: World, id: string): PortraitSource | null {
  const critter = world.critters[id];
  if (critter === undefined) return null;
  return { atlas: critter.atlas, frame: "calm_idle_01", cropMode: "critter" };
}

const CHARACTER_MAP: Record<string, readonly [string, PortraitCropMode]> = {
  mom: ["mom", "adult"],
  dad: ["dad", "adult"],
  oliver: ["oliver", "small"],
  sue: ["sue", "kid"],
  jordan: ["jordan", "kid"],
  milo: ["milo", "kid"],
  rosie: ["rosie", "kid"],
  toby: ["toby", "kid"],
  "hooded kid": ["hooded-kid", "kid"],
  "purple hood": ["hooded-kid", "kid"],
  "kid in purple": ["hooded-kid", "kid"],
  "chef bea": ["chef", "adult"],
  "grandpa barnaby": ["barnaby", "adult"],
  barnaby: ["barnaby", "adult"],
  bree: ["bree", "adult"],
  "ranger fern": ["fern", "adult"],
  fern: ["fern", "adult"],
  buster: ["buster", "adult"],
  "bay keeper": ["bay-keeper", "adult"],
  "pass keeper": ["pass-keeper", "adult"],
  "ms. clover": ["teacher", "adult"],
  "ms. maple": ["teacher", "adult"],
  teacher: ["teacher", "adult"],
  "nurse holly": ["nurse", "adult"],
  holly: ["nurse", "adult"],
  "coach ash": ["coach", "adult"],
  coach: ["coach", "adult"],
  "ms. reed": ["music-teacher", "adult"],
  "ms. willow": ["music-teacher", "adult"],
  "music teacher": ["music-teacher", "adult"],
};

const FAIRY_MAP: Record<string, string> = {
  lavender: "fairy-lavender",
  "lavender fairy": "fairy-lavender",
  mint: "fairy-mint",
  "mint fairy": "fairy-mint",
  sky: "fairy-sky",
  "sky fairy": "fairy-sky",
  peach: "fairy-peach",
  "peach fairy": "fairy-peach",
};

const CRITTER_PERSON_MAP: Record<string, string> = {
  "ms. rowan": "art-teacher",
  "art teacher": "art-teacher",
  "mr. bell": "principal",
  principal: "principal",
  "ms. coral": "lifeguard",
  lifeguard: "lifeguard",
  "mrs. flurry": "lodge-keeper",
  "lodge keeper": "lodge-keeper",
  "mr. pip": "arcade-keeper",
  "arcade keeper": "arcade-keeper",
  "chef mateo": "taco-chef",
  "fizzy chef mateo": "taco-chef",
};

export function speakerPortraitSource(
  world: World,
  speaker: string | null,
): PortraitSource | null {
  if (speaker === null) return null;
  const key = speaker.trim().toLowerCase();
  if (key.length === 0 || key === "mysterious voice" || key === "???" || SIGN_SPEAKERS.has(key)) {
    return null;
  }
  if (key === "fae") {
    return { atlas: "assets/characters/fae/fae.json", frame: "down_idle_01", cropMode: "kid" };
  }
  if (key === "maddie") {
    return partySource(world, "maddie", "down_idle_01", "critter");
  }
  const mappedChar = CHARACTER_MAP[key];
  if (mappedChar !== undefined) {
    const [id, cropMode] = mappedChar;
    return (
      characterSource(world, id, "down_idle_01", cropMode) ??
      partySource(world, id, "down_idle_01", cropMode)
    );
  }
  const fairyId = FAIRY_MAP[key];
  if (fairyId !== undefined) {
    return characterSource(world, fairyId, "idle_down_01", "small");
  }
  const critterPersonId = CRITTER_PERSON_MAP[key];
  if (critterPersonId !== undefined) {
    return critterSource(world, critterPersonId);
  }
  for (const critter of Object.values(world.critters)) {
    if (
      critter.calmName.toLowerCase() === key ||
      critter.name.toLowerCase() === key ||
      critter.sticker.name.toLowerCase() === key
    ) {
      return { atlas: critter.atlas, frame: "calm_idle_01", cropMode: "critter" };
    }
  }
  return null;
}

function clampRect(
  frame: AtlasFrame,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
): AtlasFrame {
  const w = Math.max(1, Math.min(frame.w, Math.round(width)));
  const h = Math.max(1, Math.min(frame.h, Math.round(height)));
  const x = Math.max(frame.x, Math.min(frame.x + frame.w - w, Math.round(frame.x + offsetX)));
  const y = Math.max(frame.y, Math.min(frame.y + frame.h - h, Math.round(frame.y + offsetY)));
  return { x, y, w, h };
}

export function cropPortraitFrame(frame: AtlasFrame, mode: PortraitCropMode): AtlasFrame {
  if (mode === "kid") {
    if (frame.w >= 440) {
      return clampRect(frame, frame.w * 0.31, frame.h * 0.33, frame.w * 0.38, frame.h * 0.38);
    }
    return clampRect(frame, frame.w * 0.29, frame.h * 0.21, frame.w * 0.42, frame.h * 0.42);
  }
  if (mode === "adult") {
    return clampRect(frame, frame.w * 0.3, frame.h * 0.2, frame.w * 0.4, frame.h * 0.4);
  }
  if (mode === "small") {
    return clampRect(frame, frame.w * 0.26, frame.h * 0.45, frame.w * 0.48, frame.h * 0.48);
  }
  if (frame.w <= 280) {
    return clampRect(frame, frame.w * 0.26, frame.h * 0.45, frame.w * 0.48, frame.h * 0.48);
  }
  return clampRect(frame, frame.w * 0.14, frame.h * 0.14, frame.w * 0.72, frame.h * 0.72);
}
