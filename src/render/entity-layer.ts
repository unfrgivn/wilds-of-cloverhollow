import { Assets, Container, Sprite, Spritesheet, Texture } from "pixi.js";
import {
  cutsceneView,
  hiddenFraction,
  npcFacing,
  npcLivePoint,
  npcVisible,
  partyLeader,
  presentCritters,
  type Area,
  type Direction,
  type NpcLifeSnapshot,
  type PartyLifeEntry,
  type Point,
  type State,
  type World,
} from "../core";
import { ambientFor, type AmbientFlyer } from "../content/ambient";
import { flyerAt } from "./ambient";
import { dialogueFacing, dialoguePartner, selectFaeOverworldPose } from "./animation";
import type { Rect } from "./area-view";
import { makeShadowSprite, placeAura } from "./battle-view";
import { interpolatePoint } from "./camera";
import type { RestSpot } from "./companions";
import { computeCutscenePoseTransform } from "./cutscene-render";
import {
  composePose,
  idleBreathing,
  NEUTRAL_POSE,
  npcLivingPose,
  paperFlipPose,
  stepPaperFlip,
  walkPose,
  type PaperFlipState,
} from "./motion";
import { isAdultNpc, type NpcLifeController } from "./npc-life";
import {
  computeCritterShadow,
  computeFaePose,
  computeFlyerVisual,
  computeNpcPose,
  computeNpcShadow,
  computePartyFollowerFacing,
  computePartyFollowerTransform,
  computeRoamerBobAndFacing,
  liftShadowScale,
  resolveNpcTextureFrame,
  type ShadowTransform,
} from "./overworld-render";
import type { VfxTextures } from "./vfx-textures";

export type EntityLayerContainers = {
  depth: Container;
  shadowLayer: Container;
  ambientLayer: Container;
  emissiveLayer: Container;
};

export type CritterFrameInfo = {
  id: string;
  kind: string;
  frame: string;
  x: number;
  y: number;
};

export type NpcFrameInfo = {
  id: string;
  frame: string;
  facing: string;
};

export type AmbientFrameInfo = {
  id: string;
  x: number;
  y: number;
  frame: number;
};

export type PartyFrameInfo = {
  id: string;
  hidden: number;
  animation: string;
  frame: number;
};

function applyShadow(sprite: Sprite, shadow: ShadowTransform): void {
  sprite.position.set(shadow.x, shadow.y);
  sprite.width = shadow.width;
  sprite.height = shadow.height;
  sprite.alpha = shadow.alpha;
}

/**
 * Owns overworld entity sprite pools and per-frame updates: Fae, party
 * followers, area NPCs, chaos/calm critters with auras, and ambient flyers,
 * preserving z-ordering, labels, and area-swap teardown.
 */
export class OverworldEntityLayer {
  private readonly player = new Sprite();
  private readonly playerShadow: Sprite;
  private readonly partySprites = new Map<string, Sprite>();
  private readonly partyShadows = new Map<string, Sprite>();
  private playerFlip: PaperFlipState | undefined;
  private readonly partyFlips = new Map<string, PaperFlipState>();
  private currentPaperFlipScaleX = 1;
  private currentAnimation = "idle_down";
  private currentFrame = 0;
  private partyFrames: { id: string; animation: string; frame: number }[] = [];
  private critterSprites: { id: string; body: Sprite; aura: Sprite; shadow: Sprite }[] = [];
  private critterKeys = "";
  private critterFrames: CritterFrameInfo[] = [];
  private npcSprites: {
    npc: Area["npcs"][number];
    sprite: Sprite;
    shadow: Sprite | null;
  }[] = [];
  private npcFrames: NpcFrameInfo[] = [];
  private ambientSprites: {
    flyer: AmbientFlyer;
    sprite: Sprite;
    shadow: Sprite | null;
    glow: Sprite | null;
  }[] = [];
  private ambientFrames: AmbientFrameInfo[] = [];

  constructor(
    private readonly world: World,
    private readonly vfx: VfxTextures,
    private readonly layers: EntityLayerContainers,
  ) {
    this.playerShadow = makeShadowSprite(this.vfx.contactShadow, "shadow:fae");
    this.layers.shadowLayer.addChild(this.playerShadow);

    this.player.label = "fae";
    for (const id of Object.keys(this.world.party)) {
      const sprite = new Sprite();
      sprite.label = id;
      sprite.visible = false;
      this.partySprites.set(id, sprite);
      const shadow = makeShadowSprite(this.vfx.contactShadow, `shadow:${id}`);
      shadow.visible = false;
      this.partyShadows.set(id, shadow);
      this.layers.shadowLayer.addChild(shadow);
    }
    this.player.scale.set(0.5);
    this.layers.depth.addChild(this.player);
    for (const sprite of this.partySprites.values()) {
      this.layers.depth.addChild(sprite);
    }
  }

  clearPaperFlips(): void {
    this.playerFlip = undefined;
    this.partyFlips.clear();
    this.currentPaperFlipScaleX = 1;
  }

  clearArea(): void {
    this.clearPaperFlips();
    for (const sprite of this.critterSprites) {
      sprite.body.destroy();
      sprite.aura.destroy();
      sprite.shadow.destroy();
    }
    this.critterSprites = [];
    this.critterKeys = "";
    for (const { sprite, shadow } of this.npcSprites) {
      sprite.destroy();
      shadow?.destroy();
    }
    this.npcSprites = [];
  }

  mountAmbient(area: Area): void {
    for (const entry of this.ambientSprites) {
      entry.sprite.destroy();
      entry.shadow?.destroy();
      entry.glow?.destroy();
    }
    this.ambientSprites = ambientFor(area).map((flyer) => {
      const sprite = new Sprite();
      sprite.label = `ambient:${flyer.id}`;
      sprite.anchor.set(0.5);
      this.layers.ambientLayer.addChild(sprite);
      let shadow: Sprite | null = null;
      if (flyer.animation.startsWith("butterfly")) {
        shadow = makeShadowSprite(this.vfx.contactShadow, `shadow:ambient:${flyer.id}`);
        shadow.visible = false;
        this.layers.shadowLayer.addChild(shadow);
      }
      let glow: Sprite | null = null;
      if (flyer.animation === "fairy_light") {
        glow = new Sprite(this.vfx.softGlow);
        glow.label = `glow:ambient:${flyer.id}`;
        glow.anchor.set(0.5);
        glow.blendMode = "add";
        glow.visible = false;
        this.layers.emissiveLayer.addChild(glow);
      }
      return { flyer, sprite, shadow, glow };
    });
  }

  mountNpcs(area: Area): void {
    for (const { sprite, shadow } of this.npcSprites) {
      sprite.destroy();
      shadow?.destroy();
    }
    this.npcSprites = area.npcs.map((npc) => {
      const sprite = new Sprite();
      sprite.label = `npc:${npc.id}`;
      sprite.scale.set(0.5);
      this.layers.depth.addChild(sprite);
      let shadow: Sprite | null = null;
      if (npc.id !== "bus-stop") {
        shadow = makeShadowSprite(this.vfx.contactShadow, `shadow:npc:${npc.id}`);
        shadow.visible = false;
        this.layers.shadowLayer.addChild(shadow);
      }
      return { npc, sprite, shadow };
    });
  }

  /** Bounding boxes for every visible figure in the depth layer, in world units. */
  figures(): Rect[] {
    const sprites = [
      this.player,
      ...this.partySprites.values(),
      ...this.npcSprites.map(({ sprite }) => sprite),
      ...this.critterSprites.flatMap(({ body, aura }) => [body, aura]),
    ];
    return sprites
      .filter((sprite) => sprite.visible && sprite.texture !== Texture.EMPTY)
      .map((sprite) => {
        const width = sprite.width;
        const height = sprite.height;
        const anchorX = sprite.scale.x < 0 ? 1 - sprite.anchor.x : sprite.anchor.x;
        const anchorY = sprite.scale.y < 0 ? 1 - sprite.anchor.y : sprite.anchor.y;
        const x0 = sprite.x - anchorX * width;
        const y0 = sprite.y - anchorY * height;
        return { x0, y0, x1: x0 + width, y1: y0 + height };
      });
  }

  private hasCharacterPoseAnimation(characterId: string, animation: string): boolean {
    if (!animation.startsWith("pose_")) return true;
    const poseSheet = Assets.get<Spritesheet | undefined>(`${characterId}-poses`);
    const frames = poseSheet?.animations[animation];
    return frames !== undefined && frames.length > 0;
  }

  private resolveCharacterTexture(
    characterId: string,
    animation: string,
    frame: number,
  ): Texture | undefined {
    if (animation.startsWith("pose_")) {
      const poseSheet = Assets.get<Spritesheet | undefined>(`${characterId}-poses`);
      const poseTexture = poseSheet?.animations[animation]?.[frame];
      if (poseTexture !== undefined) return poseTexture;
      const fallbackSheet = Assets.get<Spritesheet | undefined>(`${characterId}-sheet`);
      return fallbackSheet?.animations.idle_down?.[0];
    }
    const sheet = Assets.get<Spritesheet | undefined>(`${characterId}-sheet`);
    return sheet?.animations[animation]?.[frame];
  }

  private setFaeTexture(
    state: State,
    activeRest: { spot: RestSpot; elapsed: number } | null,
    activePet: { id: string; elapsed: number } | null,
    activeToolEventId: string | null,
    dialogueTags?: readonly string[],
  ): Direction {
    const sheet = Assets.get<Spritesheet>("fae-sheet");
    const facing = dialogueFacing(this.world, state) ?? activeRest?.spot.facing ?? state.facing;
    const walkName = facing === "right" ? "walk_left" : `walk_${facing}`;
    const walkFrames = sheet.animations[walkName];
    if (walkFrames === undefined || walkFrames.length === 0) {
      throw new Error(`Missing Fae animation ${walkName}`);
    }
    const selection = selectFaeOverworldPose({
      world: this.world,
      state,
      facing,
      walkFrameCount: walkFrames.length,
      walkCycleUnits: this.world.tunables.walkCycleUnits,
      activeRest: activeRest !== null,
      activePet: activePet !== null,
      activeToolEventId,
      ...(dialogueTags !== undefined ? { dialogueTags } : {}),
    });
    const texture = this.resolveCharacterTexture("fae", selection.animation, selection.frame);
    if (texture === undefined) {
      throw new Error(`Missing Fae frame ${selection.animation}:${selection.frame}`);
    }
    this.player.texture = texture;
    if (texture.defaultAnchor === undefined) {
      throw new Error("Fae anchor missing");
    }
    this.player.anchor.copyFrom(texture.defaultAnchor);
    this.player.scale.set(selection.mirror ? -0.5 : 0.5, 0.5);
    this.currentAnimation = selection.animation;
    this.currentFrame = selection.frame;
    return facing;
  }

  renderPlayer(
    state: State,
    playerPos: Point,
    shadowAlpha: number,
    livingMotion: boolean,
    activeRest: { spot: RestSpot; elapsed: number } | null,
    activePet: { id: string; elapsed: number } | null,
    paperFlipEnabled = false,
    interpAlpha = 1,
    activeToolEventId: string | null = null,
    dialogueTags?: readonly string[],
  ): void {
    const facing = this.setFaeTexture(
      state,
      activeRest,
      activePet,
      activeToolEventId,
      dialogueTags,
    );
    const baseFaePose = computeFaePose(
      state,
      livingMotion,
      this.world.tunables.walkCycleUnits,
      playerPos,
      activeRest,
      activePet,
    );
    const csFae = cutsceneView(state)?.actorOverrides.fae;
    const faePose =
      csFae?.pose !== undefined
        ? composePose(
            baseFaePose,
            computeCutscenePoseTransform(csFae.pose, csFae.poseTicks ?? 0, !livingMotion),
          )
        : baseFaePose;
    this.playerFlip = stepPaperFlip(this.playerFlip, facing, state.tick);
    const flipElapsed =
      this.playerFlip.startTick === null
        ? -1
        : state.tick - this.playerFlip.startTick + (paperFlipEnabled ? interpAlpha : 0);
    const flipPose = paperFlipPose(flipElapsed, paperFlipEnabled);
    this.currentPaperFlipScaleX = flipPose.scaleX;
    const totalPose = composePose(faePose, flipPose);
    this.player.position.set(playerPos.x + totalPose.offsetX, playerPos.y + totalPose.offsetY);
    this.player.scale.set(
      this.player.scale.x * totalPose.scaleX,
      this.player.scale.y * totalPose.scaleY,
    );
    this.player.rotation = totalPose.rotation;
    this.player.zIndex = playerPos.y;
    const faeShadowScale = liftShadowScale(totalPose.offsetY);
    this.playerShadow.position.set(playerPos.x, playerPos.y);
    this.playerShadow.width = 46 * faeShadowScale;
    this.playerShadow.height = 18 * faeShadowScale;
    this.playerShadow.alpha = shadowAlpha * faeShadowScale;
  }

  renderParty(
    state: State,
    shadowAlpha: number,
    previousState: State | undefined,
    alpha: number,
    livingMotion: boolean,
    activePet: { id: string; elapsed: number } | null,
    activeRest = false,
    partyLife: readonly PartyLifeEntry[] = [],
    paperFlipEnabled = false,
    interpAlpha = 1,
    dialogueTags?: readonly string[],
  ): void {
    const inParty = new Set(state.party.map((member) => member.id));
    for (const [id, sprite] of this.partySprites) {
      const present = inParty.has(id);
      sprite.visible = present;
      const shadow = this.partyShadows.get(id);
      if (shadow !== undefined) shadow.visible = present;
    }
    for (const id of this.partyFlips.keys()) {
      if (!inParty.has(id)) this.partyFlips.delete(id);
    }
    const partner = dialoguePartner(this.world, state);
    const partyAttentionById = new Map(partyLife.map((entry) => [entry.id, entry.attention]));
    const csOverrides = cutsceneView(state)?.actorOverrides;
    this.partyFrames = state.party.flatMap((member, index) => {
      const sprite = this.partySprites.get(member.id);
      const content = this.world.party[member.id];
      if (sprite === undefined || content === undefined) return [];
      const prevMember = previousState?.party.find((item) => item.id === member.id);
      const pos = prevMember !== undefined && alpha < 1
        ? interpolatePoint(prevMember, member, alpha)
        : member;
      const sheet = Assets.get<Spritesheet>(`${member.id}-sheet`);
      const memberFacing = computePartyFollowerFacing(
        member,
        content,
        state,
        partner,
        this.world.tunables.follow,
        activePet,
      );
      const nextFlip = stepPaperFlip(this.partyFlips.get(member.id), memberFacing, state.tick);
      this.partyFlips.set(member.id, nextFlip);
      const flipElapsed =
        nextFlip.startTick === null
          ? -1
          : state.tick - nextFlip.startTick + (paperFlipEnabled ? interpAlpha : 0);
      const memberFlipPose = paperFlipPose(flipElapsed, paperFlipEnabled);
      const transform = computePartyFollowerTransform(
        member,
        content,
        state,
        index,
        pos,
        partner,
        shadowAlpha,
        livingMotion,
        this.world.tunables.follow,
        activePet,
        (animation) => {
          const frames = sheet.animations[animation];
          if (frames === undefined || frames.length === 0)
            throw new Error(`Missing ${member.id} animation ${animation}`);
          return frames.length;
        },
        {
          activeRest,
          partyAttention: partyAttentionById.get(member.id) ?? null,
          ...(dialogueTags !== undefined ? { dialogueTags } : {}),
          paperFlipPose: memberFlipPose,
          worldStory: this.world.story,
          hasAnimation: (animation) => this.hasCharacterPoseAnimation(member.id, animation),
        },
      );
      const texture = this.resolveCharacterTexture(member.id, transform.animation, transform.frame);
      if (texture === undefined)
        throw new Error(`Missing ${member.id} frame ${transform.animation}:${transform.frame}`);
      const csMember = csOverrides?.[`party:${member.id}`];
      const csPose =
        csMember?.pose !== undefined
          ? computeCutscenePoseTransform(csMember.pose, csMember.poseTicks ?? 0, !livingMotion)
          : null;
      sprite.texture = texture;
      if (texture.defaultAnchor === undefined)
        throw new Error(`${member.id} anchor missing`);
      sprite.anchor.copyFrom(texture.defaultAnchor);
      if (csPose !== null) {
        sprite.position.set(transform.x + csPose.offsetX, transform.y + csPose.offsetY);
        sprite.scale.set(transform.scaleX * csPose.scaleX, transform.scaleY * csPose.scaleY);
        sprite.rotation = transform.rotation + csPose.rotation;
      } else {
        sprite.position.set(transform.x, transform.y);
        sprite.scale.set(transform.scaleX, transform.scaleY);
        sprite.rotation = transform.rotation;
      }
      sprite.zIndex = transform.zIndex;
      const shadow = this.partyShadows.get(member.id);
      if (shadow !== undefined) {
        if (csPose !== null) {
          const lift = liftShadowScale(csPose.offsetY);
          applyShadow(shadow, {
            x: transform.shadow.x,
            y: transform.shadow.y,
            width: transform.shadow.width * lift,
            height: transform.shadow.height * lift,
            alpha: transform.shadow.alpha * lift,
          });
        } else {
          applyShadow(shadow, transform.shadow);
        }
      }
      return [{ id: member.id, animation: transform.animation, frame: transform.frame }];
    });
  }

  syncCritters(present: ReturnType<typeof presentCritters>): void {
    const keys = present
      .map((critter) => `${critter.key}=${critter.kind.id}`)
      .join("|");
    if (keys === this.critterKeys) return;
    this.critterKeys = keys;
    for (const sprite of this.critterSprites) {
      sprite.body.destroy();
      sprite.aura.destroy();
      sprite.shadow.destroy();
    }
    this.critterSprites = present.map((critter) => {
      const body = new Sprite();
      body.label = `critter:${critter.key}`;
      const aura = new Sprite();
      aura.label = `critter:${critter.key}:aura`;
      const shadow = makeShadowSprite(
        this.vfx.contactShadow,
        `shadow:critter:${critter.key}`,
      );
      this.layers.depth.addChild(aura, body);
      this.layers.shadowLayer.addChild(shadow);
      return { id: critter.key, body, aura, shadow };
    });
  }

  renderCritters(
    state: State,
    hasArea: boolean,
    shadowAlpha: number,
    previousState: State | undefined,
    alpha: number,
    livingMotion: boolean,
    reducedMotion = false,
  ): void {
    const present = hasArea ? presentCritters(this.world, state) : [];
    this.syncCritters(present);
    const frames: CritterFrameInfo[] = [];
    for (const [index, { id, body, aura, shadow }] of this.critterSprites.entries()) {
      const critter = present[index];
      if (critter === undefined) continue;
      const content = critter.kind;
      const logicalPoint = critter.point;
      const roamer = critter.wild;
      const prevWild = roamer === null || previousState === undefined
        ? undefined
        : previousState.wild.find(
            (item) => item.den === roamer.den && item.kind === roamer.kind,
          );
      const point = prevWild !== undefined && alpha < 1
        ? interpolatePoint(prevWild, logicalPoint, alpha)
        : logicalPoint;
      const sheet = Assets.get<Spritesheet>(content.atlas);
      if (sheet === undefined) continue;
      const { calm, frame, flipX, pose } = computeRoamerBobAndFacing(
        critter,
        state,
        index,
        point,
        this.world.tunables.roam.noticeTicks,
        livingMotion,
      );
      const texture = sheet.textures[frame];
      const auraTexture = sheet.textures.chaos_aura_01;
      if (texture === undefined || auraTexture === undefined) continue;
      const scale = content.overworldHeight / content.figureHeight;
      body.texture = texture;
      body.anchor.set(0.5, 504 / 512);
      body.scale.set((flipX ? -scale : scale) * pose.scaleX, scale * pose.scaleY);
      body.position.set(point.x + pose.offsetX, point.y + pose.offsetY);
      body.rotation = pose.rotation;
      body.zIndex = point.y;
      applyShadow(
        shadow,
        computeCritterShadow(point, content.overworldHeight, pose.offsetY, shadowAlpha),
      );
      aura.visible = !calm;
      aura.texture = auraTexture;
      placeAura(
        aura,
        { x: point.x + pose.offsetX, y: point.y + pose.offsetY },
        scale,
        content.auraCentre,
        content.bodyCentre,
        flipX,
      );
      aura.zIndex = point.y - 0.5;
      aura.alpha = reducedMotion ? 0.65 : 0.65 + Math.sin(state.tick / 18) * 0.2;
      aura.rotation = reducedMotion ? 0 : state.tick / 180;
      frames.push({ id, kind: content.id, frame, x: logicalPoint.x, y: logicalPoint.y });
    }
    this.critterFrames = frames;
  }

  renderNpcs(
    state: State,
    shadowAlpha: number,
    livingMotion: boolean,
    npcLife: NpcLifeSnapshot,
    lifeController: NpcLifeController,
    previousState?: State,
    alpha = 1,
    reducedMotion = false,
  ): void {
    const lifeById = new Map(npcLife.npcs.map((entry) => [entry.id, entry]));
    const csOverrides = cutsceneView(state)?.actorOverrides;
    const prevCsOverrides =
      previousState === undefined ? undefined : cutsceneView(previousState)?.actorOverrides;
    const frames: NpcFrameInfo[] = [];
    for (const [npcIndex, { npc, sprite, shadow }] of this.npcSprites.entries()) {
      sprite.visible = npcVisible(this.world, state, npc);
      if (shadow !== null) shadow.visible = sprite.visible;
      if (!sprite.visible) continue;
      const csOverride = csOverrides?.[`npc:${npc.id}`];
      const prevCsOverride = prevCsOverrides?.[`npc:${npc.id}`];
      const currLive = npcLivePoint(state, npc);
      const holdHome = reducedMotion && npc.stroll !== undefined;
      let livePos: Point;
      if (csOverride?.x !== undefined && csOverride.y !== undefined) {
        livePos =
          alpha < 1 && prevCsOverride?.x !== undefined && prevCsOverride.y !== undefined
            ? interpolatePoint(
                { x: prevCsOverride.x, y: prevCsOverride.y },
                { x: csOverride.x, y: csOverride.y },
                alpha,
              )
            : { x: csOverride.x, y: csOverride.y };
      } else {
        livePos = holdHome
          ? npc.point
          : npc.stroll !== undefined && previousState !== undefined && alpha < 1
            ? interpolatePoint(npcLivePoint(previousState, npc), currLive, alpha)
            : { x: currLive.x, y: currLive.y };
      }
      const isMoving =
        csOverride !== undefined ? csOverride.moving === true : !holdHome && currLive.moving;
      const liveDistance =
        csOverride !== undefined ? (csOverride.distance ?? 0) : holdHome ? 0 : currLive.distance;
      if (npc.visibleWhenCalmed !== undefined) {
        const critter = this.world.critters[npc.visibleWhenCalmed];
        const sheet = critter === undefined ? undefined : Assets.get<Spritesheet>(critter.atlas);
        const texture = sheet?.textures.calm_idle_01;
        if (critter === undefined || texture === undefined) continue;
        const facing = csOverride?.facing ?? npcFacing(state, npc);
        const talking = state.dialogue !== null && state.dialogue.knot === npc.knot;
        const flipX = talking ? state.player.x > livePos.x : facing === "right";
        const scale = critter.overworldHeight / critter.figureHeight;
        const pose = !livingMotion
          ? NEUTRAL_POSE
          : idleBreathing(state.tick, (npcIndex + 1) * 1.1, 0.012);
        sprite.texture = texture;
        sprite.anchor.set(0.5, 504 / 512);
        sprite.scale.set((flipX ? -scale : scale) * pose.scaleX, scale * pose.scaleY);
        sprite.position.set(livePos.x + pose.offsetX, livePos.y + pose.offsetY);
        sprite.rotation = pose.rotation;
        sprite.zIndex = livePos.y;
        if (shadow !== null) {
          applyShadow(shadow, computeCritterShadow(livePos, critter.overworldHeight, 0,
            shadowAlpha));
        }
        frames.push({ id: npc.id, frame: "calm_idle_01", facing });
        continue;
      }
      const sheet = Assets.get<Spritesheet>(`${npc.id}-sheet`);
      const character = this.world.characters[npc.id];
      if (sheet === undefined || character === undefined) continue;
      const entry = lifeById.get(npc.id);
      const lifePresentation = lifeController.stepPresentation(
        npc,
        entry,
        state,
        livingMotion,
      );
      const facing = csOverride?.facing ?? lifePresentation.facing;
      const { attentionAge, turnAge, areaTicks } = lifePresentation;
      let mirror = false;
      let name: string | undefined;
      if (csOverride !== undefined && isMoving) {
        const animations = sheet.data.animations;
        const wantedWalk = `walk_${facing}`;
        const walkMirror =
          facing === "right" &&
          animations?.[wantedWalk] === undefined &&
          animations?.walk_left !== undefined;
        const walkAnim = walkMirror
          ? "walk_left"
          : animations?.[wantedWalk] !== undefined
            ? wantedWalk
            : undefined;
        const walkFrames = walkAnim === undefined ? undefined : animations?.[walkAnim];
        if (walkFrames !== undefined && walkFrames.length > 0) {
          const frameIndex =
            Math.floor(liveDistance / (72 / walkFrames.length)) % walkFrames.length;
          mirror = walkMirror;
          name = walkFrames[frameIndex] ?? walkFrames[0];
        }
      }
      if (name === undefined) {
        const resolved = resolveNpcTextureFrame(
          sheet.data.animations,
          facing,
          character.idleTicks,
          state.tick,
        );
        mirror = resolved.mirror;
        name = resolved.frameName;
      }
      const texture = name === undefined ? undefined : sheet.textures[name];
      if (name === undefined || texture === undefined) continue;
      sprite.texture = texture;
      if (texture.defaultAnchor !== undefined)
        sprite.anchor.copyFrom(texture.defaultAnchor);
      const s = character.scale ?? 0.5;
      const basePose = !livingMotion || npc.id === "bus-stop"
        ? NEUTRAL_POSE
        : npc.id.startsWith("fairy-")
          ? computeNpcPose(npc.id, npcIndex, state.tick, livingMotion)
          : isMoving
            ? walkPose(liveDistance, 72, true)
            : entry !== undefined && (entry.attention !== "idle" || areaTicks >= 48)
              ? npcLivingPose(
                  entry.personality,
                  entry.attention,
                  state.tick,
                  npcIndex,
                  attentionAge,
                  turnAge,
                )
              : computeNpcPose(npc.id, npcIndex, state.tick, livingMotion);
      const livingPose =
        isMoving &&
        livingMotion &&
        !reducedMotion &&
        entry !== undefined &&
        entry.attention !== "idle"
          ? composePose(
              basePose,
              npcLivingPose(
                entry.personality,
                entry.attention,
                state.tick,
                npcIndex,
                attentionAge,
                turnAge,
              ),
            )
          : basePose;
      const pose =
        csOverride?.pose !== undefined
          ? composePose(
              livingPose,
              computeCutscenePoseTransform(
                csOverride.pose,
                csOverride.poseTicks ?? 0,
                reducedMotion,
              ),
            )
          : livingPose;
      sprite.scale.set((mirror ? -s : s) * pose.scaleX, s * pose.scaleY);
      sprite.position.set(livePos.x + pose.offsetX, livePos.y + pose.offsetY);
      sprite.rotation = pose.rotation;
      sprite.zIndex = livePos.y;
      if (shadow !== null) {
        applyShadow(
          shadow,
          computeNpcShadow(npc.id, livePos, pose, shadowAlpha, isAdultNpc(this.world, npc.id)),
        );
      }
      frames.push({ id: npc.id, frame: name, facing });
    }
    this.npcFrames = frames;
  }

  renderAmbient(state: State, area: Area, reducedMotion: boolean): void {
    const sheet = Assets.get<Spritesheet>("ambient-sheet");
    const visible = state.battle === null && state.arcade === null;
    const showEffects = visible && area.id !== "harness";
    if (!visible) {
      for (const { sprite, shadow, glow } of this.ambientSprites) {
        sprite.visible = false;
        if (shadow !== null) shadow.visible = false;
        if (glow !== null) glow.visible = false;
      }
      this.ambientFrames = [];
      return;
    }
    const frames: AmbientFrameInfo[] = [];
    for (const { flyer, sprite, shadow, glow } of this.ambientSprites) {
      const names = sheet?.data.animations?.[flyer.animation] ?? [];
      const rawPosition = flyerAt(
        flyer,
        reducedMotion ? 0 : state.tick,
        Math.max(1, names.length),
      );
      const position = reducedMotion ? { ...rawPosition, frame: 0 } : rawPosition;
      const frameName = names[position.frame] ?? names[0];
      const texture = frameName === undefined ? undefined : sheet?.textures[frameName];
      sprite.visible = texture !== undefined;
      if (texture === undefined) {
        if (shadow !== null) shadow.visible = false;
        if (glow !== null) glow.visible = false;
        continue;
      }
      sprite.texture = texture;
      sprite.position.set(position.x, position.y);
      const scale = flyer.size / 96;
      sprite.scale.set(position.flip ? -scale : scale, scale);
      const visual = computeFlyerVisual(
        flyer,
        position,
        reducedMotion ? 0 : state.tick,
        reducedMotion,
      );
      if (shadow !== null) {
        shadow.visible = showEffects && visual.shadow !== null;
        if (visual.shadow !== null) applyShadow(shadow, visual.shadow);
      }
      if (glow !== null) {
        glow.visible = showEffects && visual.glow !== null;
        if (visual.glow !== null) {
          glow.position.set(visual.glow.x, visual.glow.y);
          glow.width = visual.glow.width;
          glow.height = visual.glow.height;
          glow.alpha = visual.glow.alpha;
          glow.tint = visual.glow.tint;
        }
      }
      frames.push({ id: flyer.id, x: position.x, y: position.y, frame: position.frame });
    }
    this.ambientFrames = frames;
  }

  get animation(): string {
    return this.currentAnimation;
  }

  get frame(): number {
    return this.currentFrame;
  }

  get paperFlipScaleX(): number {
    return this.currentPaperFlipScaleX;
  }

  partyInfo(state: State): PartyFrameInfo[] {
    return this.partyFrames.map((frames, index) => {
      const member = state.party[index];
      const content = this.world.party[frames.id];
      const leader = partyLeader(this.world, state, index);
      return {
        ...frames,
        hidden:
          member === undefined || content === undefined
            ? 0
            : hiddenFraction(member, content.box, leader.point, leader.box),
      };
    });
  }

  get critters(): CritterFrameInfo[] {
    return this.critterFrames;
  }

  get npcs(): NpcFrameInfo[] {
    return this.npcFrames;
  }

  get ambient(): AmbientFrameInfo[] {
    return this.ambientFrames;
  }
}
