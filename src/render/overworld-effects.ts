import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  effectiveAreaNpcs,
  npcLivePoint,
  npcVisible,
  presentCritters,
  type Area,
  type NpcEmoteKind,
  type NpcLifeSnapshot,
  type Point,
  type State,
  type World,
} from "../core";
import { interpolatePoint } from "./camera";
import {
  CLUBHOUSE_PRIZES_ALIAS,
  ClubhouseDisplayRenderer,
} from "./clubhouse-display-render";
import type { RestSpot } from "./companions";
import { evaluateOverworldEmotes } from "./emotes";
import {
  classifyFootstepEffect,
  computeGrassTuftSway,
  FOOTSTEP_POOL_SIZE,
  FOOTSTEP_VFX_STYLES,
  GRASS_TUFT_POOL_SIZE,
  GroundReactivityController,
  isNearWaterShore,
  sampleNearbyGrassTufts,
  type FootstepVfxKind,
  type FootstepVfxStyle,
  type GrassMover,
  type GrassSwayResult,
  type GrassTuftPlacement,
} from "./ground-reactivity";
import {
  computeCompanionEmoteSpecs,
  computeLanternMote,
  computeNpcOverworldHeight,
  computeOverworldEmoteInputs,
  evaluateStarGemGlints,
  LANTERN_MOTE_COUNT,
  LANTERN_MOTE_TINTS,
} from "./overworld-render";
import { storyTimeOfDay } from "./time-of-day";
import type { VfxTextures } from "./vfx-textures";

export {
  classifyFootstepEffect,
  CLUBHOUSE_PRIZES_ALIAS,
  ClubhouseDisplayRenderer,
  computeGrassTuftSway,
  FOOTSTEP_POOL_SIZE,
  FOOTSTEP_VFX_STYLES,
  GRASS_TUFT_POOL_SIZE,
  isNearWaterShore,
  sampleNearbyGrassTufts,
  type FootstepVfxKind,
  type FootstepVfxStyle,
  type GrassMover,
  type GrassSwayResult,
  type GrassTuftPlacement,
};

const EMOTE_POOL_SIZE = 24;

type EmoteSpriteItem = {
  texture: Texture;
  x: number;
  y: number;
  scale: number;
  alpha: number;
  rotation: number;
  tint: number;
  blend: "normal" | "add";
};

export type ViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Owns pooled overworld visual effects: living ground reactivity (delegated to
 * `GroundReactivityController`), Clubhouse & Bedroom displays (delegated to
 * `ClubhouseDisplayRenderer`), blacklight lantern motes, prismatic Star Gem
 * glints, overworld emotes, and time-of-day grading.
 */
export class OverworldEffectsController {
  readonly grassLayer: Container;
  readonly footstepLayer: Container;
  readonly clubhouseRugLayer: Container;
  readonly clubhouseBannerLayer: Container;
  readonly lanternMoteLayer = new Container();
  readonly emoteLayer = new Container();
  readonly timeOfDayLayer = new Container();

  private readonly ground: GroundReactivityController;
  private readonly clubhouseDisplay: ClubhouseDisplayRenderer;
  private readonly lanternMotes: Sprite[] = [];

  private readonly starGemLayer = new Container();
  private readonly starGemPool: { halo: Sprite; star: Sprite }[] = [];
  private activeStarGemGlints = 0;

  private readonly emoteSprites: Sprite[] = [];
  private activeDialoguePartner: {
    npcId: string | null;
    x: number;
    y: number;
    height: number;
  } | null = null;
  private recentTalk: {
    npcId: string | null;
    x: number;
    y: number;
    height: number;
    startTick: number;
  } | null = null;
  private lastEmoteArea = "";
  private lastEmoteTick: number | undefined;

  private readonly timeOfDayTint = new Graphics();
  private readonly timeOfDaySun: Sprite;
  private timeOfDayCachedKey = "";

  constructor(
    private readonly world: World,
    private readonly vfx: VfxTextures,
    depthLayer: Container,
    emissiveLayer: Container,
  ) {
    this.ground = new GroundReactivityController(this.world, this.vfx);
    this.grassLayer = this.ground.grassLayer;
    this.footstepLayer = this.ground.footstepLayer;

    this.clubhouseDisplay = new ClubhouseDisplayRenderer(this.world, this.vfx, depthLayer);
    this.clubhouseRugLayer = this.clubhouseDisplay.rugLayer;
    this.clubhouseBannerLayer = this.clubhouseDisplay.bannerLayer;

    this.lanternMoteLayer.label = "lantern:motes";
    for (let i = 0; i < LANTERN_MOTE_COUNT; i += 1) {
      const mote = new Sprite(this.vfx.sparkle);
      mote.label = `lantern:mote:${i}`;
      mote.anchor.set(0.5);
      mote.blendMode = "add";
      mote.tint = LANTERN_MOTE_TINTS[i % LANTERN_MOTE_TINTS.length] ?? 0xd4b0ff;
      this.lanternMotes.push(mote);
      this.lanternMoteLayer.addChild(mote);
    }

    this.starGemLayer.label = "star-gems";
    emissiveLayer.addChild(this.starGemLayer);

    this.emoteLayer.label = "emotes";
    for (let i = 0; i < EMOTE_POOL_SIZE; i += 1) {
      const bubble = new Sprite(this.vfx.emoteQuestion);
      bubble.label = `emote:${i}`;
      bubble.anchor.set(0.5);
      bubble.visible = false;
      this.emoteSprites.push(bubble);
      this.emoteLayer.addChild(bubble);
    }

    this.timeOfDaySun = new Sprite(this.vfx.softGlow);
    this.timeOfDaySun.label = "time-of-day:sun";
    this.timeOfDaySun.anchor.set(0.5);
    this.timeOfDaySun.blendMode = "add";
    this.timeOfDayLayer.label = "time-of-day";
    this.timeOfDayLayer.visible = false;
    this.timeOfDayLayer.addChild(this.timeOfDayTint, this.timeOfDaySun);
  }

  get footstepPuffCount(): number {
    return this.ground.footstepPuffCount;
  }

  get lastFootstepKind(): FootstepVfxKind | null {
    return this.ground.lastFootstepKind;
  }

  get grassTuftCount(): number {
    return this.ground.grassTuftCount;
  }

  get starGemGlintCount(): number {
    return this.activeStarGemGlints;
  }

  get clubhouseDisplayCount(): number {
    return this.clubhouseDisplay.displayCount;
  }

  clearFootsteps(): void {
    this.ground.clearFootsteps();
  }

  clearGrassTufts(): void {
    this.ground.clearGrassTufts();
  }

  clearStarGemGlints(): void {
    for (const entry of this.starGemPool) {
      entry.halo.visible = false;
      entry.star.visible = false;
    }
    this.activeStarGemGlints = 0;
  }

  clearEmotes(): void {
    this.activeDialoguePartner = null;
    this.recentTalk = null;
    this.lastEmoteTick = undefined;
    for (const sprite of this.emoteSprites) sprite.visible = false;
  }

  hideClubhouseDisplay(): void {
    this.clubhouseDisplay.hide();
  }

  invalidateTimeOfDay(): void {
    this.timeOfDayCachedKey = "";
  }

  updateFootsteps(
    state: State,
    areaId: string,
    playerPos: Point,
    reducedMotion: boolean,
  ): void {
    this.ground.updateFootsteps(state, areaId, playerPos, reducedMotion);
  }

  updateGrassTufts(
    state: State,
    area: Area,
    playerPos: Point,
    reducedMotion: boolean,
    paused: boolean,
  ): void {
    this.ground.updateGrassTufts(state, area, playerPos, reducedMotion, paused);
  }

  updateLanternMotes(
    centerX: number,
    centerY: number,
    tick: number,
    blend: number,
    reducedMotion = false,
  ): void {
    for (let i = 0; i < this.lanternMotes.length; i += 1) {
      const mote = this.lanternMotes[i];
      if (mote === undefined) continue;
      const spec = computeLanternMote(
        i, this.lanternMotes.length, centerX, centerY, tick, blend, reducedMotion,
      );
      mote.position.set(spec.x, spec.y);
      mote.scale.set(spec.scale);
      mote.alpha = spec.alpha;
    }
  }

  updateStarGemGlints(state: State, reducedMotion: boolean): void {
    const glints = evaluateStarGemGlints(this.world, state, reducedMotion);
    for (let i = 0; i < glints.length; i += 1) {
      const glint = glints[i];
      if (glint === undefined) continue;
      let entry = this.starGemPool[i];
      if (entry === undefined) {
        const halo = new Sprite(this.vfx.softGlow);
        halo.label = `stargem:halo:${i}`;
        halo.anchor.set(0.5);
        halo.blendMode = "add";
        const star = new Sprite(this.vfx.starGemCharm);
        star.label = `stargem:star:${i}`;
        star.anchor.set(0.5);
        star.blendMode = "normal";
        star.tint = 0xffffff;
        this.starGemLayer.addChild(halo, star);
        entry = { halo, star };
        this.starGemPool.push(entry);
      }
      entry.halo.visible = true;
      entry.halo.position.set(glint.x, glint.y);
      entry.halo.width = glint.haloSize;
      entry.halo.height = glint.haloSize;
      entry.halo.alpha = glint.haloAlpha;
      entry.halo.tint = glint.haloTint;

      entry.star.visible = true;
      entry.star.position.set(glint.x, glint.y);
      entry.star.scale.set(glint.starScale * 1.15);
      entry.star.alpha = glint.starAlpha;
      entry.star.rotation = glint.starRotation;
      entry.star.tint = 0xffffff;
    }
    for (let i = glints.length; i < this.starGemPool.length; i += 1) {
      const entry = this.starGemPool[i];
      if (entry !== undefined) {
        entry.halo.visible = false;
        entry.star.visible = false;
      }
    }
    this.activeStarGemGlints = glints.length;
  }

  renderClubhouseDisplay(state: State, area: Area, reducedMotion: boolean): void {
    this.clubhouseDisplay.render(state, area, reducedMotion);
  }

  renderEmotes(
    state: State,
    area: Area,
    playerPos: Point,
    previousState: State | undefined,
    alpha: number,
    activePet: { id: string; elapsed: number } | null,
    activeRest: { spot: RestSpot; elapsed: number } | null,
    npcLife: NpcLifeSnapshot,
    reducedMotion = false,
  ): void {
    const active =
      area.id !== "harness" &&
      state.battle === null &&
      state.arcade === null;
    if (!active) {
      this.emoteLayer.visible = false;
      for (const sprite of this.emoteSprites) sprite.visible = false;
      if (
        area.id !== this.lastEmoteArea ||
        (this.lastEmoteTick !== undefined && state.tick < this.lastEmoteTick) ||
        state.battle !== null ||
        state.arcade !== null
      ) {
        this.activeDialoguePartner = null;
        this.recentTalk = null;
      }
      this.lastEmoteArea = area.id;
      this.lastEmoteTick = state.tick;
      return;
    }

    if (
      area.id !== this.lastEmoteArea ||
      (this.lastEmoteTick !== undefined && state.tick < this.lastEmoteTick)
    ) {
      this.activeDialoguePartner = null;
      this.recentTalk = null;
    }

    const present = presentCritters(this.world, state);
    if (state.dialogue !== null) {
      const knot = state.dialogue.knot;
      const npc = effectiveAreaNpcs(this.world, state, area).find(
        (item) =>
          item.id !== "bus-stop" &&
          npcVisible(this.world, state, item) &&
          item.knot === knot,
      );
      if (npc !== undefined) {
        const critter =
          npc.visibleWhenCalmed === undefined
            ? undefined
            : this.world.critters[npc.visibleWhenCalmed];
        const profile = this.world.npcProfiles[npc.id];
        const height =
          critter !== undefined
            ? critter.overworldHeight
            : npc.id === "oliver" || npc.id.startsWith("fairy-")
              ? 84
              : profile !== undefined
                ? profile.adult
                  ? 174
                  : 146
                : computeNpcOverworldHeight(npc, critter);
        const live =
          reducedMotion && npc.stroll !== undefined
            ? npc.point
            : npcLivePoint(state, npc);
        this.activeDialoguePartner = { npcId: npc.id, x: live.x, y: live.y, height };
      } else {
        const calm = present
          .filter((item) => item.mood === "calm" && item.kind.calmKnot === knot)
          .sort(
            (a, b) =>
              (a.point.x - state.player.x) ** 2 +
              (a.point.y - state.player.y) ** 2 -
              ((b.point.x - state.player.x) ** 2 + (b.point.y - state.player.y) ** 2),
          )[0];
        if (calm !== undefined) {
          this.activeDialoguePartner = {
            npcId: null,
            x: calm.point.x,
            y: calm.point.y,
            height: calm.kind.overworldHeight,
          };
        }
      }
    } else if (this.activeDialoguePartner !== null) {
      this.recentTalk = { ...this.activeDialoguePartner, startTick: state.tick };
      this.activeDialoguePartner = null;
    }

    let recentTalk: { x: number; y: number; height: number; elapsed: number } | null = null;
    let recentTalkNpcId: string | null = null;
    if (this.recentTalk !== null) {
      const elapsed = state.tick - this.recentTalk.startTick;
      if (elapsed >= 0 && elapsed < 38) {
        recentTalk = {
          x: this.recentTalk.x,
          y: this.recentTalk.y,
          height: this.recentTalk.height,
          elapsed,
        };
        recentTalkNpcId = this.recentTalk.npcId;
      } else {
        this.recentTalk = null;
      }
    }

    const { roamers, calmedCritters, nappingMembers } = computeOverworldEmoteInputs(
      this.world,
      state,
      present,
      previousState,
      alpha,
    );

    const activeChatterNpcId =
      npcLife.chatter !== null && npcLife.chatter.alpha > 0.01
        ? npcLife.chatter.npcId
        : null;
    const npcEmotes: {
      id: string;
      x: number;
      y: number;
      height: number;
      kind: NpcEmoteKind;
      index: number;
    }[] = [];
    npcLife.npcs.forEach((entry, index) => {
      if (entry.emote === null) return;
      if (entry.id === activeChatterNpcId || entry.id === recentTalkNpcId) return;
      const height =
        entry.id === "oliver" || entry.id.startsWith("fairy-")
          ? 84
          : entry.adult
            ? 174
            : 146;
      const npcObj =
        !reducedMotion && previousState !== undefined && alpha < 1
          ? area.npcs.find((item) => item.id === entry.id && item.stroll !== undefined)
          : undefined;
      const pos =
        npcObj !== undefined && previousState !== undefined
          ? interpolatePoint(npcLivePoint(previousState, npcObj), entry, alpha)
          : { x: entry.x, y: entry.y };
      npcEmotes.push({
        id: entry.id,
        x: pos.x,
        y: pos.y,
        height,
        kind: entry.emote,
        index,
      });
    });
    const maddieNapping = nappingMembers.some((member) => member.stillTicks >= 240);
    npcLife.party.forEach((entry, index) => {
      if (entry.emote === null || entry.id === activeChatterNpcId) return;
      if (entry.id === "maddie" && maddieNapping) return;
      const showPartyEmote =
        entry.attention === "party-chat" ||
        npcLife.activeToolEventId !== null;
      if (!showPartyEmote) return;
      const content = this.world.party[entry.id];
      if (content === undefined) return;
      const member = state.party.find((item) => item.id === entry.id);
      const prevMember = previousState?.party.find((item) => item.id === entry.id);
      const pos =
        member !== undefined && prevMember !== undefined && alpha < 1
          ? interpolatePoint(prevMember, member, alpha)
          : member ?? { x: entry.x, y: entry.y };
      npcEmotes.push({
        id: entry.id,
        x: pos.x,
        y: pos.y,
        height: content.box.height,
        kind: entry.emote,
        index: npcLife.npcs.length + index,
      });
    });

    const emotes = evaluateOverworldEmotes({
      areaId: area.id,
      tick: state.tick,
      player: playerPos,
      dialogueOpen: state.dialogue !== null || state.transition !== null || state.journalOpen,
      roamers,
      calmedCritters,
      nappingMembers,
      recentTalk,
      npcEmotes,
      reducedMotion,
    });

    const items: EmoteSpriteItem[] = emotes.map((emote) => ({
      texture: this.vfx[emote.texture],
      x: emote.x,
      y: emote.y,
      scale: emote.scale,
      alpha: emote.alpha,
      rotation: emote.rotation,
      tint: 0xffffff,
      blend: "normal",
    }));

    let petPos: Point | null = null;
    let petHeight = 0;
    if (activePet !== null) {
      const member = state.party.find((entry) => entry.id === activePet.id);
      const content = this.world.party[activePet.id];
      if (member !== undefined && content !== undefined) {
        const prevMember = previousState?.party.find((entry) => entry.id === activePet.id);
        petPos =
          prevMember !== undefined && alpha < 1
            ? interpolatePoint(prevMember, member, alpha)
            : member;
        petHeight = content.box.height;
      }
    }
    for (const spec of computeCompanionEmoteSpecs(
      petPos,
      petHeight,
      activePet?.elapsed ?? null,
      playerPos,
      activeRest?.elapsed ?? null,
      reducedMotion,
    )) {
      items.push({
        texture: this.vfx[spec.textureKey],
        x: spec.x,
        y: spec.y,
        scale: spec.scale,
        alpha: spec.alpha,
        rotation: spec.rotation,
        tint: spec.tint,
        blend: spec.blend,
      });
    }

    this.emoteLayer.visible = items.length > 0;
    for (let i = 0; i < this.emoteSprites.length; i += 1) {
      const sprite = this.emoteSprites[i];
      if (sprite === undefined) continue;
      const item = items[i];
      if (item === undefined || item.alpha <= 0.01) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      sprite.texture = item.texture;
      sprite.position.set(item.x, item.y);
      sprite.scale.set(item.scale);
      sprite.alpha = item.alpha;
      sprite.rotation = item.rotation;
      sprite.tint = item.tint;
      sprite.blendMode = item.blend;
    }
    this.lastEmoteArea = area.id;
    this.lastEmoteTick = state.tick;
  }

  renderTimeOfDay(state: State, viewportRect: ViewportRect): void {
    const grade = storyTimeOfDay(this.world, state);
    const show = grade.alpha > 0 || grade.sunAlpha > 0;
    this.timeOfDayLayer.visible = show;
    if (!show) return;
    const { x, y, width, height } = viewportRect;
    const key = `${x}|${y}|${width}|${height}|${grade.tint}`;
    if (this.timeOfDayCachedKey !== key) {
      this.timeOfDayCachedKey = key;
      this.timeOfDayTint.clear().rect(x, y, width, height).fill(grade.tint);
    }
    this.timeOfDayTint.alpha = grade.alpha;
    this.timeOfDaySun.tint = grade.sunTint;
    this.timeOfDaySun.alpha = grade.sunAlpha;
    this.timeOfDaySun.position.set(x + width * 0.16, y + height * 0.12);
    this.timeOfDaySun.width = width * 0.95;
    this.timeOfDaySun.height = height * 0.85;
    this.timeOfDaySun.rotation = -0.22;
  }
}
