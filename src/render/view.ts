import {
  Assets,
  Container,
  Graphics,
  Sprite,
  Spritesheet,
  Text,
  TilingSprite,
  type Renderer,
} from "pixi.js";
import {
  targetInteractable,
  wildMarks,
  creditEntries,
  type Area,
  type CreditEntry,
  type Point,
  type State,
  type World,
} from "../core";
import { AreaView } from "./area-view";
import { interpolatePoint, smoothFollowCamera, worldToScreen } from "./camera";
import { assetUrl } from "../platform/assets";
import { isReducedMotionActive } from "../platform/reduced-motion";
import { fadeAlpha, transitionZoom } from "./fade";
import { createVfxTextures, type VfxTextures } from "./vfx-textures";
import { BiomeAtmosphere, type AtmosphereOptions } from "./atmosphere";
import type { RestSpot } from "./companions";
import { storyTimeOfDay, type TimeOfDayPhase } from "./time-of-day";
import {
  BattleViewController,
  type BattleCheckGeometry,
  type BattleCheckInfo,
  type BattleRenderInfo,
} from "./battle-view";
import {
  OverworldEntityLayer,
  type AmbientFrameInfo,
  type CritterFrameInfo,
  type NpcFrameInfo,
  type PartyFrameInfo,
} from "./entity-layer";
import {
  CLUBHOUSE_PRIZES_ALIAS,
  OverworldEffectsController,
} from "./overworld-effects";
import {
  areaEntityAtlases,
  computeGlowTransform,
  computeLanternBlend,
  INDOOR_AREAS,
  PET_REACTION_DURATION,
  type EntityAtlas,
} from "./overworld-render";

export { areaEntityAtlases, type BattleCheckGeometry, type BattleCheckInfo, type EntityAtlas };

export type RenderOptions = {
  paused?: boolean;
  alpha?: number;
  previousState?: State;
};

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
  private readonly entities: OverworldEntityLayer;
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
  private glowSprites: { id: string; sprite: Sprite }[] = [];
  private drawnGlows: string[] = [];
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

    this.shadowLayer.label = "shadows";
    this.depth.sortableChildren = true;
    this.entities = new OverworldEntityLayer(this.world, this.vfx, {
      depth: this.depth,
      shadowLayer: this.shadowLayer,
      ambientLayer: this.ambientLayer,
      emissiveLayer: this.emissiveLayer,
    });

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
    this.entities.clearArea();
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
    this.entities.mountAmbient(area);
    for (const url of next.textureUrls) this.areaTextureUrls.add(url);
    this.scene.addChildAt(next.ground, 0);
    this.paperGrain.visible = area.id !== "harness";
    this.paperGrain.width = area.width;
    this.paperGrain.height = area.height;
    this.paperGrain.position.set(0, 0);
    this.entities.mountNpcs(area);
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
    this.entities.renderPlayer(state, playerPos, shadowAlpha, livingMotion, activeRest, activePet);
    this.effects.updateFootsteps(state, area.id, playerPos, reducedMotion);
    this.entities.renderParty(
      state,
      shadowAlpha,
      canInterpolate ? previousState : undefined,
      alpha,
      livingMotion,
      activePet,
    );
    this.entities.renderCritters(
      state,
      this.areaView !== undefined,
      shadowAlpha,
      canInterpolate ? previousState : undefined,
      alpha,
      livingMotion,
      reducedMotion,
    );
    this.entities.renderNpcs(state, shadowAlpha, livingMotion);
    this.effects.renderClubhouseDisplay(state, area, reducedMotion);
    this.entities.renderAmbient(state, area, reducedMotion);
    this.effects.renderEmotes(
      state,
      area,
      playerPos,
      canInterpolate ? previousState : undefined,
      alpha,
      activePet,
      activeRest,
      reducedMotion,
    );
    this.effects.renderTimeOfDay(state, this.viewportRect);
    this.renderGlows(state, playerPos, paused, reducedMotion);
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
      this.entities.figures(),
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

  private renderGlows(
    state: State,
    playerPos: Point,
    snapLantern = false,
    reducedMotion = false,
  ): void {
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
        (reducedMotion ? 0.36 : 0.36 + 0.04 * Math.sin(state.tick / 16)) * this.lanternBlend;
      this.effects.updateLanternMotes(
        centerX, centerY, state.tick, this.lanternBlend, reducedMotion,
      );
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
          glow, state.player, state.tick, index, this.lanternBlend, reducedMotion,
        );
        sprite.scale.set(transform.scaleX, transform.scaleY);
        sprite.alpha = transform.alpha;
        if (sprite.visible) drawn.push(id);
      }
    });
    this.drawnGlows = drawn;
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
    party: PartyFrameInfo[];
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
    critters: CritterFrameInfo[];
    npcs: NpcFrameInfo[];
    ambient: AmbientFrameInfo[];
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
      animation: this.entities.animation,
      frame: this.entities.frame,
      party: this.entities.partyInfo(state),
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
      critters: this.entities.critters,
      npcs: this.entities.npcs,
      ambient: this.entities.ambient,
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
