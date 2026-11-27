import { Container, Sprite } from "pixi.js";
import {
  evaluateNpcLife,
  npcFacing,
  npcVisible,
  type Direction,
  type Npc,
  type NpcAttention,
  type NpcEmoteKind,
  type NpcLifeEntry,
  type NpcLifeSnapshot,
  type NpcStoryStage,
  type State,
  type World,
} from "../core";
import type { VfxTextures } from "./vfx-textures";

type NpcReactionPuff = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornTick: number;
  tint: number;
  kind: "sparkle" | "heart";
};

export type NpcLifeRenderInfo = {
  stage: NpcStoryStage;
  npcs: {
    id: string;
    attention: NpcAttention;
    facing: Direction;
    emote: NpcEmoteKind | null;
  }[];
  chatter: {
    npcId: string;
    speakerName: string;
    text: string;
    tone: string;
  } | null;
};

const NPC_REACTION_POOL_SIZE = 18;
const NPC_REACTION_DURATION = 24;

export function isAdultNpc(world: World, npcId: string): boolean {
  if (npcId === "oliver" || npcId === "bus-stop" || npcId.startsWith("fairy-")) return false;
  const profile = world.npcProfiles[npcId];
  if (profile !== undefined) return profile.adult;
  const character = world.characters[npcId];
  return character !== undefined && (character.scale === undefined || character.scale >= 0.49);
}

/**
 * Owns per-area NPC life memory, attention/facing transitions, and pooled
 * sparkle/heart reaction bursts without bloating GameView or OverworldEntityLayer.
 */
export class NpcLifeController {
  readonly reactionLayer = new Container();

  private readonly reactionSprites: Sprite[] = [];
  private readonly reactionPuffs: NpcReactionPuff[] = [];
  private areaId = "";
  private areaStartTick = 0;
  private lastTick: number | undefined;
  private lastCalmedTick: number | null = null;
  private lastCalmedCount = 0;
  private lastTalkNpcId: string | null = null;
  private lastTalkTick: number | null = null;
  private activeTalkNpcId: string | null = null;
  private lastFluteTick: number | null = null;
  private fluteDialogueActive = false;
  private lanternOnTick: number | null = null;
  private prevLanternOn = false;
  private readonly attentionState = new Map<
    string,
    { attention: NpcAttention; sinceTick: number }
  >();
  private readonly facingState = new Map<
    string,
    { facing: Direction; sinceTick: number }
  >();
  private latestSnapshot: NpcLifeSnapshot | null = null;

  constructor(
    private readonly world: World,
    private readonly vfx: VfxTextures,
  ) {
    this.reactionLayer.label = "npc:reactions";
    for (let i = 0; i < NPC_REACTION_POOL_SIZE; i += 1) {
      const puff = new Sprite(this.vfx.sparkle);
      puff.label = `npc:reaction:${i}`;
      puff.anchor.set(0.5);
      puff.visible = false;
      this.reactionSprites.push(puff);
      this.reactionLayer.addChild(puff);
    }
  }

  get latest(): NpcLifeSnapshot | null {
    return this.latestSnapshot;
  }

  areaTicks(tick: number): number {
    return Math.max(0, tick - this.areaStartTick);
  }

  clearReactions(): void {
    this.reactionPuffs.length = 0;
    for (const sprite of this.reactionSprites) sprite.visible = false;
  }

  clear(): void {
    this.areaId = "";
    this.areaStartTick = 0;
    this.lastTick = undefined;
    this.lastCalmedTick = null;
    this.lastCalmedCount = 0;
    this.lastTalkNpcId = null;
    this.lastTalkTick = null;
    this.activeTalkNpcId = null;
    this.lastFluteTick = null;
    this.fluteDialogueActive = false;
    this.lanternOnTick = null;
    this.prevLanternOn = false;
    this.attentionState.clear();
    this.facingState.clear();
    this.clearReactions();
    this.latestSnapshot = null;
  }

  private totalCalms(state: State): number {
    let count = 0;
    for (const mood of Object.values(state.critters)) {
      if (mood === "calm") count += 1;
    }
    for (const wild of state.wild) {
      if (wild.mood === "calm") count += 1;
    }
    return count;
  }

  observeTick(state: State): void {
    const area = this.world.areas[state.area];
    if (area === undefined) return;
    if (this.lastTick === state.tick && this.areaId === area.id) return;
    const calmCount = this.totalCalms(state);
    if (
      area.id !== this.areaId ||
      this.lastTick === undefined ||
      state.tick < this.lastTick
    ) {
      this.areaId = area.id;
      this.areaStartTick = state.tick;
      this.attentionState.clear();
      this.facingState.clear();
      this.lastCalmedTick = null;
      this.lastCalmedCount = calmCount;
      this.activeTalkNpcId = null;
      this.lastTalkNpcId = null;
      this.lastTalkTick = null;
      this.lastFluteTick = null;
      this.fluteDialogueActive = false;
      this.lanternOnTick = null;
      this.prevLanternOn = state.lantern;
      this.clearReactions();
    } else if (calmCount > this.lastCalmedCount) {
      this.lastCalmedTick = state.tick;
      this.lastCalmedCount = calmCount;
    } else {
      this.lastCalmedCount = calmCount;
    }

    if (state.lantern && !this.prevLanternOn) {
      this.lanternOnTick = state.tick;
    } else if (!state.lantern) {
      this.lanternOnTick = null;
    }
    this.prevLanternOn = state.lantern;

    const isFluteDialogue =
      state.dialogue !== null &&
      (state.dialogue.knot === "flute" || state.dialogue.sound === "flute");
    if (isFluteDialogue) {
      this.fluteDialogueActive = true;
      this.lastFluteTick = state.tick;
    } else if (this.fluteDialogueActive) {
      this.lastFluteTick = state.tick;
      this.fluteDialogueActive = false;
    }

    if (state.dialogue !== null) {
      const knot = state.dialogue.knot;
      const talkingNpc = area.npcs.find(
        (item) =>
          item.id !== "bus-stop" &&
          !item.id.startsWith("sanctuary-") &&
          item.knot === knot &&
          npcVisible(this.world, state, item),
      );
      if (talkingNpc !== undefined) this.activeTalkNpcId = talkingNpc.id;
    } else if (this.activeTalkNpcId !== null) {
      this.lastTalkNpcId = this.activeTalkNpcId;
      this.lastTalkTick = state.tick;
      this.activeTalkNpcId = null;
    }

    this.lastTick = state.tick;
  }

  update(state: State): NpcLifeSnapshot {
    this.observeTick(state);
    const life = evaluateNpcLife(this.world, state, {
      areaTicks: this.areaTicks(state.tick),
      lastCalmedTick: this.lastCalmedTick,
      lastTalkNpcId: this.lastTalkNpcId,
      lastTalkTick: this.lastTalkTick,
      lastFluteTick: this.lastFluteTick,
      lanternOnTick: this.lanternOnTick,
    });
    this.latestSnapshot = life;
    return life;
  }

  stepPresentation(
    npc: Npc,
    entry: NpcLifeEntry | undefined,
    state: State,
    livingMotion: boolean,
  ): { facing: Direction; attentionAge: number; turnAge: number; areaTicks: number } {
    const facing = entry?.facing ?? npcFacing(state, npc);
    const attention: NpcAttention = entry?.attention ?? "idle";
    const areaTicks = this.areaTicks(state.tick);
    const prevAttention = this.attentionState.get(npc.id);
    if (prevAttention === undefined || prevAttention.attention !== attention) {
      this.attentionState.set(npc.id, { attention, sinceTick: state.tick });
      if (
        state.area !== "harness" &&
        livingMotion &&
        (areaTicks >= 48 ||
          state.lantern ||
          attention === "music-delight" ||
          attention === "celebrate") &&
        (attention === "lantern-awe" ||
          attention === "celebrate" ||
          attention === "music-delight" ||
          attention === "companion-greet")
      ) {
        this.spawnReactionBurst(
          npc.point.x,
          npc.point.y - (entry?.adult ? 116 : 96),
          attention,
          state.tick,
        );
      }
    }
    const prevFacing = this.facingState.get(npc.id);
    if (prevFacing === undefined) {
      this.facingState.set(npc.id, { facing, sinceTick: state.tick - 99 });
    } else if (prevFacing.facing !== facing) {
      this.facingState.set(npc.id, { facing, sinceTick: state.tick });
    }
    const facingSince = this.facingState.get(npc.id)?.sinceTick ?? state.tick - 99;
    const turnAge = Math.max(0, state.tick - facingSince);
    const sinceTick = this.attentionState.get(npc.id)?.sinceTick ?? state.tick;
    const attentionAge = Math.max(0, state.tick - sinceTick);
    return { facing, attentionAge, turnAge, areaTicks };
  }

  private spawnReactionBurst(
    x: number,
    y: number,
    attention: "lantern-awe" | "celebrate" | "music-delight" | "companion-greet",
    tick: number,
  ): void {
    const tints: readonly [number, number, number] =
      attention === "lantern-awe"
        ? [0xd8b8ff, 0xfff0a8, 0xc9a8ff]
        : attention === "celebrate"
          ? [0xffd479, 0xf59ab4, 0xfff0a8]
          : attention === "music-delight"
            ? [0x8be2b5, 0xfff1a8, 0xb8f0d0]
            : [0xf59ab4, 0xffd0de, 0xf7b2c6];
    const offsets: readonly [number, number, number, number][] = [
      [-16, -4, -0.35, -0.65],
      [0, -12, 0, -0.85],
      [16, -2, 0.35, -0.6],
    ];
    for (let i = 0; i < offsets.length; i += 1) {
      const [ox, oy, vx, vy] = offsets[i] ?? [0, 0, 0, -0.7];
      const tint = tints[i] ?? 0xfff0a8;
      const kind: "sparkle" | "heart" =
        attention === "companion-greet" || (attention === "celebrate" && i === 1)
          ? "heart"
          : "sparkle";
      if (this.reactionPuffs.length >= NPC_REACTION_POOL_SIZE) {
        this.reactionPuffs.shift();
      }
      this.reactionPuffs.push({
        x: x + ox,
        y: y + oy,
        vx,
        vy,
        bornTick: tick,
        tint,
        kind,
      });
    }
  }

  renderReactions(state: State, livingMotion: boolean): void {
    if (
      state.area === "harness" ||
      state.battle !== null ||
      state.arcade !== null ||
      !livingMotion
    ) {
      for (const sprite of this.reactionSprites) sprite.visible = false;
      return;
    }
    let write = 0;
    for (let i = 0; i < this.reactionPuffs.length; i += 1) {
      const puff = this.reactionPuffs[i];
      if (puff === undefined) continue;
      const age = state.tick - puff.bornTick;
      if (age < 0 || age >= NPC_REACTION_DURATION) continue;
      this.reactionPuffs[write] = puff;
      write += 1;
    }
    this.reactionPuffs.length = write;

    for (let i = 0; i < this.reactionSprites.length; i += 1) {
      const sprite = this.reactionSprites[i];
      if (sprite === undefined) continue;
      const puff = this.reactionPuffs[i];
      if (puff === undefined) {
        sprite.visible = false;
        continue;
      }
      const age = state.tick - puff.bornTick;
      const progress = age / NPC_REACTION_DURATION;
      const env = Math.sin(progress * Math.PI);
      sprite.visible = true;
      sprite.texture = puff.kind === "heart" ? this.vfx.heart : this.vfx.sparkle;
      sprite.tint = puff.tint;
      sprite.position.set(puff.x + puff.vx * age, puff.y + puff.vy * age);
      sprite.scale.set(0.24 + env * 0.14);
      sprite.alpha = env * 0.85;
      sprite.rotation = puff.vx * age * 0.04;
    }
  }

  renderInfo(): NpcLifeRenderInfo {
    const snap = this.latestSnapshot;
    return {
      stage: snap?.situation.storyStage ?? "morning",
      npcs: (snap?.npcs ?? []).map((entry) => ({
        id: entry.id,
        attention: entry.attention,
        facing: entry.facing,
        emote: entry.emote,
      })),
      chatter:
        snap?.chatter === null || snap?.chatter === undefined
          ? null
          : {
              npcId: snap.chatter.npcId,
              speakerName: snap.chatter.speakerName,
              text: snap.chatter.text,
              tone: snap.chatter.tone,
            },
    };
  }
}
