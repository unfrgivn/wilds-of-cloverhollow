import {
  Assets,
  Container,
  Graphics,
  Sprite,
  Spritesheet,
  Text,
  TilingSprite,
  type Renderer,
  Texture,
} from "pixi.js";
import {
  hiddenFraction,
  npcFacing,
  npcVisible,
  partyLeader,
  presentCritters,
  targetInteractable,
  wildMarks,
  creditEntries,
  type Area,
  type CreditEntry,
  type Direction,
  type Point,
  type State,
  type World,
} from "../core";
import { AreaView, type Rect } from "./area-view";
import { interpolatePoint, smoothFollowCamera, worldToScreen } from "./camera";
import { dialogueFacing, dialoguePartner, selectFaeAnimation } from "./animation";
import { assetUrl } from "../platform/assets";
import { isReducedMotionActive } from "../platform/reduced-motion";
import { fadeAlpha, transitionZoom } from "./fade";
import { ambientFor, type AmbientFlyer } from "../content/ambient";
import { flyerAt } from "./ambient";
import { createVfxTextures, type VfxTextures } from "./vfx-textures";
import { BiomeAtmosphere, type AtmosphereOptions } from "./atmosphere";
import type { RestSpot } from "./companions";
import { storyTimeOfDay, type TimeOfDayPhase } from "./time-of-day";
import { idleBreathing, NEUTRAL_POSE } from "./motion";
import {
  BattleViewController,
  makeShadowSprite,
  placeAura,
  type BattleCheckGeometry,
  type BattleCheckInfo,
  type BattleRenderInfo,
} from "./battle-view";
import {
  CLUBHOUSE_PRIZES_ALIAS,
  OverworldEffectsController,
} from "./overworld-effects";
import {
  areaEntityAtlases,
  computeCritterShadow,
  computeFaePose,
  computeFlyerVisual,
  computeGlowTransform,
  computeLanternBlend,
  computeNpcPose,
  computeNpcShadow,
  computePartyFollowerTransform,
  computeRoamerBobAndFacing,
  INDOOR_AREAS,
  liftShadowScale,
  PET_REACTION_DURATION,
  resolveNpcTextureFrame,
  type EntityAtlas,
  type ShadowTransform,
} from "./overworld-render";

export { areaEntityAtlases, type BattleCheckGeometry, type BattleCheckInfo, type EntityAtlas };

export type RenderOptions = {
  paused?: boolean;
  alpha?: number;
  previousState?: State;
};

function applyShadow(sprite: Sprite, shadow: ShadowTransform): void {
  sprite.position.set(shadow.x, shadow.y);
  sprite.width = shadow.width;
  sprite.height = shadow.height;
  sprite.alpha = shadow.alpha;
}

function mipmapSheet(alias: string, src: string): Promise<Spritesheet> {
  return Assets.load<Spritesheet>({
    alias,
    src,
    data: { textureOptions: { autoGenerateMipmaps: true } },
  });
}

export class GameView {
  readonly root = new Container();
  readonly ready: Promise<void>;
  private readonly vfx: VfxTextures;
  private readonly atmosphere: BiomeAtmosphere;
  private readonly effects: OverworldEffectsController;
  private readonly background = new Graphics();
  private readonly paper = new Graphics();
  private readonly fade = new Graphics();
  private readonly viewport = new Container();
  private readonly scene = new Container();
  private readonly shadowLayer = new Container();
  private readonly paperGrain: TilingSprite;
  private viewportRect = { x: 0, y: 0, width: 0, height: 0 };
  private photoMode = false;
  private readonly lanternLayer = new Container();
  private readonly lanternTint = new Graphics();
  private readonly lanternWorld = new Container();
  private readonly lanternSpotlight: Sprite;
  private readonly emissiveLayer = new Container();
  private readonly glowLayer = new Container();
  private readonly depth = new Container();
  private readonly ambientLayer = new Container();
  private readonly player = new Sprite();
  private readonly playerShadow: Sprite;
  // One overworld sprite per roster member, labelled with its id; only the
  // members in the party are visible.
  private readonly partySprites = new Map<string, Sprite>();
  private readonly partyShadows = new Map<string, Sprite>();
  private readonly viewportMask = new Graphics();
  private readonly battleView: BattleViewController;
  private readonly label: Text | undefined;
  private areaView: AreaView | undefined;
  private viewWidth = 960;
  private viewHeight = 720;
  private previousCamera: Point | undefined;
  private staticWidth = 0;
  private staticHeight = 0;
  private staticPaper = 0;
  private lanternBlend = 0;
  private lanternTick: number | undefined;
  private currentAnimation = "idle_down";
  private currentFrame = 0;
  private partyFrames: { id: string; animation: string; frame: number }[] = [];
  private readonly areaTextureUrls = new Set<string>();
  // The URLs of the area one crossing back, kept resident so the way back
  // through a door is a cache hit (the area two crossings back unloads).
  private residentUrls: readonly string[] = [];
  // Per-area NPC and critter atlas aliases kept on the same current + previous
  // residency window, separate from `areaTextureUrls` so `cachedAreaTextures`
  // reports only the area's ground tiles and prop atlases.
  private currentEntityAliases: readonly string[] = [];
  private residentEntityAliases: readonly string[] = [];
  private readonly permanentAliases: ReadonlySet<string>;
  private critterSprites: { id: string; body: Sprite; aura: Sprite; shadow: Sprite }[] = [];
  private critterKeys = "";
  // Each overworld critter: `id` is its key (a set piece's id or `wild:<den>`).
  private critterFrames: {
    id: string;
    kind: string;
    frame: string;
    x: number;
    y: number;
  }[] = [];
  private npcSprites: {
    npc: Area["npcs"][number];
    sprite: Sprite;
    shadow: Sprite | null;
  }[] = [];
  private npcFrames: { id: string; frame: string; facing: string }[] = [];
  private glowSprites: { id: string; sprite: Sprite }[] = [];
  private drawnGlows: string[] = [];
  private ambientSprites: {
    flyer: AmbientFlyer;
    sprite: Sprite;
    shadow: Sprite | null;
    glow: Sprite | null;
  }[] = [];
  private ambientFrames: { id: string; x: number; y: number; frame: number }[] = [];
  private petReaction: { id: string; startTick: number } | null = null;
  private restingSpot: { spot: RestSpot; startTick: number } | null = null;

  constructor(
    private readonly world: World,
    options: { debugLabel: boolean; renderer: Renderer },
  ) {
    this.vfx = createVfxTextures();
    this.atmosphere = new BiomeAtmosphere(this.vfx);
    this.emissiveLayer.label = "emissive";
    this.emissiveLayer.addChild(this.atmosphere.emissive);
    this.effects = new OverworldEffectsController(
      this.world,
      this.vfx,
      this.depth,
      this.emissiveLayer,
    );
    this.battleView = new BattleViewController(this.world, this.vfx, options.renderer);
    this.paperGrain = new TilingSprite({
      texture: this.vfx.paperGrain,
      width: 960,
      height: 720,
    });
    this.paperGrain.label = "paper-grain";
    this.paperGrain.blendMode = "multiply";
    this.paperGrain.alpha = 0.035;
    this.paperGrain.visible = false;

    this.playerShadow = makeShadowSprite(this.vfx.contactShadow, "shadow:fae");
    this.shadowLayer.label = "shadows";
    this.shadowLayer.addChild(this.playerShadow);

    this.lanternSpotlight = new Sprite(this.vfx.softGlow);
    this.lanternSpotlight.label = "lantern:spotlight";
    this.lanternSpotlight.anchor.set(0.5);
    this.lanternSpotlight.tint = 0xb98eff;
    this.lanternSpotlight.blendMode = "add";
    this.lanternSpotlight.width = 540;
    this.lanternSpotlight.height = 480;
    this.lanternWorld.addChild(this.lanternSpotlight, this.effects.lanternMoteLayer);
    this.lanternLayer.label = "lantern";
    this.lanternLayer.visible = false;
    this.lanternLayer.addChild(this.lanternTint, this.lanternWorld);

    this.permanentAliases = new Set([
      "fae-sheet",
      "glow-sheet",
      "ambient-sheet",
      world.battle.toyAtlas,
      ...Object.keys(world.party).map((id) => `${id}-sheet`),
    ]);
    this.depth.sortableChildren = true;
    this.player.label = "fae";
    for (const id of Object.keys(world.party)) {
      const sprite = new Sprite();
      sprite.label = id;
      sprite.visible = false;
      this.partySprites.set(id, sprite);
      const shadow = makeShadowSprite(this.vfx.contactShadow, `shadow:${id}`);
      shadow.visible = false;
      this.partyShadows.set(id, shadow);
      this.shadowLayer.addChild(shadow);
    }
    this.player.scale.set(0.5);
    this.viewport.addChild(
      this.scene,
      this.effects.timeOfDayLayer,
      this.lanternLayer,
      this.emissiveLayer,
      this.glowLayer,
    );
    this.viewport.mask = this.viewportMask;
    this.root.addChild(
      this.background,
      this.paper,
      this.viewport,
      this.viewportMask,
      this.fade,
      this.battleView.root,
    );
    this.scene.addChild(
      this.shadowLayer,
      this.effects.footstepLayer,
      this.atmosphere.under,
      this.depth,
      this.ambientLayer,
      this.atmosphere.over,
      this.effects.emoteLayer,
      this.paperGrain,
    );
    this.depth.addChild(this.player);
    for (const sprite of this.partySprites.values())
      this.depth.addChild(sprite);
    if (options.debugLabel) {
      this.label = new Text({
        text: "",
        style: { fill: 0x513b32, fontSize: 18 },
      });
      this.label.position.set(20, 20);
      this.root.addChild(this.label);
    }
    this.ready = this.loadCharacter();
  }

  private async loadCharacter(): Promise<void> {
    await Promise.all([
      mipmapSheet("fae-sheet", assetUrl("assets/characters/fae/fae.json")),
      ...Object.entries(this.world.party).map(([id, member]) =>
        mipmapSheet(`${id}-sheet`, assetUrl(member.atlas)),
      ),
      mipmapSheet("glow-sheet", assetUrl("assets/glows/glows.json")),
      mipmapSheet("ambient-sheet", assetUrl("assets/ambient/ambient.json")),
      // The toys a catch throws are cropped from this sheet by the DOM
      // overlay, which reads their frames here.
      mipmapSheet(this.world.battle.toyAtlas, assetUrl(this.world.battle.toyAtlas)),
    ]);
  }

  async setArea(area: Area): Promise<void> {
    const previous = this.areaView;
    const previousEntities = this.currentEntityAliases;
    // The old sprites go; the old textures stay cached, so the door back is
    // a reload from memory, not a white wait on the network.
    previous?.destroy();
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
    const entities = areaEntityAtlases(this.world, area);
    const areaAtlases: EntityAtlas[] = area.id === "clubhouse"
      ? [...entities, { alias: CLUBHOUSE_PRIZES_ALIAS, src: assetUrl(this.world.arcade.atlas) }]
      : entities;
    const [next] = await Promise.all([
      AreaView.load(area, this.depth),
      ...areaAtlases.map((entry) => mipmapSheet(entry.alias, entry.src)),
    ]);
    this.areaView = next;
    const nextEntities = areaAtlases.map((entry) => entry.alias);
    this.currentEntityAliases = nextEntities;
    await this.evict(previous, next, previousEntities, nextEntities);
    for (const entry of this.glowSprites) entry.sprite.destroy();
    this.glowSprites = area.glows.map((glow) => {
      const sprite = new Sprite();
      sprite.label = `glow:${glow.id}`;
      sprite.anchor.set(0.5);
      sprite.scale.set(0.5);
      sprite.visible = false;
      sprite.blendMode = "add";
      this.glowLayer.addChild(sprite);
      return { id: glow.id, sprite };
    });
    for (const entry of this.ambientSprites) {
      entry.sprite.destroy();
      entry.shadow?.destroy();
      entry.glow?.destroy();
    }
    this.ambientSprites = ambientFor(area).map((flyer) => {
      const sprite = new Sprite();
      sprite.label = `ambient:${flyer.id}`;
      sprite.anchor.set(0.5);
      this.ambientLayer.addChild(sprite);
      let shadow: Sprite | null = null;
      if (flyer.animation.startsWith("butterfly")) {
        shadow = makeShadowSprite(this.vfx.contactShadow, `shadow:ambient:${flyer.id}`);
        shadow.visible = false;
        this.shadowLayer.addChild(shadow);
      }
      let glow: Sprite | null = null;
      if (flyer.animation === "fairy_light") {
        glow = new Sprite(this.vfx.softGlow);
        glow.label = `glow:ambient:${flyer.id}`;
        glow.anchor.set(0.5);
        glow.blendMode = "add";
        glow.visible = false;
        this.emissiveLayer.addChild(glow);
      }
      return { flyer, sprite, shadow, glow };
    });
    for (const url of next.textureUrls) this.areaTextureUrls.add(url);
    this.scene.addChildAt(next.ground, 0);
    this.paperGrain.visible = area.id !== "harness";
    this.paperGrain.width = area.width;
    this.paperGrain.height = area.height;
    this.paperGrain.position.set(0, 0);
    this.npcSprites = area.npcs.map((npc) => {
      const sprite = new Sprite();
      sprite.label = `npc:${npc.id}`;
      sprite.scale.set(0.5);
      this.depth.addChild(sprite);
      let shadow: Sprite | null = null;
      if (npc.id !== "bus-stop") {
        shadow = makeShadowSprite(this.vfx.contactShadow, `shadow:npc:${npc.id}`);
        shadow.visible = false;
        this.shadowLayer.addChild(shadow);
      }
      return { npc, sprite, shadow };
    });
    this.previousCamera = undefined;
    this.lanternTick = undefined;
    this.staticWidth = 0;
    this.effects.clearFootsteps();
    this.effects.clearStarGemGlints();
    this.effects.clearEmotes();
    this.clearCompanionActions();
    this.effects.hideClubhouseDisplay();
  }

  // Unloads what a crossing displaced: everything resident that is neither
  // the new area's art nor the one just left's. The area just left then
  // becomes the resident one, so at most a current + previous pair of areas
  // ever stays in the cache (spec 4, texture budget).
  private async evict(
    previous: AreaView | undefined,
    next: AreaView,
    previousEntities: readonly string[],
    nextEntities: readonly string[],
  ): Promise<void> {
    const previousUrls = new Set(previous?.textureUrls ?? []);
    const evictions = this.residentUrls.filter((url) =>
      !next.textureUrls.includes(url) && !previousUrls.has(url));
    for (const url of evictions) this.areaTextureUrls.delete(url);
    this.residentUrls = previous?.textureUrls ?? [];
    const keepEntities = new Set([...previousEntities, ...nextEntities]);
    const entityEvictions = this.residentEntityAliases.filter(
      (alias) => !keepEntities.has(alias) && !this.permanentAliases.has(alias),
    );
    this.residentEntityAliases = previousEntities;
    const unloadKeys = [...evictions, ...entityEvictions];
    if (unloadKeys.length > 0)
      await Promise.all(unloadKeys.map((key) => Assets.unload(key)));
  }

  // Warms an area's art without touching the shown one. The warmed URLs join
  // `areaTextureUrls` so the harness sees them cached; a failed prefetch says
  // nothing the arrival's own load won't say louder.
  prefetch(area: Area): void {
    const entities = areaEntityAtlases(this.world, area);
    const areaAtlases: EntityAtlas[] = area.id === "clubhouse"
      ? [...entities, { alias: CLUBHOUSE_PRIZES_ALIAS, src: assetUrl(this.world.arcade.atlas) }]
      : entities;
    void Promise.all([
      AreaView.prefetch(area).then((urls) => {
        for (const url of urls) this.areaTextureUrls.add(url);
      }),
      ...areaAtlases.map((entry) => mipmapSheet(entry.alias, entry.src)),
    ]).catch(() => {});
  }

  // Where everyone in the depth layer is drawn, in world units.
  private figures(): Rect[] {
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
        const anchorX =
          sprite.scale.x < 0 ? 1 - sprite.anchor.x : sprite.anchor.x;
        const anchorY =
          sprite.scale.y < 0 ? 1 - sprite.anchor.y : sprite.anchor.y;
        const x0 = sprite.x - anchorX * width;
        const y0 = sprite.y - anchorY * height;
        return { x0, y0, x1: x0 + width, y1: y0 + height };
      });
  }

  resize(width: number, height: number): void {
    this.viewWidth = Math.max(960, Math.min(1600, (720 * width) / height));
    this.viewHeight = 720;
  }

  private clearCompanionActions(): void {
    this.petReaction = null;
    this.restingSpot = null;
  }

  triggerPet(id: string, tick: number): void {
    this.petReaction = { id, startTick: tick };
  }

  setResting(spot: RestSpot | null, tick: number): void {
    this.restingSpot = spot === null ? null : { spot, startTick: tick };
  }

  isResting(): boolean {
    return this.restingSpot !== null;
  }

  private activePetReaction(state: State): { id: string; elapsed: number } | null {
    if (this.petReaction === null) return null;
    const overworldClear =
      state.battle === null &&
      state.arcade === null &&
      state.dialogue === null &&
      state.transition === null &&
      !state.journalOpen &&
      state.finale === null;
    const elapsed = state.tick - this.petReaction.startTick;
    if (!overworldClear || elapsed < 0 || elapsed >= PET_REACTION_DURATION) {
      this.petReaction = null;
      return null;
    }
    return { id: this.petReaction.id, elapsed };
  }

  private activeRestSpot(state: State): { spot: RestSpot; elapsed: number } | null {
    if (this.restingSpot === null) return null;
    const overworldClear =
      state.battle === null &&
      state.arcade === null &&
      state.dialogue === null &&
      state.transition === null &&
      !state.journalOpen &&
      state.finale === null &&
      !state.motion.moving &&
      state.area === this.restingSpot.spot.area;
    const elapsed = state.tick - this.restingSpot.startTick;
    if (!overworldClear || elapsed < 0) {
      this.restingSpot = null;
      return null;
    }
    return { spot: this.restingSpot.spot, elapsed };
  }

  resetCamera(): void {
    this.previousCamera = undefined;
    this.effects.clearFootsteps();
    this.effects.clearEmotes();
    this.clearCompanionActions();
  }

  loadedAreaId(): string {
    return this.areaView?.area.id ?? "";
  }

  setPhotoMode(on: boolean): void {
    this.photoMode = on;
    if (this.label !== undefined) this.label.visible = !on;
  }

  isPhotoMode(): boolean {
    return this.photoMode;
  }

  private drawStatic(width: number, height: number, paper: number): void {
    const scale = Math.min(width / this.viewWidth, height / this.viewHeight);
    const letterboxX = (width - this.viewWidth * scale) / 2;
    const letterboxY = (height - this.viewHeight * scale) / 2;
    const viewW = this.viewWidth * scale;
    const viewH = this.viewHeight * scale;
    this.viewportRect = { x: letterboxX, y: letterboxY, width: viewW, height: viewH };
    this.effects.invalidateTimeOfDay();
    this.background.clear().rect(0, 0, width, height).fill(0xf8edcf);
    this.paper.clear().rect(letterboxX, letterboxY, viewW, viewH).fill(paper);
    this.viewportMask.clear().rect(letterboxX, letterboxY, viewW, viewH).fill(0xffffff);
    this.lanternTint.clear().rect(letterboxX, letterboxY, viewW, viewH).fill(0x140a2e);
    this.fade.clear().rect(letterboxX, letterboxY, viewW, viewH).fill(paper);
    this.fade.alpha = 0;
    this.staticWidth = width;
    this.staticHeight = height;
    this.staticPaper = paper;
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

  private renderParty(
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

  render(
    state: State,
    width: number,
    height: number,
    resolution: number,
    options?: RenderOptions,
  ): void {
    const area = this.world.areas[state.area];
    if (area === undefined) return;
    this.resize(width, height);
    const loaded = this.areaView;
    if (loaded === undefined || loaded.area.id !== area.id) {
      this.drawStatic(width, height, loaded?.paper ?? 0xf8edcf);
      this.fade.alpha = 1;
      return;
    }
    if (
      width !== this.staticWidth ||
      height !== this.staticHeight ||
      this.staticPaper !== loaded.paper
    )
      this.drawStatic(width, height, loaded.paper);
    const paused = options?.paused ?? false;
    const reducedMotion = isReducedMotionActive();
    const previousState = options?.previousState;
    const canInterpolate = !paused &&
      previousState !== undefined &&
      previousState.area === state.area &&
      state.transition === null;
    const alpha = canInterpolate ? Math.max(0, Math.min(1, options?.alpha ?? 1)) : 1;
    const playerPos = canInterpolate
      ? interpolatePoint(previousState.player, state.player, alpha)
      : state.player;
    const snapCamera = paused ||
      reducedMotion ||
      this.previousCamera === undefined ||
      state.transition !== null ||
      area.id === "harness";
    const scale = Math.min(width / this.viewWidth, height / this.viewHeight);
    const camera = smoothFollowCamera(
      this.previousCamera,
      playerPos,
      state.facing,
      { width: this.viewWidth, height: this.viewHeight },
      area,
      { x: 80, y: 60 },
      snapCamera,
    );
    this.previousCamera = camera;
    const letterboxX = (width - this.viewWidth * scale) / 2;
    const letterboxY = (height - this.viewHeight * scale) / 2;
    const offsetX =
      Math.round((letterboxX - camera.x * scale) * resolution) / resolution;
    const offsetY =
      Math.round((letterboxY - camera.y * scale) * resolution) / resolution;
    const zoom = area.id === "harness" || reducedMotion
      ? 1
      : transitionZoom(state.transition, this.world.tunables.doorFadeTicks);
    const zoomScale = scale * zoom;
    const centerX = width / 2;
    const centerY = height / 2;
    const zoomOffsetX = zoom === 1 ? offsetX : centerX + (offsetX - centerX) * zoom;
    const zoomOffsetY = zoom === 1 ? offsetY : centerY + (offsetY - centerY) * zoom;
    this.scene.scale.set(zoomScale);
    this.scene.position.set(zoomOffsetX, zoomOffsetY);
    this.lanternWorld.scale.set(zoomScale);
    this.lanternWorld.position.set(zoomOffsetX, zoomOffsetY);
    this.emissiveLayer.scale.set(zoomScale);
    this.emissiveLayer.position.set(zoomOffsetX, zoomOffsetY);
    this.glowLayer.scale.set(zoomScale);
    this.glowLayer.position.set(zoomOffsetX, zoomOffsetY);
    const indoor = INDOOR_AREAS.has(area.id);
    const shadowAlpha = indoor ? 0.24 : 0.3;
    const livingMotion = area.id !== "harness" && !reducedMotion;
    const activePet = this.activePetReaction(state);
    const activeRest = this.activeRestSpot(state);
    this.shadowLayer.visible = area.id !== "harness";
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
    this.effects.updateFootsteps(state, area.id, playerPos, reducedMotion);
    this.renderParty(
      state,
      shadowAlpha,
      canInterpolate ? previousState : undefined,
      alpha,
      livingMotion,
      activePet,
    );
    this.renderCritters(
      state,
      shadowAlpha,
      canInterpolate ? previousState : undefined,
      alpha,
      livingMotion,
    );
    this.renderNpcs(state, shadowAlpha, livingMotion);
    this.effects.renderClubhouseDisplay(state, area, reducedMotion);
    this.renderAmbient(state, area, reducedMotion);
    this.effects.renderEmotes(
      state,
      area,
      playerPos,
      canInterpolate ? previousState : undefined,
      alpha,
      activePet,
      activeRest,
    );
    this.effects.renderTimeOfDay(state, this.viewportRect);
    this.renderGlows(state, playerPos, paused);
    this.effects.updateStarGemGlints(state, reducedMotion);
    this.atmosphere.update(
      area.id,
      area.width,
      area.height,
      state.tick,
      state.battle === null && state.arcade === null,
      this.lanternBlend,
      this.storyAtmosphereOptions(area.id, state, reducedMotion),
    );
    loaded.update(
      this.world,
      state.ink,
      state.player,
      state.tick,
      this.figures(),
    );
    const overworldVisible = this.battleView.render({
      state,
      areaView: loaded,
      width,
      height,
      viewWidth: this.viewWidth,
      viewHeight: this.viewHeight,
      reducedMotion,
    });
    this.viewport.visible = overworldVisible;
    this.scene.visible = overworldVisible;
    this.depth.sortChildren();
    if (this.label !== undefined) {
      this.label.visible = !this.photoMode;
      this.label.text =
        `Cloverhollow • tick ${state.tick} · ` +
        `${Math.round(state.player.x)},${Math.round(state.player.y)}`;
      if (state.battle !== null)
        this.label.position.set(Math.round((width - this.label.width) / 2), 4);
      else
        this.label.position.set(20, 20);
    }
    const fade = fadeAlpha(state.transition, this.world.tunables.doorFadeTicks);
    this.fade.alpha = fade;
  }

  private storyAtmosphereOptions(
    areaId: string,
    state: State,
    reducedMotion: boolean,
  ): AtmosphereOptions | undefined {
    const clubhouseBloom =
      areaId === "clubhouse" &&
      (this.world.storyVariable(state.ink, "garden_sprouted") === true ||
        this.world.storyVariable(state.ink, "garden_ripe") === true);
    const cafeCinnamonSteam =
      areaId === "cafe" &&
      this.world.storyVariable(state.ink, "spice_returned") === true &&
      (this.world.storyVariable(state.ink, "buster_reward") === true ||
        state.critters["taco-chef"] === "calm" ||
        state.stickers.includes("taco-chef"));
    const plazaStarGlow =
      areaId === "plaza" &&
      this.world.storyVariable(state.ink, "buster_reward") === true;
    const passHearthWisps =
      areaId === "pass" &&
      this.world.storyVariable(state.ink, "sanctuary_gift") === true;
    if (
      !clubhouseBloom &&
      !cafeCinnamonSteam &&
      !plazaStarGlow &&
      !passHearthWisps &&
      !reducedMotion
    ) {
      return undefined;
    }
    return {
      ...(clubhouseBloom ? { clubhouseBloom: true } : {}),
      ...(cafeCinnamonSteam ? { cafeCinnamonSteam: true } : {}),
      ...(plazaStarGlow ? { plazaStarGlow: true } : {}),
      ...(passHearthWisps ? { passHearthWisps: true } : {}),
      ...(reducedMotion ? { reducedMotion: true } : {}),
    };
  }

  private renderGlows(state: State, playerPos: Point, snapLantern = false): void {
    const area = this.areaView?.area;
    const sheet = Assets.get<Spritesheet>("glow-sheet");
    const on = state.lantern && state.battle === null && state.arcade === null;
    this.lanternBlend = computeLanternBlend(
      this.lanternBlend,
      this.lanternTick,
      state.tick,
      on,
      snapLantern,
    );
    this.lanternTick = state.tick;

    // Blacklight: deep indigo-plum dusk clipped inside viewportMask, paired with
    // a luminous UV pool and drifting lavender motes centred on Fae.
    const showDusk = this.lanternBlend > 0.001 &&
      state.battle === null &&
      state.arcade === null;
    this.lanternLayer.visible = showDusk;
    if (showDusk) {
      this.lanternTint.alpha = 0.63 * this.lanternBlend;
      const centerX = playerPos.x;
      const centerY = playerPos.y - 46;
      this.lanternSpotlight.position.set(centerX, centerY);
      this.lanternSpotlight.alpha =
        (0.36 + 0.04 * Math.sin(state.tick / 16)) * this.lanternBlend;
      this.effects.updateLanternMotes(centerX, centerY, state.tick, this.lanternBlend);
    }

    const drawn: string[] = [];
    this.glowSprites.forEach(({ id, sprite }, index) => {
      const glow = area?.glows.find((item) => item.id === id);
      const texture =
        glow === undefined ? undefined : sheet?.textures[glow.frame];
      sprite.visible = on && glow !== undefined && texture !== undefined;
      if (texture !== undefined && glow !== undefined) {
        sprite.texture = texture;
        sprite.position.set(glow.point.x, glow.point.y);
        const transform = computeGlowTransform(
          glow, state.player, state.tick, index, this.lanternBlend,
        );
        sprite.scale.set(transform.scaleX, transform.scaleY);
        sprite.alpha = transform.alpha;
        if (sprite.visible) drawn.push(id);
      }
    });
    this.drawnGlows = drawn;
  }

  private renderAmbient(state: State, area: Area, reducedMotion: boolean): void {
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
    const frames: { id: string; x: number; y: number; frame: number }[] = [];
    for (const { flyer, sprite, shadow, glow } of this.ambientSprites) {
      const names = sheet?.data.animations?.[flyer.animation] ?? [];
      const position = flyerAt(flyer, state.tick, Math.max(1, names.length));
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
      const visual = computeFlyerVisual(flyer, position, state.tick, reducedMotion);
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

  // People in the area, y-sorted with everyone else. They face Fae while she
  // talks to them; without a frame for that facing (Mom has no back view)
  // they show their front. idle_down steps through the character's idleTicks.
  private renderNpcs(
    state: State,
    shadowAlpha: number,
    livingMotion: boolean,
  ): void {
    const frames: { id: string; frame: string; facing: string }[] = [];
    for (const [npcIndex, { npc, sprite, shadow }] of this.npcSprites.entries()) {
      // Someone the story has sent away or hasn't calmed yet isn't drawn (spec 6).
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
      const facing = npcFacing(state, npc);
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
      const pose = computeNpcPose(npc.id, npcIndex, state.tick, livingMotion);
      sprite.scale.set((mirror ? -s : s) * pose.scaleX, s * pose.scaleY);
      sprite.position.set(npc.point.x + pose.offsetX, npc.point.y + pose.offsetY);
      sprite.rotation = pose.rotation;
      sprite.zIndex = npc.point.y;
      if (shadow !== null) {
        applyShadow(shadow, computeNpcShadow(npc.id, npc.point, pose, shadowAlpha));
      }
      frames.push({ id: npc.id, frame: name, facing });
    }
    this.npcFrames = frames;
  }

  // Overworld critters: chaos (with the pulsing aura behind) or calm, y-sorted
  // with Fae, her party, and props, their figures overworldHeight tall.
  // Who is out can change in an area (a rest rolls it again, a set piece
  // comes and goes), so the sprites follow the present critters' keys.
  private renderCritters(
    state: State,
    shadowAlpha: number,
    previousState: State | undefined,
    alpha: number,
    livingMotion: boolean,
  ): void {
    const present =
      this.areaView === undefined ? [] : presentCritters(this.world, state);
    const keys = present
      .map((critter) => `${critter.key}=${critter.kind.id}`)
      .join("|");
    if (keys !== this.critterKeys) {
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
        this.depth.addChild(aura, body);
        this.shadowLayer.addChild(shadow);
        return { id: critter.key, body, aura, shadow };
      });
    }
    const frames: {
      id: string;
      kind: string;
      frame: string;
      x: number;
      y: number;
    }[] = [];
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
      aura.alpha = 0.65 + Math.sin(state.tick / 18) * 0.2;
      aura.rotation = state.tick / 180;
      frames.push({ id, kind: content.id, frame, x: logicalPoint.x, y: logicalPoint.y });
    }
    this.critterFrames = frames;
  }

  /** Fae's current feet anchor in CSS pixels, or null before the first render. */
  playerScreenPoint(state: State): Point | null {
    if (this.previousCamera === undefined) return null;
    return worldToScreen(
      state.player,
      this.previousCamera,
      this.viewWidth,
      this.viewHeight,
      window.innerWidth,
      window.innerHeight,
    );
  }

  /** The interaction prompt for this frame, anchored at the target in CSS px. */
  promptView(state: State): {
    visible: boolean;
    label: string;
    x: number;
    y: number;
  } {
    const target = targetInteractable(this.world, state);
    if (target === undefined || this.previousCamera === undefined)
      return { visible: false, label: "", x: 0, y: 0 };
    const point = worldToScreen(
      target.point,
      this.previousCamera,
      this.viewWidth,
      this.viewHeight,
      window.innerWidth,
      window.innerHeight,
    );
    return {
      visible: true,
      label: (target.prompt ?? "Look").toUpperCase(),
      x: point.x,
      y: point.y,
    };
  }

  /**
   * The recurring critters' "?" and "!" (spec 8.1), each at the bottom
   * centre of where it hangs, just over the critter's head, in CSS px. None
   * outside free walking (a battle, a talk, the journal, a door's fade).
   */
  noticeMarks(state: State): { key: string; mark: "?" | "!"; x: number; y: number }[] {
    const camera = this.previousCamera;
    if (camera === undefined || state.battle !== null || state.dialogue !== null ||
      state.arcade !== null || state.journalOpen || state.transition !== null) return [];
    return wildMarks(this.world, state).flatMap((item) => {
      const kind = this.world.critters[item.kind];
      if (kind === undefined) return [];
      const head = { x: item.point.x, y: item.point.y - kind.overworldHeight - 6 };
      const point = worldToScreen(head, camera, this.viewWidth, this.viewHeight,
        window.innerWidth, window.innerHeight);
      return [{ key: item.key, mark: item.mark, x: point.x, y: point.y }];
    });
  }

  battleCheckGeometry(state: State, width: number, height: number): BattleCheckGeometry | null {
    return this.battleView.battleCheckGeometry(
      state,
      width,
      height,
      this.viewWidth,
      this.viewHeight,
    );
  }

  battleFeelingAnchor(state: State, width: number, height: number): Point | null {
    return this.battleView.battleFeelingAnchor(
      state,
      width,
      height,
      this.viewWidth,
      this.viewHeight,
    );
  }

  renderInfo(state: State): {
    area: string;
    finale: State["finale"];
    credits: { entries: CreditEntry[] } | null;
    drawOrder: { label: string; zIndex: number }[];
    animation: string;
    frame: number;
    // Each party member in party order: how hidden it is behind its leader,
    // and its current animation and frame.
    party: { id: string; hidden: number; animation: string; frame: number }[];
    fade: number;
    cachedAreaTextures: string[];
    prompt: { visible: boolean; label: string; x: number; y: number };
    dialogue: {
      open: boolean;
      speaker: string | null;
      revealed: number;
      length: number;
      choices: string[];
      selected: number;
    };
    critters: {
      id: string;
      kind: string;
      frame: string;
      x: number;
      y: number;
    }[];
    npcs: { id: string; frame: string; facing: string }[];
    ambient: { id: string; x: number; y: number; frame: number }[];
    // Each canopy's alpha: below 1 while Fae is behind it.
    canopies: { id: string; alpha: number }[];
    // Each prop's current state, whether it lies flat (drawn under everyone)
    // or is hidden (not there), and its strips: world x range and the y it
    // sorts by (spec 6).
    props: {
      id: string;
      state: string;
      flat: boolean;
      hidden: boolean;
      strips: { left: number; right: number; zIndex: number }[];
    }[];
    lantern: { on: boolean; glows: string[] };
    // The recurring critters' "?" and "!" over their heads (Milestone 51).
    marks: { key: string; mark: "?" | "!"; x: number; y: number }[];
    clubhouseDisplay: number;
    atmosphereParticles: number;
    footstepPuffs: number;
    starGemGlints: number;
    petting: string | null;
    resting: string | null;
    timeOfDay: TimeOfDayPhase;
    photoMode: boolean;
    battle: BattleRenderInfo;
  } {
    const fade = fadeAlpha(state.transition, this.world.tunables.doorFadeTicks);
    return {
      area: this.areaView?.area.id ?? "",
      finale: state.finale,
      credits: state.finale === "credits"
        ? { entries: creditEntries(this.world, state) }
        : null,
      drawOrder: this.depth.children
        .filter((child) => child.visible)
        .map((child) => ({
          label: child.label,
          zIndex: child.zIndex,
        })),
      animation: this.currentAnimation,
      frame: this.currentFrame,
      party: this.partyFrames.map((frames, index) => {
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
      }),
      fade,
      cachedAreaTextures: [...this.areaTextureUrls].filter((url) =>
        Assets.cache.has(url),
      ),
      prompt: this.promptView(state),
      dialogue: {
        open: state.dialogue !== null,
        speaker: state.dialogue?.speaker ?? null,
        revealed: state.dialogue?.revealed ?? 0,
        length: state.dialogue?.text.length ?? 0,
        choices: state.dialogue?.choices ?? [],
        selected: state.dialogue?.selected ?? 0,
      },
      critters: this.critterFrames,
      npcs: this.npcFrames,
      ambient: this.ambientFrames,
      canopies: this.areaView?.canopyAlphas ?? [],
      props: this.areaView?.propInfo ?? [],
      lantern: {
        on: state.lantern && state.battle === null,
        glows: this.drawnGlows.slice(),
      },
      marks: this.noticeMarks(state),
      clubhouseDisplay: this.effects.clubhouseDisplayCount,
      atmosphereParticles: this.atmosphere.activeCount,
      footstepPuffs: this.effects.footstepPuffCount,
      starGemGlints: this.effects.starGemGlintCount,
      petting: this.activePetReaction(state)?.id ?? null,
      resting: this.activeRestSpot(state)?.spot.id ?? null,
      timeOfDay: storyTimeOfDay(this.world, state).phase,
      photoMode: this.photoMode,
      battle: this.battleView.renderInfo(
        state,
        window.innerWidth,
        window.innerHeight,
        this.viewWidth,
        this.viewHeight,
        this.scene.visible,
      ),
    };
  }
}
