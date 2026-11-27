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
  surfaceAt,
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
import { BiomeAtmosphere } from "./atmosphere";
import { evaluateOverworldEmotes } from "./emotes";
import { evaluateClubhouseDisplay } from "./clubhouse-display";
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
  areaEntityAtlases,
  computeCompanionEmoteSpecs,
  computeCritterShadow,
  computeFaePose,
  computeGlowTransform,
  computeLanternBlend,
  computeLanternMote,
  computeNpcOverworldHeight,
  computeNpcPose,
  computeNpcShadow,
  computeOverworldEmoteInputs,
  computePartyFollowerTransform,
  computeRoamerBobAndFacing,
  INDOOR_AREAS,
  LANTERN_MOTE_COUNT,
  LANTERN_MOTE_TINTS,
  liftShadowScale,
  PET_REACTION_DURATION,
  resolveNpcTextureFrame,
  spawnFootstepPuffs,
  type EntityAtlas,
  type FootstepPuff,
  type ShadowTransform,
} from "./overworld-render";

export { areaEntityAtlases, type BattleCheckGeometry, type BattleCheckInfo, type EntityAtlas };

export type RenderOptions = {
  paused?: boolean;
  alpha?: number;
  previousState?: State;
};

const FOOTSTEP_POOL_SIZE = 24;
const EMOTE_POOL_SIZE = 24;
const CLUBHOUSE_PRIZES_ALIAS = "clubhouse-prizes";

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
  private readonly background = new Graphics();
  private readonly paper = new Graphics();
  private readonly fade = new Graphics();
  private readonly viewport = new Container();
  private readonly scene = new Container();
  private readonly shadowLayer = new Container();
  private readonly footstepLayer = new Container();
  private readonly footstepSprites: Sprite[] = [];
  private footstepPuffs: FootstepPuff[] = [];
  private lastFootstepArea = "";
  private lastFootstepTick: number | undefined;
  private lastFootstepStride: number | undefined;
  private readonly paperGrain: TilingSprite;
  private readonly timeOfDayLayer = new Container();
  private readonly timeOfDayTint = new Graphics();
  private readonly timeOfDaySun: Sprite;
  private timeOfDayCachedKey = "";
  private viewportRect = { x: 0, y: 0, width: 0, height: 0 };
  private photoMode = false;
  private readonly lanternLayer = new Container();
  private readonly lanternTint = new Graphics();
  private readonly lanternWorld = new Container();
  private readonly lanternSpotlight: Sprite;
  private readonly lanternMotes: Sprite[] = [];
  private readonly emissiveLayer = new Container();
  private readonly glowLayer = new Container();
  private readonly depth = new Container();
  private readonly ambientLayer = new Container();
  private readonly emoteLayer = new Container();
  private readonly emoteSprites: Sprite[] = [];
  private activeDialoguePartner: { x: number; y: number; height: number } | null = null;
  private recentTalk: { x: number; y: number; height: number; startTick: number } | null = null;
  private lastEmoteArea = "";
  private lastEmoteTick: number | undefined;
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
  private ambientSprites: { flyer: AmbientFlyer; sprite: Sprite }[] = [];
  private ambientFrames: { id: string; x: number; y: number; frame: number }[] = [];
  private clubhousePrizePool: { container: Container; shadow: Sprite; item: Sprite }[] = [];
  private clubhouseKeepsakePool: {
    container: Container;
    shadow: Sprite;
    glow: Sprite;
    item: Sprite;
    sparkle: Sprite;
  }[] = [];
  private clubhouseDisplayCount = 0;
  private petReaction: { id: string; startTick: number } | null = null;
  private restingSpot: { spot: RestSpot; startTick: number } | null = null;

  constructor(
    private readonly world: World,
    options: { debugLabel: boolean; renderer: Renderer },
  ) {
    this.vfx = createVfxTextures();
    this.atmosphere = new BiomeAtmosphere(this.vfx);
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
    this.footstepLayer.label = "footsteps";
    for (let i = 0; i < FOOTSTEP_POOL_SIZE; i += 1) {
      const puff = new Sprite(this.vfx.puff);
      puff.label = `footstep:${i}`;
      puff.anchor.set(0.5);
      puff.visible = false;
      this.footstepSprites.push(puff);
      this.footstepLayer.addChild(puff);
    }
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

    this.lanternSpotlight = new Sprite(this.vfx.softGlow);
    this.lanternSpotlight.label = "lantern:spotlight";
    this.lanternSpotlight.anchor.set(0.5);
    this.lanternSpotlight.tint = 0xb98eff;
    this.lanternSpotlight.blendMode = "add";
    this.lanternSpotlight.width = 540;
    this.lanternSpotlight.height = 480;
    this.lanternWorld.addChild(this.lanternSpotlight);
    for (let i = 0; i < LANTERN_MOTE_COUNT; i += 1) {
      const mote = new Sprite(this.vfx.sparkle);
      mote.label = `lantern:mote:${i}`;
      mote.anchor.set(0.5);
      mote.blendMode = "add";
      mote.tint = LANTERN_MOTE_TINTS[i % LANTERN_MOTE_TINTS.length] ?? 0xd4b0ff;
      this.lanternMotes.push(mote);
      this.lanternWorld.addChild(mote);
    }
    this.lanternLayer.label = "lantern";
    this.lanternLayer.visible = false;
    this.lanternLayer.addChild(this.lanternTint, this.lanternWorld);
    this.emissiveLayer.label = "emissive";
    this.emissiveLayer.addChild(this.atmosphere.emissive);

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
      this.timeOfDayLayer,
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
      this.footstepLayer,
      this.atmosphere.under,
      this.depth,
      this.ambientLayer,
      this.atmosphere.over,
      this.emoteLayer,
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
    for (const entry of this.ambientSprites) entry.sprite.destroy();
    this.ambientSprites = ambientFor(area).map((flyer) => {
      const sprite = new Sprite();
      sprite.label = `ambient:${flyer.id}`;
      sprite.anchor.set(0.5);
      this.ambientLayer.addChild(sprite);
      return { flyer, sprite };
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
    this.clearFootsteps();
    this.clearEmotes();
    this.clearCompanionActions();
    this.hideClubhouseDisplay();
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

  private clearFootsteps(): void {
    this.footstepPuffs = [];
    this.lastFootstepTick = undefined;
    this.lastFootstepStride = undefined;
    for (const sprite of this.footstepSprites) sprite.visible = false;
  }

  private clearEmotes(): void {
    this.activeDialoguePartner = null;
    this.recentTalk = null;
    this.lastEmoteTick = undefined;
    for (const sprite of this.emoteSprites) sprite.visible = false;
  }

  private clearCompanionActions(): void {
    this.petReaction = null;
    this.restingSpot = null;
  }

  private hideClubhouseDisplay(): void {
    for (const entry of this.clubhousePrizePool) entry.container.visible = false;
    for (const entry of this.clubhouseKeepsakePool) entry.container.visible = false;
    this.clubhouseDisplayCount = 0;
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
    this.clearFootsteps();
    this.clearEmotes();
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
    this.timeOfDayCachedKey = "";
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

  private updateFootsteps(state: State, areaId: string, playerPos: Point): void {
    const active = areaId !== "harness" &&
      state.battle === null &&
      state.arcade === null &&
      state.transition === null;
    if (!active) {
      if (areaId !== this.lastFootstepArea ||
          (this.lastFootstepTick !== undefined && state.tick < this.lastFootstepTick)) {
        this.clearFootsteps();
      }
      for (const sprite of this.footstepSprites) sprite.visible = false;
      this.lastFootstepArea = areaId;
      this.lastFootstepTick = state.tick;
      return;
    }
    if (areaId !== this.lastFootstepArea ||
        (this.lastFootstepTick !== undefined && state.tick < this.lastFootstepTick)) {
      this.clearFootsteps();
    }
    const halfStride = this.world.tunables.walkCycleUnits / 2;
    const stride = Math.floor(state.motion.distance / halfStride);
    if (
      state.motion.moving &&
      this.lastFootstepArea === areaId &&
      this.lastFootstepTick !== undefined &&
      this.lastFootstepStride !== undefined
    ) {
      const delta = state.tick - this.lastFootstepTick;
      if (delta >= 1 && delta <= 5 && stride > this.lastFootstepStride) {
        const map = this.world.surfaces[areaId];
        const surface = map === undefined ? "grass" : surfaceAt(map, state.player);
        this.footstepPuffs.push(
          ...spawnFootstepPuffs(playerPos, state.facing, surface, stride, state.tick),
        );
        if (this.footstepPuffs.length > FOOTSTEP_POOL_SIZE) {
          this.footstepPuffs = this.footstepPuffs.slice(-FOOTSTEP_POOL_SIZE);
        }
      }
    }
    this.lastFootstepArea = areaId;
    this.lastFootstepTick = state.tick;
    this.lastFootstepStride = stride;

    this.footstepPuffs = this.footstepPuffs.filter((puff) => {
      const age = state.tick - puff.bornTick;
      return age >= 0 && age < puff.life;
    });
    for (let i = 0; i < this.footstepSprites.length; i += 1) {
      const sprite = this.footstepSprites[i];
      if (sprite === undefined) continue;
      const puff = this.footstepPuffs[i];
      if (puff === undefined) {
        sprite.visible = false;
        continue;
      }
      const age = state.tick - puff.bornTick;
      const u = age / puff.life;
      sprite.visible = true;
      sprite.position.set(puff.x + puff.vx * age, puff.y + puff.vy * age);
      sprite.scale.set(puff.baseScale * (0.65 + u * 0.75));
      sprite.rotation = puff.rotation + u * 0.35;
      sprite.tint = puff.tint;
      sprite.alpha = puff.baseAlpha * (1 - u) * (1 - u);
    }
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
    this.updateFootsteps(state, area.id, playerPos);
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
    this.renderClubhouseDisplay(state, area);
    this.renderAmbient(state);
    this.renderEmotes(
      state,
      area,
      playerPos,
      canInterpolate ? previousState : undefined,
      alpha,
      activePet,
      activeRest,
    );
    this.renderTimeOfDay(state);
    this.renderGlows(state, playerPos, paused);
    const clubhouseBloom = area.id === "clubhouse" && (
      this.world.storyVariable(state.ink, "garden_sprouted") === true ||
      this.world.storyVariable(state.ink, "garden_ripe") === true
    );
    this.atmosphere.update(
      area.id,
      area.width,
      area.height,
      state.tick,
      state.battle === null && state.arcade === null,
      this.lanternBlend,
      clubhouseBloom ? { clubhouseBloom: true } : undefined,
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

  private renderTimeOfDay(state: State): void {
    const grade = storyTimeOfDay(this.world, state);
    const show = grade.alpha > 0 || grade.sunAlpha > 0;
    this.timeOfDayLayer.visible = show;
    if (!show) return;
    const { x, y, width, height } = this.viewportRect;
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
      for (let i = 0; i < this.lanternMotes.length; i += 1) {
        const mote = this.lanternMotes[i];
        if (mote === undefined) continue;
        const spec = computeLanternMote(
          i, this.lanternMotes.length, centerX, centerY, state.tick, this.lanternBlend,
        );
        mote.position.set(spec.x, spec.y);
        mote.scale.set(spec.scale);
        mote.alpha = spec.alpha;
      }
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

  private renderClubhouseDisplay(state: State, area: Area): void {
    const visible =
      area.id === "clubhouse" &&
      state.battle === null &&
      state.arcade === null;
    if (!visible) {
      this.hideClubhouseDisplay();
      return;
    }
    const display = evaluateClubhouseDisplay(this.world, state);
    const prizeSheet = Assets.get<Spritesheet | undefined>(CLUBHOUSE_PRIZES_ALIAS);

    let prizeShown = 0;
    for (const placement of display.prizes) {
      const texture = prizeSheet?.textures[placement.frame];
      if (texture === undefined) continue;
      let entry = this.clubhousePrizePool[prizeShown];
      if (entry === undefined) {
        const container = new Container();
        const shadow = makeShadowSprite(this.vfx.contactShadow, `shadow:prize:${prizeShown}`);
        const item = new Sprite();
        container.addChild(shadow, item);
        this.depth.addChild(container);
        entry = { container, shadow, item };
        this.clubhousePrizePool.push(entry);
      }
      entry.container.visible = true;
      entry.container.label = `clubhouse:prize:${placement.id}`;
      entry.container.position.set(placement.x, placement.y);
      entry.container.zIndex = placement.zIndex;

      entry.shadow.position.set(0, -1);
      entry.shadow.width = 48 * (placement.scale / 0.3);
      entry.shadow.height = 16 * (placement.scale / 0.3);
      entry.shadow.alpha = 0.24;

      entry.item.texture = texture;
      if (texture.defaultAnchor !== undefined) {
        entry.item.anchor.copyFrom(texture.defaultAnchor);
      } else {
        entry.item.anchor.set(0.5, 0.9375);
      }
      entry.item.scale.set(placement.scale);
      entry.item.rotation = placement.rotation;
      prizeShown += 1;
    }
    for (let i = prizeShown; i < this.clubhousePrizePool.length; i += 1) {
      const entry = this.clubhousePrizePool[i];
      if (entry !== undefined) entry.container.visible = false;
    }

    let keepsakeShown = 0;
    for (const placement of display.keepsakes) {
      let entry = this.clubhouseKeepsakePool[keepsakeShown];
      if (entry === undefined) {
        const container = new Container();
        const shadow = makeShadowSprite(
          this.vfx.contactShadow,
          `shadow:keepsake:${keepsakeShown}`,
        );
        const glow = new Sprite(this.vfx.softGlow);
        glow.anchor.set(0.5);
        glow.blendMode = "add";
        const item = new Sprite();
        item.anchor.set(0.5, 0.85);
        const sparkle = new Sprite(this.vfx.sparkle);
        sparkle.anchor.set(0.5);
        sparkle.blendMode = "normal";
        container.addChild(shadow, glow, item, sparkle);
        this.depth.addChild(container);
        entry = { container, shadow, glow, item, sparkle };
        this.clubhouseKeepsakePool.push(entry);
      }
      const phase = state.tick * 0.055 + keepsakeShown * 1.4;
      const pulse = 0.5 + 0.5 * Math.sin(phase);
      entry.container.visible = true;
      entry.container.label = `clubhouse:keepsake:${placement.id}`;
      entry.container.position.set(placement.x, placement.y);
      entry.container.zIndex = placement.zIndex;

      entry.shadow.position.set(0, -1);
      entry.shadow.width = 26 * placement.scale;
      entry.shadow.height = 10 * placement.scale;
      entry.shadow.alpha = 0.22;

      entry.glow.position.set(0, -14 * placement.scale);
      entry.glow.tint = placement.sparkleTint;
      entry.glow.scale.set(0.42 * placement.scale * (0.94 + 0.12 * pulse));
      entry.glow.alpha = 0.18 + 0.1 * pulse;

      entry.item.texture = this.vfx[placement.texture];
      entry.item.scale.set(placement.scale);
      entry.item.position.set(0, 0);

      entry.sparkle.position.set(
        10 * placement.scale + Math.sin(phase * 0.9) * 3,
        -24 * placement.scale + Math.cos(phase * 1.1) * 2.5,
      );
      entry.sparkle.tint = placement.sparkleTint;
      entry.sparkle.scale.set(0.32 + 0.16 * pulse);
      entry.sparkle.alpha = 0.55 + 0.4 * pulse;
      keepsakeShown += 1;
    }
    for (let i = keepsakeShown; i < this.clubhouseKeepsakePool.length; i += 1) {
      const entry = this.clubhouseKeepsakePool[i];
      if (entry !== undefined) entry.container.visible = false;
    }

    this.clubhouseDisplayCount = prizeShown + keepsakeShown;
  }

  private renderAmbient(state: State): void {
    const sheet = Assets.get<Spritesheet>("ambient-sheet");
    const visible = state.battle === null && state.arcade === null;
    if (!visible) {
      for (const { sprite } of this.ambientSprites) sprite.visible = false;
      this.ambientFrames = [];
      return;
    }
    const frames: { id: string; x: number; y: number; frame: number }[] = [];
    for (const { flyer, sprite } of this.ambientSprites) {
      const names = sheet?.data.animations?.[flyer.animation] ?? [];
      const position = flyerAt(flyer, state.tick, Math.max(1, names.length));
      const frameName = names[position.frame] ?? names[0];
      const texture = frameName === undefined ? undefined : sheet?.textures[frameName];
      sprite.visible = texture !== undefined;
      if (texture === undefined) continue;
      sprite.texture = texture;
      sprite.position.set(position.x, position.y);
      const scale = flyer.size / 96;
      sprite.scale.set(position.flip ? -scale : scale, scale);
      frames.push({ id: flyer.id, x: position.x, y: position.y, frame: position.frame });
    }
    this.ambientFrames = frames;
  }

  private renderEmotes(
    state: State,
    area: Area,
    playerPos: Point,
    previousState: State | undefined,
    alpha: number,
    activePet: { id: string; elapsed: number } | null,
    activeRest: { spot: RestSpot; elapsed: number } | null,
  ): void {
    const active = area.id !== "harness" &&
      state.battle === null &&
      state.arcade === null;
    if (!active) {
      this.emoteLayer.visible = false;
      for (const sprite of this.emoteSprites) sprite.visible = false;
      if (area.id !== this.lastEmoteArea ||
          (this.lastEmoteTick !== undefined && state.tick < this.lastEmoteTick) ||
          state.battle !== null ||
          state.arcade !== null) {
        this.activeDialoguePartner = null;
        this.recentTalk = null;
      }
      this.lastEmoteArea = area.id;
      this.lastEmoteTick = state.tick;
      return;
    }

    if (area.id !== this.lastEmoteArea ||
        (this.lastEmoteTick !== undefined && state.tick < this.lastEmoteTick)) {
      this.activeDialoguePartner = null;
      this.recentTalk = null;
    }

    const present = presentCritters(this.world, state);
    if (state.dialogue !== null) {
      const knot = state.dialogue.knot;
      const npc = area.npcs.find(
        (item) => item.id !== "bus-stop" && npcVisible(this.world, state, item) &&
          item.knot === knot,
      );
      if (npc !== undefined) {
        const critter = npc.visibleWhenCalmed === undefined
          ? undefined
          : this.world.critters[npc.visibleWhenCalmed];
        const height = computeNpcOverworldHeight(npc, critter);
        this.activeDialoguePartner = { x: npc.point.x, y: npc.point.y, height };
      } else {
        const calm = present
          .filter((item) => item.mood === "calm" && item.kind.calmKnot === knot)
          .sort((a, b) =>
            (a.point.x - state.player.x) ** 2 + (a.point.y - state.player.y) ** 2 -
            ((b.point.x - state.player.x) ** 2 + (b.point.y - state.player.y) ** 2))[0];
        if (calm !== undefined) {
          this.activeDialoguePartner = {
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
    if (this.recentTalk !== null) {
      const elapsed = state.tick - this.recentTalk.startTick;
      if (elapsed >= 0 && elapsed < 38) {
        recentTalk = {
          x: this.recentTalk.x,
          y: this.recentTalk.y,
          height: this.recentTalk.height,
          elapsed,
        };
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

    const emotes = evaluateOverworldEmotes({
      areaId: area.id,
      tick: state.tick,
      player: playerPos,
      dialogueOpen: state.dialogue !== null || state.transition !== null || state.journalOpen,
      roamers,
      calmedCritters,
      nappingMembers,
      recentTalk,
    });

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
        petPos = prevMember !== undefined && alpha < 1
          ? interpolatePoint(prevMember, member, alpha)
          : member;
        petHeight = content.box.height;
      }
    }
    for (const spec of computeCompanionEmoteSpecs(
      petPos, petHeight, activePet?.elapsed ?? null, playerPos, activeRest?.elapsed ?? null,
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
      clubhouseDisplay: this.clubhouseDisplayCount,
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
