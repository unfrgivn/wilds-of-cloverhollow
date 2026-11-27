import { Assets, Container, Sprite, Spritesheet, Texture } from "pixi.js";
import {
  hiddenFraction,
  npcFacing,
  npcVisible,
  partyLeader,
  presentCritters,
  type Area,
  type Direction,
  type NpcLifeSnapshot,
  type Point,
  type State,
  type World,
} from "../core";
import { ambientFor, type AmbientFlyer } from "../content/ambient";
import { flyerAt } from "./ambient";
import { dialogueFacing, dialoguePartner, selectFaeAnimation } from "./animation";
import type { Rect } from "./area-view";
import { makeShadowSprite, placeAura } from "./battle-view";
import { interpolatePoint } from "./camera";
import type { RestSpot } from "./companions";
import { idleBreathing, NEUTRAL_POSE, npcLivingPose } from "./motion";
import { isAdultNpc, type NpcLifeController } from "./npc-life";
import {
  computeCritterShadow,
  computeFaePose,
  computeFlyerVisual,
  computeNpcPose,
  computeNpcShadow,
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

  clearArea(): void {
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

  private setFaeTexture(state: State, facingOverride?: Direction): void {
    const sheet = Assets.get<Spritesheet>("fae-sheet");
    const facing = dialogueFacing(this.world, state) ?? facingOverride ?? state.facing;
    const idleName = facing === "right" ? "idle_left" : `idle_${facing}`;
    const walkName = facing === "right" ? "walk_left" : `walk_${facing}`;
    const name = state.motion.moving ? walkName : idleName;
    const frames = sheet.animations[name];
    if (frames === undefined || frames.length === 0)
      throw new Error(`Missing Fae animation ${name}`);
    const selection = selectFaeAnimation(
      facing,
      state.motion,
      frames.length,
      this.world.tunables.walkCycleUnits,
    );
    const texture = frames[selection.frame];
    if (texture === undefined)
      throw new Error(`Missing Fae frame ${selection.frame}`);
    this.player.texture = texture;
    if (texture.defaultAnchor === undefined)
      throw new Error("Fae anchor missing");
    this.player.anchor.copyFrom(texture.defaultAnchor);
    this.player.scale.set(selection.mirror ? -0.5 : 0.5, 0.5);
    this.currentAnimation = selection.animation;
    this.currentFrame = selection.frame;
  }

  renderPlayer(
    state: State,
    playerPos: Point,
    shadowAlpha: number,
    livingMotion: boolean,
    activeRest: { spot: RestSpot; elapsed: number } | null,
    activePet: { id: string; elapsed: number } | null,
  ): void {
    this.setFaeTexture(state, activeRest?.spot.facing);
    const faePose = computeFaePose(
      state,
      livingMotion,
      this.world.tunables.walkCycleUnits,
      playerPos,
      activeRest,
      activePet,
    );
    this.player.position.set(playerPos.x + faePose.offsetX, playerPos.y + faePose.offsetY);
    this.player.scale.set(
      this.player.scale.x * faePose.scaleX,
      this.player.scale.y * faePose.scaleY,
    );
    this.player.rotation = faePose.rotation;
    this.player.zIndex = playerPos.y;
    const faeShadowScale = liftShadowScale(faePose.offsetY);
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
  ): void {
    const inParty = new Set(state.party.map((member) => member.id));
    for (const [id, sprite] of this.partySprites) {
      const present = inParty.has(id);
      sprite.visible = present;
      const shadow = this.partyShadows.get(id);
      if (shadow !== undefined) shadow.visible = present;
    }
    const partner = dialoguePartner(this.world, state);
    this.partyFrames = state.party.flatMap((member, index) => {
      const sprite = this.partySprites.get(member.id);
      const content = this.world.party[member.id];
      if (sprite === undefined || content === undefined) return [];
      const prevMember = previousState?.party.find((item) => item.id === member.id);
      const pos = prevMember !== undefined && alpha < 1
        ? interpolatePoint(prevMember, member, alpha)
        : member;
      const sheet = Assets.get<Spritesheet>(`${member.id}-sheet`);
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
      );
      const texture = sheet.animations[transform.animation]?.[transform.frame];
      if (texture === undefined)
        throw new Error(`Missing ${member.id} frame ${transform.frame}`);
      sprite.texture = texture;
      if (texture.defaultAnchor === undefined)
        throw new Error(`${member.id} anchor missing`);
      sprite.anchor.copyFrom(texture.defaultAnchor);
      sprite.position.set(transform.x, transform.y);
      sprite.scale.set(transform.scaleX, transform.scaleY);
      sprite.rotation = transform.rotation;
      sprite.zIndex = transform.zIndex;
      const shadow = this.partyShadows.get(member.id);
      if (shadow !== undefined) applyShadow(shadow, transform.shadow);
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
  ): void {
    const lifeById = new Map(npcLife.npcs.map((entry) => [entry.id, entry]));
    const frames: NpcFrameInfo[] = [];
    for (const [npcIndex, { npc, sprite, shadow }] of this.npcSprites.entries()) {
      sprite.visible = npcVisible(this.world, state, npc);
      if (shadow !== null) shadow.visible = sprite.visible;
      if (!sprite.visible) continue;
      if (npc.visibleWhenCalmed !== undefined) {
        const critter = this.world.critters[npc.visibleWhenCalmed];
        const sheet = critter === undefined ? undefined : Assets.get<Spritesheet>(critter.atlas);
        const texture = sheet?.textures.calm_idle_01;
        if (critter === undefined || texture === undefined) continue;
        const facing = npcFacing(state, npc);
        const talking = state.dialogue !== null && state.dialogue.knot === npc.knot;
        const flipX = talking ? state.player.x > npc.point.x : npc.facing === "right";
        const scale = critter.overworldHeight / critter.figureHeight;
        const pose = !livingMotion
          ? NEUTRAL_POSE
          : idleBreathing(state.tick, (npcIndex + 1) * 1.1, 0.012);
        sprite.texture = texture;
        sprite.anchor.set(0.5, 504 / 512);
        sprite.scale.set((flipX ? -scale : scale) * pose.scaleX, scale * pose.scaleY);
        sprite.position.set(npc.point.x + pose.offsetX, npc.point.y + pose.offsetY);
        sprite.rotation = pose.rotation;
        sprite.zIndex = npc.point.y;
        if (shadow !== null) {
          applyShadow(shadow, computeCritterShadow(npc.point, critter.overworldHeight, 0,
            shadowAlpha));
        }
        frames.push({ id: npc.id, frame: "calm_idle_01", facing });
        continue;
      }
      const sheet = Assets.get<Spritesheet>(`${npc.id}-sheet`);
      const character = this.world.characters[npc.id];
      if (sheet === undefined || character === undefined) continue;
      const entry = lifeById.get(npc.id);
      const { facing, attentionAge, turnAge, areaTicks } = lifeController.stepPresentation(
        npc,
        entry,
        state,
        livingMotion,
      );
      const { mirror, frameName: name } = resolveNpcTextureFrame(
        sheet.data.animations,
        facing,
        character.idleTicks,
        state.tick,
      );
      const texture = name === undefined ? undefined : sheet.textures[name];
      if (name === undefined || texture === undefined) continue;
      sprite.texture = texture;
      if (texture.defaultAnchor !== undefined)
        sprite.anchor.copyFrom(texture.defaultAnchor);
      const s = character.scale ?? 0.5;
      const pose = !livingMotion || npc.id === "bus-stop"
        ? NEUTRAL_POSE
        : npc.id.startsWith("fairy-")
          ? computeNpcPose(npc.id, npcIndex, state.tick, livingMotion)
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
      sprite.scale.set((mirror ? -s : s) * pose.scaleX, s * pose.scaleY);
      sprite.position.set(npc.point.x + pose.offsetX, npc.point.y + pose.offsetY);
      sprite.rotation = pose.rotation;
      sprite.zIndex = npc.point.y;
      if (shadow !== null) {
        applyShadow(
          shadow,
          computeNpcShadow(npc.id, npc.point, pose, shadowAlpha, isAdultNpc(this.world, npc.id)),
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
