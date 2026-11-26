import type { Point } from "../core";

export type EmoteTextureKey =
  | "emoteQuestion"
  | "emoteExclaim"
  | "emoteNote"
  | "emoteZzz"
  | "emoteHeart";

export type OverworldEmote = {
  texture: EmoteTextureKey;
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rotation: number;
};

export type OverworldEmoteInput = {
  areaId: string;
  tick: number;
  player: Point;
  dialogueOpen: boolean;
  roamers: readonly {
    x: number;
    y: number;
    height: number;
    notice: number;
    noticeTicks: number;
    chasing: boolean;
  }[];
  calmedCritters: readonly {
    x: number;
    y: number;
    height: number;
    index: number;
  }[];
  nappingMembers: readonly {
    x: number;
    y: number;
    height: number;
    stillTicks: number;
    index: number;
  }[];
  recentTalk?: {
    x: number;
    y: number;
    height: number;
    elapsed: number;
  } | null;
};

const CALMED_HUM_RANGE = 185;
const NAP_STILL_TICKS = 240;
const EXCLAIM_WINDOW_TICKS = 30;
const RECENT_TALK_TICKS = 38;

export function evaluateOverworldEmotes(input: OverworldEmoteInput): OverworldEmote[] {
  if (input.areaId === "harness" || input.dialogueOpen) return [];
  const emotes: OverworldEmote[] = [];

  for (const roamer of input.roamers) {
    if (roamer.notice > 0 && roamer.notice < roamer.noticeTicks) {
      const pop = Math.min(1, roamer.notice / 8);
      const ease = pop * (2 - pop);
      const bob = Math.sin(input.tick / 9) * 2.5;
      emotes.push({
        texture: "emoteQuestion",
        x: roamer.x,
        y: roamer.y - roamer.height - 18 + bob,
        scale: 0.52 + 0.36 * ease,
        alpha: 0.94 * ease,
        rotation: 0.08 * Math.sin(input.tick / 10),
      });
    } else if (
      roamer.chasing &&
      roamer.notice >= roamer.noticeTicks &&
      roamer.notice < roamer.noticeTicks + EXCLAIM_WINDOW_TICKS
    ) {
      const elapsed = roamer.notice - roamer.noticeTicks;
      const scale = elapsed < 5
        ? 0.5 + (elapsed / 5) * 0.62
        : elapsed < 11
          ? 1.12 - ((elapsed - 5) / 6) * 0.17
          : 0.95;
      const fadeOut = elapsed > EXCLAIM_WINDOW_TICKS - 7
        ? (EXCLAIM_WINDOW_TICKS - elapsed) / 7
        : 1;
      const bounce = elapsed < 10 ? -Math.sin((elapsed / 10) * Math.PI) * 5 : 0;
      emotes.push({
        texture: "emoteExclaim",
        x: roamer.x,
        y: roamer.y - roamer.height - 20 + bounce,
        scale,
        alpha: Math.max(0, Math.min(1, fadeOut)),
        rotation: elapsed < 10 ? Math.sin(elapsed * 0.9) * 0.09 : 0,
      });
    }
  }

  for (const critter of input.calmedCritters) {
    const distance = Math.hypot(critter.x - input.player.x, critter.y - input.player.y);
    if (distance > CALMED_HUM_RANGE) continue;
    const cycle = (((input.tick + critter.index * 29) % 90) + 90) % 90 / 90;
    const envelope = Math.sin(cycle * Math.PI);
    emotes.push({
      texture: "emoteNote",
      x: critter.x + Math.sin(cycle * Math.PI * 2) * 5,
      y: critter.y - critter.height - 14 - cycle * 18,
      scale: 0.56 + 0.16 * envelope,
      alpha: 0.9 * envelope,
      rotation: Math.sin(cycle * Math.PI * 2) * 0.14,
    });
  }

  for (const member of input.nappingMembers) {
    if (member.stillTicks < NAP_STILL_TICKS) continue;
    const cycle = (((input.tick + member.index * 37) % 100) + 100) % 100 / 100;
    const envelope = Math.sin(cycle * Math.PI);
    emotes.push({
      texture: "emoteZzz",
      x: member.x + 10 + Math.sin(cycle * Math.PI * 2) * 6,
      y: member.y - member.height - 8 - cycle * 22,
      scale: 0.5 + 0.24 * cycle,
      alpha: 0.88 * envelope,
      rotation: -0.1 + 0.2 * cycle,
    });
  }

  const talk = input.recentTalk;
  if (
    talk !== null &&
    talk !== undefined &&
    talk.elapsed >= 0 &&
    talk.elapsed < RECENT_TALK_TICKS
  ) {
    const progress = talk.elapsed / RECENT_TALK_TICKS;
    const fadeIn = Math.min(1, (talk.elapsed + 1) / 6);
    const fadeOut = Math.min(1, (RECENT_TALK_TICKS - talk.elapsed) / 12);
    const pop = talk.elapsed < 8
      ? 0.56 + (talk.elapsed / 8) * 0.36
      : 0.92 - progress * 0.12;
    emotes.push({
      texture: "emoteHeart",
      x: talk.x + Math.sin(progress * Math.PI * 2) * 4,
      y: talk.y - talk.height - 14 - talk.elapsed * 0.55,
      scale: pop * 0.8,
      alpha: 0.95 * fadeIn * fadeOut,
      rotation: Math.sin(progress * Math.PI * 2) * 0.1,
    });
  }

  return emotes;
}
