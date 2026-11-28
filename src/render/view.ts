import {
  Assets, Container, Graphics, Sprite, Spritesheet, Text, type Renderer,
} from "pixi.js";
import {
  creditEntries, type Area, type NavField, type Point, type State, type World,
} from "../core";
import { AreaView } from "./area-view";
import { CameraDirector, screenToWorld, worldToScreen } from "./camera";
import { assetUrl } from "../platform/assets";
import { isReducedMotionActive } from "../platform/reduced-motion";
import { fadeAlpha } from "./fade";
import { PaperGrainOverlay, syncPresentationTelemetry } from "./paper-grain";
import { createVfxTextures, type VfxTextures } from "./vfx-textures";
import { BiomeAtmosphere } from "./atmosphere";
import {
  AreaRestorationRenderer, RESTORATION_ATLAS_ALIAS, RESTORATION_ATLAS_URL,
} from "./restoration";
import type { RestSpot } from "./companions";
import { storyTimeOfDay } from "./time-of-day";
import {
  BattleViewController, type BattleCheckGeometry, type BattleCheckInfo,
} from "./battle-view";
import { OverworldEntityLayer } from "./entity-layer";
import { NpcLifeController, type NpcLifeRenderInfo } from "./npc-life";
import { NavOverlayController } from "./nav-overlay";
import { CLUBHOUSE_PRIZES_ALIAS, OverworldEffectsController } from "./overworld-effects";
import type { NavPathSnapshot } from "../shell/nav-steer";
import type { NpcChatterView } from "../ui/npc-chatter";
import {
  areaEntityAtlases, computeGlowTransform, INDOOR_AREAS, type EntityAtlas,
} from "./overworld-render";
import {
  computeAreaEvictions, computeDialogueRenderInfo, computeLanternVisuals,
  computeNoticeMarkViews, computeNpcChatterScreenAnchor,
  computePromptScreenView, computeStoryAtmosphereOptions, computeViewportRect,
  resolveActivePetReaction, resolveActiveRestSpot, type GameViewRenderInfo,
  type NoticeMarkView, type PromptScreenView, type ViewportRect,
} from "./view-projections";

export {
  areaEntityAtlases, type BattleCheckGeometry, type BattleCheckInfo,
  type EntityAtlas, type GameViewRenderInfo,
};

export type RenderOptions = { paused?: boolean; alpha?: number; previousState?: State };

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
  private readonly restoration: AreaRestorationRenderer;
  private readonly effects: OverworldEffectsController;
  private readonly entities: OverworldEntityLayer;
  private readonly npcLife: NpcLifeController;
  private readonly navOverlay = new NavOverlayController();
  private navField: NavField | null = null;
  private navSnapshot: NavPathSnapshot | null = null;
  private readonly background = new Graphics();
  private readonly paper = new Graphics();
  private readonly fade = new Graphics();
  private readonly viewport = new Container();
  private readonly scene = new Container();
  private readonly shadowLayer = new Container();
  private readonly paperGrain: PaperGrainOverlay;
  private viewportRect: ViewportRect = { x: 0, y: 0, width: 0, height: 0 };
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
  private readonly cameraDirector = new CameraDirector();
  private staticWidth = 0;
  private staticHeight = 0;
  private staticPaper = 0;
  private staticFadeColor = 0xf8edcf;
  private staticFadeFull = false;
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
    this.restoration = new AreaRestorationRenderer(this.vfx);
    this.emissiveLayer.label = "emissive";
    this.emissiveLayer.addChild(this.atmosphere.emissive);
    this.effects = new OverworldEffectsController(
      this.world,
      this.vfx,
      this.depth,
      this.emissiveLayer,
    );
    this.battleView = new BattleViewController(this.world, this.vfx, options.renderer);
    this.paperGrain = new PaperGrainOverlay(this.vfx.paperGrain);

    this.shadowLayer.label = "shadows";
    this.depth.sortableChildren = true;
    this.entities = new OverworldEntityLayer(this.world, this.vfx, {
      depth: this.depth,
      shadowLayer: this.shadowLayer,
      ambientLayer: this.ambientLayer,
      emissiveLayer: this.emissiveLayer,
    });
    this.npcLife = new NpcLifeController(this.world, this.vfx);

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
      RESTORATION_ATLAS_ALIAS,
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
      this.battleView.root,
      this.paperGrain.stageSprite,
      this.fade,
    );
    this.scene.addChild(
      this.restoration.groundLayer,
      this.shadowLayer,
      this.effects.grassLayer,
      this.effects.footstepLayer,
      this.navOverlay.groundLayer,
      this.atmosphere.under,
      this.depth,
      this.ambientLayer,
      this.atmosphere.over,
      this.restoration.fxLayer,
      this.npcLife.reactionLayer,
      this.effects.emoteLayer,
      this.paperGrain.sceneSprite,
      this.navOverlay.debugLayer,
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
      mipmapSheet(RESTORATION_ATLAS_ALIAS, assetUrl(RESTORATION_ATLAS_URL)),
      // The toys a catch throws are cropped from this sheet by the DOM
      // overlay, which reads their frames here.
      mipmapSheet(this.world.battle.toyAtlas, assetUrl(this.world.battle.toyAtlas)),
    ]);
  }

  private areaAtlasesFor(area: Area): EntityAtlas[] {
    const entities = areaEntityAtlases(this.world, area);
    return area.id === "clubhouse"
      ? [...entities, { alias: CLUBHOUSE_PRIZES_ALIAS, src: assetUrl(this.world.arcade.atlas) }]
      : entities;
  }

  async setArea(area: Area): Promise<void> {
    const previous = this.areaView;
    const previousEntities = this.currentEntityAliases;
    // The old sprites go; the old textures stay cached, so the door back is
    // a reload from memory, not a white wait on the network.
    previous?.destroy();
    this.entities.clearArea();
    const areaAtlases = this.areaAtlasesFor(area);
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
    this.paperGrain.mountArea(area);
    this.entities.mountNpcs(area);
    this.cameraDirector.reset();
    this.lanternTick = undefined;
    this.staticWidth = 0;
    this.effects.clearFootsteps();
    this.effects.clearGrassTufts();
    this.effects.clearStarGemGlints();
    this.effects.clearEmotes();
    this.restoration.clear();
    this.npcLife.clear();
    this.navOverlay.clearArea();
    this.navField = null;
    this.navSnapshot = null;
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
    const { evictedUrls, unloadKeys } = computeAreaEvictions({
      residentUrls: this.residentUrls,
      previousUrls: previous?.textureUrls ?? [],
      nextUrls: next.textureUrls,
      residentEntityAliases: this.residentEntityAliases,
      previousEntities,
      nextEntities,
      permanentAliases: this.permanentAliases,
    });
    for (const url of evictedUrls) this.areaTextureUrls.delete(url);
    this.residentUrls = previous?.textureUrls ?? [];
    this.residentEntityAliases = previousEntities;
    if (unloadKeys.length > 0)
      await Promise.all(unloadKeys.map((key) => Assets.unload(key)));
  }

  // Warms an area's art without touching the shown one. The warmed URLs join
  // `areaTextureUrls` so the harness sees them cached; a failed prefetch says
  // nothing the arrival's own load won't say louder.
  prefetch(area: Area): void {
    const areaAtlases = this.areaAtlasesFor(area);
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
    const active = resolveActivePetReaction(this.petReaction, state);
    if (active === null) this.petReaction = null;
    return active;
  }

  private activeRestSpot(state: State): { spot: RestSpot; elapsed: number } | null {
    const active = resolveActiveRestSpot(this.restingSpot, state);
    if (active === null) this.restingSpot = null;
    return active;
  }

  observeNpcTick(state: State): void {
    this.npcLife.observeTick(state);
  }

  resetCamera(): void {
    this.cameraDirector.reset();
    this.effects.clearFootsteps();
    this.effects.clearGrassTufts();
    this.effects.clearEmotes();
    this.restoration.clear();
    this.npcLife.clear();
    this.clearCompanionActions();
  }

  invalidateBackdrop(): void {
    this.battleView.invalidateBackdrop();
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

  private syncFadeGraphics(width: number, height: number, paper: number, dark: boolean): void {
    const color = dark ? 0x0f0b18 : paper;
    if (
      width === this.staticWidth &&
      height === this.staticHeight &&
      color === this.staticFadeColor &&
      dark === this.staticFadeFull
    ) return;
    if (dark) {
      this.fade.clear().rect(0, 0, width, height).fill(color);
    } else {
      const { x, y, width: viewW, height: viewH } = this.viewportRect;
      this.fade.clear().rect(x, y, viewW, viewH).fill(color);
    }
    this.staticFadeColor = color;
    this.staticFadeFull = dark;
  }

  private drawStatic(width: number, height: number, paper: number, dark: boolean): void {
    const rect = computeViewportRect(width, height, this.viewWidth, this.viewHeight);
    this.viewportRect = rect;
    this.effects.invalidateTimeOfDay();
    this.background.clear().rect(0, 0, width, height).fill(0xf8edcf);
    this.paper.clear().rect(rect.x, rect.y, rect.width, rect.height).fill(paper);
    this.viewportMask.clear().rect(rect.x, rect.y, rect.width, rect.height).fill(0xffffff);
    this.lanternTint.clear().rect(rect.x, rect.y, rect.width, rect.height).fill(0x140a2e);
    const fadeColor = dark ? 0x0f0b18 : paper;
    if (dark) {
      this.fade.clear().rect(0, 0, width, height).fill(fadeColor);
    } else {
      this.fade.clear().rect(rect.x, rect.y, rect.width, rect.height).fill(fadeColor);
    }
    this.fade.alpha = 0;
    this.staticWidth = width;
    this.staticHeight = height;
    this.staticPaper = paper;
    this.staticFadeColor = fadeColor;
    this.staticFadeFull = dark;
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
    const darkFade = state.transition?.tone === "dark";
    const loaded = this.areaView;
    if (loaded === undefined || loaded.area.id !== area.id) {
      this.drawStatic(width, height, loaded?.paper ?? 0xf8edcf, darkFade);
      this.fade.alpha = 1;
      return;
    }
    if (
      width !== this.staticWidth ||
      height !== this.staticHeight ||
      this.staticPaper !== loaded.paper
    ) {
      this.drawStatic(width, height, loaded.paper, darkFade);
    } else {
      this.syncFadeGraphics(width, height, loaded.paper, darkFade);
    }
    const paused = options?.paused ?? false;
    const reducedMotion = isReducedMotionActive();
    const previousState = options?.previousState;
    const indoor = INDOOR_AREAS.has(area.id);
    const frame = this.cameraDirector.step({
      world: this.world, area, state, previousState, width, height,
      viewWidth: this.viewWidth, viewHeight: this.viewHeight, resolution,
      doorFadeTicks: this.world.tunables.doorFadeTicks, paused, reducedMotion,
      alpha: options?.alpha ?? 1, indoor,
    });
    const { canInterpolate, alpha, playerPos, zoomScale, zoomOffsetX, zoomOffsetY } = frame;
    const prev = canInterpolate ? previousState : undefined;
    for (const layer of [this.scene, this.lanternWorld, this.emissiveLayer, this.glowLayer]) {
      layer.scale.set(zoomScale);
      layer.position.set(zoomOffsetX, zoomOffsetY);
    }
    this.atmosphere.over.position.set(frame.parallaxOver.x, frame.parallaxOver.y);
    this.ambientLayer.position.set(frame.parallaxAmbient.x, frame.parallaxAmbient.y);
    const shadowAlpha = indoor ? 0.24 : 0.3;
    const livingMotion = area.id !== "harness" && !reducedMotion;
    const activePet = this.activePetReaction(state);
    const activeRest = this.activeRestSpot(state);
    this.shadowLayer.visible = area.id !== "harness";
    this.entities.renderPlayer(state, playerPos, shadowAlpha, livingMotion, activeRest, activePet);
    this.effects.updateGrassTufts(state, area, playerPos, reducedMotion, paused);
    this.effects.updateFootsteps(state, area.id, playerPos, reducedMotion);
    this.entities.renderParty(state, shadowAlpha, prev, alpha, livingMotion, activePet);
    this.entities.renderCritters(
      state, this.areaView !== undefined, shadowAlpha, prev, alpha, livingMotion, reducedMotion,
    );
    const npcLife = this.npcLife.update(state, livingMotion, reducedMotion);
    this.entities.renderNpcs(
      state, shadowAlpha, livingMotion, npcLife, this.npcLife, prev, alpha, reducedMotion,
    );
    this.npcLife.renderReactions(state, livingMotion);
    this.effects.renderClubhouseDisplay(state, area, reducedMotion);
    this.entities.renderAmbient(state, area, reducedMotion);
    this.effects.renderEmotes(
      state, area, playerPos, prev, alpha, activePet, activeRest, npcLife, reducedMotion,
    );
    this.effects.renderTimeOfDay(state, this.viewportRect);
    this.renderGlows(state, playerPos, paused, reducedMotion);
    this.effects.updateStarGemGlints(state, reducedMotion);
    this.restoration.update(this.world, state, { paused, reducedMotion });
    this.atmosphere.update(
      area.id, area.width, area.height, state.tick,
      state.battle === null && state.arcade === null, this.lanternBlend,
      computeStoryAtmosphereOptions(this.world, state, area.id, reducedMotion),
    );
    loaded.update(this.world, state.ink, state.player, state.tick, this.entities.figures());
    this.navOverlay.render(
      area, state, this.navField, this.navSnapshot, this.photoMode, reducedMotion,
    );
    const overworldVisible = this.battleView.render({
      state, areaView: loaded, width, height,
      viewWidth: this.viewWidth, viewHeight: this.viewHeight, reducedMotion,
    });
    this.battleView.root.position.set(frame.battleShake.x, frame.battleShake.y);
    this.viewport.visible = overworldVisible;
    this.scene.visible = overworldVisible;
    this.depth.sortChildren();
    this.paperGrain.update({
      areaId: area.id, paused, overworldVisible, viewportRect: this.viewportRect,
      width, height, camera: frame.camera, baseScale: frame.baseScale,
    });
    if (import.meta.env.DEV || import.meta.env.MODE === "harness") {
      syncPresentationTelemetry({
        zoom: frame.zoom, framing: frame.framing,
        shake: Math.hypot(frame.shakeOffset.x, frame.shakeOffset.y),
        grassTufts: this.effects.grassTuftCount,
        footstepKind: this.effects.lastFootstepKind ?? "none",
      });
    }
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

  private renderGlows(
    state: State,
    playerPos: Point,
    snapLantern = false,
    reducedMotion = false,
  ): void {
    const area = this.areaView?.area;
    const sheet = Assets.get<Spritesheet>("glow-sheet");
    const lantern = computeLanternVisuals(
      state, playerPos, this.lanternBlend, this.lanternTick, snapLantern, reducedMotion,
    );
    this.lanternBlend = lantern.blend;
    this.lanternTick = state.tick;
    this.lanternLayer.visible = lantern.showDusk;
    if (lantern.showDusk) {
      this.lanternTint.alpha = lantern.tintAlpha;
      this.lanternSpotlight.position.set(lantern.centerX, lantern.centerY);
      this.lanternSpotlight.alpha = lantern.spotlightAlpha;
      this.effects.updateLanternMotes(
        lantern.centerX, lantern.centerY, state.tick, lantern.blend, reducedMotion,
      );
    }

    const drawn: string[] = [];
    this.glowSprites.forEach(({ id, sprite }, index) => {
      const glow = area?.glows.find((item) => item.id === id);
      const texture = glow === undefined ? undefined : sheet?.textures[glow.frame];
      sprite.visible = lantern.on && glow !== undefined && texture !== undefined;
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
    const cam = this.cameraDirector.camera;
    if (cam === undefined) return null;
    return worldToScreen(
      state.player, cam, this.viewWidth, this.viewHeight,
      window.innerWidth, window.innerHeight, this.cameraDirector.zoom,
    );
  }

  /** Converts a CSS-pixel viewport point to world coordinates, or null before first render. */
  screenToWorldPoint(client: Point): Point | null {
    const cam = this.cameraDirector.camera;
    if (cam === undefined) return null;
    return screenToWorld(
      client, cam, this.viewWidth, this.viewHeight,
      window.innerWidth, window.innerHeight, this.cameraDirector.zoom,
    );
  }

  setNavHeatmap(visible?: boolean): boolean {
    return this.navOverlay.setHeatmapVisible(visible ?? !this.navOverlay.isHeatmapVisible());
  }

  isNavHeatmapVisible(): boolean {
    return this.navOverlay.isHeatmapVisible();
  }

  setNavOverlayData(field: NavField | null, snapshot: NavPathSnapshot | null): void {
    this.navField = field;
    this.navSnapshot = snapshot;
  }

  /** The interaction prompt for this frame, anchored at the target in CSS px. */
  promptView(state: State): PromptScreenView {
    return computePromptScreenView(
      this.world, state, this.cameraDirector.camera, this.viewWidth, this.viewHeight,
      window.innerWidth, window.innerHeight,
    );
  }

  /** Latest living-NPC snapshot summary for overworld tool-event feedback. */
  npcLifeInfo(): NpcLifeRenderInfo | null {
    return this.npcLife.latest === null ? null : this.npcLife.renderInfo();
  }

  /** The active ambient NPC chatter bubble projected into CSS px, or null when hidden. */
  npcChatterScreen(
    state: State,
    viewportWidth: number,
    viewportHeight: number,
    suppressNpcId: string | null,
  ): NpcChatterView | null {
    return computeNpcChatterScreenAnchor(
      this.world, state, this.npcLife.latest?.chatter ?? null, suppressNpcId,
      this.cameraDirector.camera, this.viewWidth, this.viewHeight, viewportWidth, viewportHeight,
    );
  }

  /** The recurring critters' "?" and "!" marks over their heads in CSS px. */
  noticeMarks(state: State): NoticeMarkView[] {
    return computeNoticeMarkViews(
      this.world, state, this.cameraDirector.camera, this.viewWidth, this.viewHeight,
      window.innerWidth, window.innerHeight,
    );
  }

  battleCheckGeometry(state: State, width: number, height: number): BattleCheckGeometry | null {
    return this.battleView.battleCheckGeometry(state, width, height, this.viewWidth,
      this.viewHeight);
  }

  battleFeelingAnchor(state: State, width: number, height: number): Point | null {
    return this.battleView.battleFeelingAnchor(state, width, height, this.viewWidth,
      this.viewHeight);
  }

  renderInfo(state: State): GameViewRenderInfo {
    const fade = fadeAlpha(state.transition, this.world.tunables.doorFadeTicks);
    return {
      area: this.areaView?.area.id ?? "",
      finale: state.finale,
      credits: state.finale === "credits" ? { entries: creditEntries(this.world, state) } : null,
      drawOrder: this.depth.children
        .filter((child) => child.visible)
        .map((child) => ({ label: child.label, zIndex: child.zIndex })),
      animation: this.entities.animation,
      frame: this.entities.frame,
      party: this.entities.partyInfo(state),
      fade,
      cachedAreaTextures: [...this.areaTextureUrls].filter((url) => Assets.cache.has(url)),
      prompt: this.promptView(state),
      dialogue: computeDialogueRenderInfo(state),
      critters: this.entities.critters,
      npcs: this.entities.npcs,
      npcLife: this.npcLife.renderInfo(),
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
        state, window.innerWidth, window.innerHeight,
        this.viewWidth, this.viewHeight, this.scene.visible,
      ),
    };
  }
}
