import {
  Assets,
  BlurFilter,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Spritesheet,
  Text,
  TilingSprite,
  type Renderer,
  Texture,
} from "pixi.js";
import {
  battleFoe,
  battleParty,
  battleView,
  faeBox,
  hiddenFraction,
  npcFacing,
  npcVisible,
  partyLeader,
  peekabooStatus,
  presentCritters,
  surfaceAt,
  targetInteractable,
  wildMarks,
  creditEntries,
  type Area,
  type CheckSide,
  type CreditEntry,
  type Direction,
  type PartyContent,
  type PartyMember,
  type Point,
  type State,
  type Surface,
  type World,
} from "../core";
import { AreaView, type Rect } from "./area-view";

// Half the widest hint sticker, in CSS px, to keep hints on screen.
const hintHalfWidth = 130;
// Where a battle check is drawn, in CSS px (spec 8.1).
// `hintAt` is where the check's hint sticker hangs (its top centre).
export type BattleCheckGeometry =
  | { kind: "ring"; x: number; y: number; radius: number; hintAt: Point }
  | { kind: "charge"; x: number; y: number; width: number; height: number; hintAt: Point }
  | { kind: "chain"; from: Point; to: Point; radius: number; hintAt: Point }
  // A catch: the three lanes' heights (high, middle, low), where toys set
  // out and where the catch stands, its radius, and the toys' scale (CSS px
  // per toy-atlas pixel: the critter's scale times its optional kind toyScale).
  | {
      kind: "catch";
      lanes: [number, number, number];
      fromX: number;
      catcherX: number;
      radius: number;
      toyScale: number;
      hintAt: Point;
    }
  // A lean: the balance track above Fae's head (its centre and size), and
  // the wind's swooshes in front of her (where each sets out, one height per
  // row, and how long each is; it drifts its own length toward her).
  | {
      kind: "lean";
      track: { x: number; y: number; width: number; height: number };
      wind: { x: number; rows: number[]; length: number };
      hintAt: Point;
    }
  | {
      kind: "trace";
      rect: { x: number; y: number; width: number; height: number };
      brush: Point;
      points: Point[];
      checkpoint: number;
      hintAt: Point;
    }
  | {
      kind: "peekaboo";
      x: number;
      y: number;
      track: { x: number; y: number; width: number; height: number };
      hintAt: Point;
    };
// The check for tests (spec 11): its side and geometry, plus an anchor
// (`x`, `y`: a ring's centre, a meter's top-left, a chain's target, the
// catch where it is, a lean's star where it is).
export type BattleCheckInfo = BattleCheckGeometry & { side: CheckSide; x: number; y: number };
import { interpolatePoint, smoothFollowCamera, worldToScreen } from "./camera";
import { dialogueFacing, dialoguePartner, facingToward, selectFaeAnimation } from "./animation";
import { assetUrl } from "../platform/assets";
import { fadeAlpha } from "./fade";
import { battleLayout, type BattleLayout } from "./battle-layout";
import { ambientFor, type AmbientFlyer } from "../content/ambient";
import { flyerAt } from "./ambient";
import { createVfxTextures, type VfxTextures } from "./vfx-textures";
import { BiomeAtmosphere } from "./atmosphere";
import {
  composePose,
  fairyHover,
  idleBreathing,
  NEUTRAL_POSE,
  roamerHop,
  sitSquash,
  walkPose,
  type MotionPose,
} from "./motion";
import { computeBattleChoreography } from "./battle-choreography";

export type RenderOptions = {
  paused?: boolean;
  alpha?: number;
  previousState?: State;
};

type FootstepPuff = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornTick: number;
  life: number;
  tint: number;
  baseAlpha: number;
  baseScale: number;
  rotation: number;
};

const FOOTSTEP_POOL_SIZE = 24;
const BATTLE_VFX_POOL_SIZE = 36;

const SURFACE_PUFFS: Record<Surface, { tint: number; alpha: number }> = {
  sand: { tint: 0xebd7b8, alpha: 0.45 },
  stone: { tint: 0xebd7b8, alpha: 0.45 },
  snow: { tint: 0xffffff, alpha: 0.55 },
  grass: { tint: 0xd3e8a8, alpha: 0.42 },
  wood: { tint: 0xefe2cc, alpha: 0.2 },
  tile: { tint: 0xefe2cc, alpha: 0.2 },
  carpet: { tint: 0xefe2cc, alpha: 0.2 },
};

function facingBackVector(facing: Direction): Point {
  if (facing === "left") return { x: 1, y: 0 };
  if (facing === "right") return { x: -1, y: 0 };
  if (facing === "up") return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

function liftShadowScale(offsetY: number): number {
  const lift = Math.max(0, -offsetY);
  return Math.max(0.76, 1 - lift * 0.02);
}

function warmFlashTint(flash: number): number {
  if (flash <= 0.005) return 0xffffff;
  const t = Math.min(1, Math.max(0, flash));
  const r = 255;
  const g = Math.round(255 - (255 - 0xb4) * t);
  const b = Math.round(255 - (255 - 0xa2) * t);
  return (r << 16) | (g << 8) | b;
}

const INDOOR_AREAS = new Set([
  "bedroom",
  "kitchen",
  "school",
  "east-hall",
  "classroom",
  "gym",
  "music",
  "art-room",
  "arcade",
  "lodge",
  "clubhouse",
]);

const ADULT_NPCS = new Set(["mom", "teacher", "nurse", "coach", "music-teacher"]);
const LANTERN_MOTE_COUNT = 12;
const LANTERN_MOTE_TINTS: readonly number[] = [0xd4b0ff, 0xe9d8ff, 0xb69eff];

function makeShadowSprite(texture: Texture, label: string): Sprite {
  const sprite = new Sprite(texture);
  sprite.label = label;
  sprite.anchor.set(0.5);
  return sprite;
}

export type EntityAtlas = { alias: string; src: string };

/**
 * Unique per-area NPC and critter spritesheets, excluding party members
 * (which stay resident across areas). Loaded with the area and evicted on the
 * same current + previous residency window as AreaView textures (spec 4).
 */
export function areaEntityAtlases(world: World, area: Area): EntityAtlas[] {
  const seen = new Set<string>();
  const result: EntityAtlas[] = [];
  const add = (alias: string, atlas: string): void => {
    if (seen.has(alias)) return;
    seen.add(alias);
    result.push({ alias, src: assetUrl(atlas) });
  };
  for (const npc of area.npcs) {
    if (world.party[npc.id] !== undefined) continue;
    const character = world.characters[npc.id];
    if (character !== undefined) add(`${npc.id}-sheet`, character.atlas);
  }
  const critterIds = [
    ...area.critters.map((piece) => piece.id),
    ...(area.recurring?.dens ?? []).flatMap((den) => den.kinds),
  ];
  for (const id of critterIds) {
    const critter = world.critters[id];
    if (critter !== undefined) add(critter.atlas, critter.atlas);
  }
  return result;
}

function mipmapSheet(alias: string, src: string): Promise<Spritesheet> {
  return Assets.load<Spritesheet>({
    alias,
    src,
    data: { textureOptions: { autoGenerateMipmaps: true } },
  });
}

// Critter frames are 512 px with the feet at y 504 (docs/art/critters.md).
// Aura and body centroids are measured in each critter's content atlas.
function placeAura(
  aura: Sprite,
  feet: { x: number; y: number },
  scale: number,
  auraCentre: Point,
  bodyCentre: Point,
  flipX = false,
): void {
  aura.anchor.set(auraCentre.x / 512, auraCentre.y / 512);
  aura.scale.set(scale * 1.15);
  const dx = (bodyCentre.x - 256) * (flipX ? -1 : 1);
  aura.position.set(
    feet.x + dx * scale,
    feet.y + (bodyCentre.y - 504) * scale,
  );
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
  private readonly lanternLayer = new Container();
  private readonly lanternTint = new Graphics();
  private readonly lanternWorld = new Container();
  private readonly lanternSpotlight: Sprite;
  private readonly lanternMotes: Sprite[] = [];
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
  private readonly battleLayer = new Container();
  // A light cream wash over the blurred backdrop so the figures stand out.
  private readonly battleWash = new Graphics();
  // Not clipped to the viewport, so the blur samples the whole painting.
  private readonly backdropBlur = new BlurFilter({
    strength: 4,
    quality: 2,
    resolution: 0.5,
    clipToViewport: false,
  });
  private battleBackdrop: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;
  // The blurred painting, rendered once per battle (see renderBackdrop).
  private readonly backdropSprite = new Sprite();
  private readonly renderer: Renderer;
  private backdropTexture: Texture | undefined;
  private readonly battleSpotlight: Sprite;
  private readonly battleCritterShadow: Sprite;
  private readonly battleFaeShadow: Sprite;
  private readonly battlePartyShadows = new Map<string, Sprite>();
  private readonly battleCritter = new Sprite();
  private readonly battleCritterAura = new Sprite();
  private readonly battleFae = new Sprite();
  private readonly battlePartySprites = new Map<string, Sprite>();
  private readonly battleVfxLayer = new Container();
  private readonly battleVfxSprites: Sprite[] = [];
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
  private battleWashKey = "";
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

  constructor(
    private readonly world: World,
    options: { debugLabel: boolean; renderer: Renderer },
  ) {
    this.renderer = options.renderer;
    this.vfx = createVfxTextures();
    this.atmosphere = new BiomeAtmosphere(this.vfx);
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
    this.battleVfxLayer.label = "battle:vfx";
    for (let i = 0; i < BATTLE_VFX_POOL_SIZE; i += 1) {
      const particle = new Sprite(this.vfx.sparkle);
      particle.label = `battle:vfx:${i}`;
      particle.anchor.set(0.5);
      particle.visible = false;
      this.battleVfxSprites.push(particle);
      this.battleVfxLayer.addChild(particle);
    }

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

    this.battleSpotlight = new Sprite(this.vfx.softGlow);
    this.battleSpotlight.label = "battle:spotlight";
    this.battleSpotlight.anchor.set(0.5);
    this.battleSpotlight.tint = 0xfff8e6;
    this.battleSpotlight.blendMode = "screen";
    this.battleSpotlight.alpha = 0.16;
    this.battleCritterShadow = makeShadowSprite(
      this.vfx.contactShadow,
      "battle:shadow:critter",
    );
    this.battleFaeShadow = makeShadowSprite(this.vfx.contactShadow, "battle:shadow:fae");

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
      const battleSprite = new Sprite();
      battleSprite.label = `battle:${id}`;
      battleSprite.visible = false;
      this.battlePartySprites.set(id, battleSprite);
      const battleShadow = makeShadowSprite(this.vfx.contactShadow, `battle:shadow:${id}`);
      battleShadow.visible = false;
      this.battlePartyShadows.set(id, battleShadow);
    }
    this.battleCritter.label = "battle:critter";
    this.battleCritterAura.label = "battle:critter:aura";
    this.player.scale.set(0.5);
    this.viewport.addChild(this.scene, this.lanternLayer, this.emissiveLayer, this.glowLayer);
    this.viewport.mask = this.viewportMask;
    this.root.addChild(
      this.background,
      this.paper,
      this.viewport,
      this.viewportMask,
      this.fade,
      this.backdropSprite,
      this.battleWash,
      this.battleLayer,
    );
    this.scene.addChild(
      this.shadowLayer,
      this.footstepLayer,
      this.atmosphere.under,
      this.depth,
      this.ambientLayer,
      this.atmosphere.over,
      this.paperGrain,
    );
    this.depth.addChild(this.player);
    for (const sprite of this.partySprites.values())
      this.depth.addChild(sprite);
    this.battleLayer.addChild(
      this.battleSpotlight,
      this.battleCritterShadow,
      this.battleFaeShadow,
      ...this.battlePartyShadows.values(),
      this.battleCritterAura,
      this.battleCritter,
      this.battleFae,
      ...this.battlePartySprites.values(),
      this.battleVfxLayer,
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
    const [next] = await Promise.all([
      AreaView.load(area, this.depth),
      ...entities.map((entry) => mipmapSheet(entry.alias, entry.src)),
    ]);
    this.areaView = next;
    const nextEntities = entities.map((entry) => entry.alias);
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
    void Promise.all([
      AreaView.prefetch(area).then((urls) => {
        for (const url of urls) this.areaTextureUrls.add(url);
      }),
      ...areaEntityAtlases(this.world, area).map((entry) =>
        mipmapSheet(entry.alias, entry.src),
      ),
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

  resetCamera(): void {
    this.previousCamera = undefined;
    this.clearFootsteps();
  }

  loadedAreaId(): string {
    return this.areaView?.area.id ?? "";
  }

  private drawStatic(width: number, height: number, paper: number): void {
    const scale = Math.min(width / this.viewWidth, height / this.viewHeight);
    const letterboxX = (width - this.viewWidth * scale) / 2;
    const letterboxY = (height - this.viewHeight * scale) / 2;
    const viewW = this.viewWidth * scale;
    const viewH = this.viewHeight * scale;
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

  private setFaeTexture(state: State): void {
    const sheet = Assets.get<Spritesheet>("fae-sheet");
    const facing = dialogueFacing(this.world, state) ?? state.facing;
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

  // A party member's frame: walk frames advance with its own distance; at
  // rest, a sitter (Maddie) keeps standing (walk frame 0) until sitDelayTicks
  // and then sits (its idle), anyone else idles at once.
  private setFollowerTexture(
    sprite: Sprite,
    state: State,
    member: PartyMember,
    content: PartyContent,
    partner: Point | null,
  ): { id: string; animation: string; frame: number } {
    const sheet = Assets.get<Spritesheet>(`${member.id}-sheet`);
    const settled = !content.sits && !member.motion.moving &&
      member.stillTicks >= this.world.tunables.follow.settleDelayTicks;
    const facing = settled
      ? (partner !== null ? facingToward(member, partner) : state.facing)
      : member.facing;
    const side = facing === "right" ? "left" : facing;
    const mirror = facing === "right";
    const resting =
      !member.motion.moving &&
      (!content.sits ||
        member.stillTicks >= this.world.tunables.follow.sitDelayTicks);
    const animation = resting ? `idle_${side}` : `walk_${side}`;
    const frames = sheet.animations[animation];
    if (frames === undefined || frames.length === 0)
      throw new Error(`Missing ${member.id} animation ${animation}`);
    const frame = member.motion.moving
      ? Math.floor(
          (member.motion.distance / content.walkCycleUnits) * frames.length,
        ) % frames.length
      : 0;
    const texture = frames[frame];
    if (texture === undefined)
      throw new Error(`Missing ${member.id} frame ${frame}`);
    sprite.texture = texture;
    if (texture.defaultAnchor === undefined)
      throw new Error(`${member.id} anchor missing`);
    sprite.anchor.copyFrom(texture.defaultAnchor);
    const s = content.scale ?? 0.5;
    sprite.scale.set(mirror ? -s : s, s);
    return { id: member.id, animation, frame };
  }

  private renderParty(
    state: State,
    shadowAlpha: number,
    previousState: State | undefined,
    alpha: number,
    livingMotion: boolean,
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
      const frameInfo = this.setFollowerTexture(sprite, state, member, content, partner);
      let pose: MotionPose = NEUTRAL_POSE;
      if (livingMotion) {
        const isSideBounder = member.id === "acorn-squirrel" &&
          (member.facing === "left" || member.facing === "right");
        if (member.motion.moving) {
          pose = walkPose(member.motion.distance, content.walkCycleUnits, true, isSideBounder);
        } else {
          pose = idleBreathing(state.tick, (index + 1) * 1.3);
          if (content.sits) {
            pose = composePose(
              pose,
              sitSquash(member.stillTicks, this.world.tunables.follow.sitDelayTicks),
            );
          }
        }
      }
      sprite.position.set(pos.x + pose.offsetX, pos.y + pose.offsetY);
      sprite.scale.set(sprite.scale.x * pose.scaleX, sprite.scale.y * pose.scaleY);
      sprite.rotation = pose.rotation;
      sprite.zIndex = pos.y;
      const shadow = this.partyShadows.get(member.id);
      if (shadow !== undefined) {
        const shadowScale = liftShadowScale(pose.offsetY);
        const shadowWidth = content.box.width * 0.92 * shadowScale;
        shadow.position.set(pos.x, pos.y);
        shadow.width = shadowWidth;
        shadow.height = shadowWidth * 0.38;
        shadow.alpha = shadowAlpha * shadowScale;
      }
      return [frameInfo];
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
        const style = SURFACE_PUFFS[surface];
        const back = facingBackVector(state.facing);
        const side = stride % 2 === 0 ? 1 : -1;
        const perpX = -back.y;
        const perpY = back.x;
        const next: FootstepPuff[] = [
          {
            x: playerPos.x + back.x * 8 + perpX * side * 6,
            y: playerPos.y - 2 + back.y * 5 + perpY * side * 3,
            vx: back.x * 0.45 + perpX * side * 0.25,
            vy: back.y * 0.25 - 0.35,
            bornTick: state.tick,
            life: 18,
            tint: style.tint,
            baseAlpha: style.alpha,
            baseScale: 0.24,
            rotation: (stride * 0.7) % (Math.PI * 2),
          },
          {
            x: playerPos.x + back.x * 14 - perpX * side * 5,
            y: playerPos.y - 1 + back.y * 7 - perpY * side * 3,
            vx: back.x * 0.6 - perpX * side * 0.18,
            vy: back.y * 0.2 - 0.45,
            bornTick: state.tick,
            life: 18,
            tint: style.tint,
            baseAlpha: style.alpha * 0.85,
            baseScale: 0.18,
            rotation: (stride * 1.3 + 1.1) % (Math.PI * 2),
          },
        ];
        this.footstepPuffs.push(...next);
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
      const scale = puff.baseScale * (0.65 + u * 0.75);
      sprite.visible = true;
      sprite.position.set(puff.x + puff.vx * age, puff.y + puff.vy * age);
      sprite.scale.set(scale);
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
    this.scene.scale.set(scale);
    this.scene.position.set(offsetX, offsetY);
    this.lanternWorld.scale.set(scale);
    this.lanternWorld.position.set(offsetX, offsetY);
    this.emissiveLayer.scale.set(scale);
    this.emissiveLayer.position.set(offsetX, offsetY);
    this.glowLayer.scale.set(scale);
    this.glowLayer.position.set(offsetX, offsetY);
    const indoor = INDOOR_AREAS.has(area.id);
    const shadowAlpha = indoor ? 0.24 : 0.3;
    const livingMotion = area.id !== "harness";
    this.shadowLayer.visible = livingMotion;
    this.setFaeTexture(state);
    const faePose = !livingMotion
      ? NEUTRAL_POSE
      : state.motion.moving
        ? walkPose(state.motion.distance, this.world.tunables.walkCycleUnits, true)
        : idleBreathing(state.tick, 0);
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
    );
    this.renderCritters(
      state,
      shadowAlpha,
      canInterpolate ? previousState : undefined,
      alpha,
      livingMotion,
    );
    this.renderNpcs(state, shadowAlpha, livingMotion);
    this.renderAmbient(state);
    this.renderGlows(state, playerPos, paused);
    this.atmosphere.update(
      area.id,
      area.width,
      area.height,
      state.tick,
      state.battle === null && state.arcade === null,
      this.lanternBlend,
    );
    loaded.update(
      this.world,
      state.ink,
      state.player,
      state.tick,
      this.figures(),
    );
    this.renderBattle(state, width, height, resolution);
    this.depth.sortChildren();
    if (this.label !== undefined) {
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

  private renderGlows(state: State, playerPos: Point, snapLantern = false): void {
    const area = this.areaView?.area;
    const sheet = Assets.get<Spritesheet>("glow-sheet");
    const on = state.lantern && state.battle === null && state.arcade === null;
    const target = on ? 1 : 0;
    if (
      snapLantern ||
      this.lanternTick === undefined ||
      state.tick < this.lanternTick ||
      state.tick - this.lanternTick > 18
    ) {
      this.lanternBlend = target;
    } else if (state.tick > this.lanternTick) {
      const delta = state.tick - this.lanternTick;
      const gap = target - this.lanternBlend;
      this.lanternBlend += Math.sign(gap) * Math.min(Math.abs(gap), 0.12 * delta);
    }
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
        const speed = 0.012 + (i % 4) * 0.004;
        const angle = (i / this.lanternMotes.length) * Math.PI * 2 +
          state.tick * speed * (i % 2 === 0 ? 1 : -1);
        const baseRadius = 46 + ((i * 53) % 165);
        const radius = baseRadius + Math.sin(state.tick * 0.03 + i * 1.7) * 16;
        const mx = centerX + Math.cos(angle) * radius;
        const my = centerY + Math.sin(angle) * radius * 0.72;
        const twinkle = 0.5 + 0.5 * Math.sin(state.tick * 0.08 + i * 1.9);
        const scale = 0.24 + (i % 3) * 0.11;
        mote.position.set(mx, my);
        mote.scale.set(scale);
        mote.alpha = (0.24 + 0.36 * twinkle) * this.lanternBlend;
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
        const dx = glow.point.x - state.player.x;
        const dy = glow.point.y - state.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const proximity = dist >= 320 ? 0.78 : 0.78 + 0.22 * (1 - dist / 320);
        const pulse = 0.84 + Math.sin(state.tick / 24 + index * 1.15) * 0.12;
        const bloom = 1 + 0.025 * Math.sin(state.tick / 18 + index * 1.15);
        const s = 0.5 * bloom;
        sprite.scale.set(glow.flip === true ? -s : s, s);
        sprite.alpha = Math.min(1, pulse * proximity) * Math.max(0.35, this.lanternBlend);
        if (sprite.visible) drawn.push(id);
      }
    });
    this.drawnGlows = drawn;
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
      const sheet = Assets.get<Spritesheet>(`${npc.id}-sheet`);
      const character = this.world.characters[npc.id];
      // Someone the story has sent away isn't drawn (spec 6).
      sprite.visible = npcVisible(this.world, state, npc);
      if (shadow !== null) shadow.visible = sprite.visible;
      if (sheet === undefined || character === undefined || !sprite.visible)
        continue;
      const facing = npcFacing(state, npc);
      const wanted = `idle_${facing}`;
      const mirror =
        facing === "right" &&
        sheet.data.animations?.[wanted] === undefined &&
        sheet.data.animations?.idle_left !== undefined;
      const animation = mirror
        ? "idle_left"
        : sheet.data.animations?.[wanted] !== undefined
          ? wanted
          : "idle_down";
      const names = sheet.data.animations?.[animation] ?? [];
      let index = 0;
      if (
        animation === "idle_down" &&
        names.length === character.idleTicks.length
      ) {
        const cycle = character.idleTicks.reduce(
          (sum, ticks) => sum + ticks,
          0,
        );
        let left = state.tick % cycle;
        while (left >= (character.idleTicks[index] ?? cycle)) {
          left -= character.idleTicks[index] ?? cycle;
          index += 1;
        }
      }
      const name = names[index] ?? names[0];
      const texture = name === undefined ? undefined : sheet.textures[name];
      if (name === undefined || texture === undefined) continue;
      sprite.texture = texture;
      if (texture.defaultAnchor !== undefined)
        sprite.anchor.copyFrom(texture.defaultAnchor);
      const s = character.scale ?? 0.5;
      const isFairy = npc.id.startsWith("fairy-");
      const pose = !livingMotion || npc.id === "bus-stop"
        ? NEUTRAL_POSE
        : isFairy
          ? fairyHover(state.tick, npcIndex)
          : idleBreathing(state.tick, (npcIndex + 1) * 0.9);
      sprite.scale.set((mirror ? -s : s) * pose.scaleX, s * pose.scaleY);
      sprite.position.set(npc.point.x + pose.offsetX, npc.point.y + pose.offsetY);
      sprite.rotation = pose.rotation;
      sprite.zIndex = npc.point.y;
      if (shadow !== null) {
        if (isFairy) {
          const altScale = liftShadowScale(pose.offsetY);
          shadow.position.set(npc.point.x, npc.point.y + 8);
          shadow.width = 28 * altScale;
          shadow.height = 12 * altScale;
          shadow.alpha = 0.24 * altScale;
        } else {
          const width = npc.id === "oliver" ? 34 : ADULT_NPCS.has(npc.id) ? 52 : 48;
          shadow.position.set(npc.point.x, npc.point.y);
          shadow.width = width;
          shadow.height = width * 0.38;
          shadow.alpha = shadowAlpha;
        }
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
      const calm = critter.mood === "calm";
      const frame = calm ? "calm_idle_01" : "chaos_idle_01";
      const texture = sheet.textures[frame];
      const auraTexture = sheet.textures.chaos_aura_01;
      if (texture === undefined || auraTexture === undefined) continue;
      const scale = content.overworldHeight / content.figureHeight;
      body.texture = texture;
      body.anchor.set(0.5, 504 / 512);
      const talking = calm && state.dialogue !== null && state.dialogue.knot === content.calmKnot;
      const flipX = talking
        ? state.player.x > point.x
        : roamer !== null && roamer.facing === "right";
      const noticeTicks = this.world.tunables.roam.noticeTicks;
      const pose = !livingMotion
        ? NEUTRAL_POSE
        : roamer !== null
          ? roamerHop(
              state.tick,
              roamer.moving,
              roamer.notice >= noticeTicks,
              roamer.notice,
              noticeTicks,
              roamer.facing,
            )
          : idleBreathing(state.tick, (index + 1) * 1.1, calm ? 0.012 : 0.02);
      body.scale.set((flipX ? -scale : scale) * pose.scaleX, scale * pose.scaleY);
      body.position.set(point.x + pose.offsetX, point.y + pose.offsetY);
      body.rotation = pose.rotation;
      body.zIndex = point.y;
      const baseWidth = Math.min(76, Math.max(36, content.overworldHeight * 0.56));
      const hopScale = liftShadowScale(pose.offsetY);
      shadow.position.set(point.x, point.y);
      shadow.width = baseWidth * hopScale;
      shadow.height = baseWidth * 0.38 * hopScale;
      shadow.alpha = shadowAlpha * hopScale;
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

  /*
   * The battle backdrop is the area painting itself, scaled so its painted
   * interior covers the whole canvas plus a margin (never smaller than the
   * overworld zoom), centred on the critter and clamped, softly blurred. The
   * margin keeps the blur's edge fade off-screen.
   */
  private renderBackdrop(
    state: State,
    width: number,
    height: number,
    zoom = 1,
  ): void {
    const area = this.areaView?.area;
    if (area === undefined) return;
    // A battle centres on its critter; the claw machine on Fae, who stands at it.
    const focus = battleFoe(this.world, state)?.point ??
      (state.arcade !== null ? state.player : undefined) ?? {
        x: area.width / 2,
        y: area.height / 2,
      };
    // Watercolour areas fade to bare paper near their edges (the plaza by
    // about 120 units at the sides and 50 at the top and bottom), so frame
    // only the painted interior, 8% in from every side.
    const insetX = area.width * 0.08;
    const insetY = area.height * 0.08;
    const margin = 32;
    const baseCover = Math.max(
      (width + margin * 2) / (area.width - insetX * 2),
      (height + margin * 2) / (area.height - insetY * 2),
      Math.min(width / this.viewWidth, height / this.viewHeight),
    );
    const cover = baseCover * zoom;
    const clamp = (value: number, low: number, high: number): number =>
      Math.min(high, Math.max(low, value));
    const x = clamp(
      width / 2 - focus.x * cover,
      width + margin - (area.width - insetX) * cover,
      -margin - insetX * cover,
    );
    const y = clamp(
      height / 2 - focus.y * cover,
      height + margin - (area.height - insetY) * cover,
      -margin - insetY * cover,
    );
    if (this.backdropTexture === undefined && this.areaView !== undefined) {
      // Blur the painting (the plate with its props) once into a small
      // texture: the backdrop is static, so each battle frame draws one sprite
      // instead of a full-screen blur (slow without a GPU, costly on a phone).
      this.backdropTexture = this.areaView.withScenery((ground) => {
        ground.filters = [this.backdropBlur];
        const texture = this.renderer.generateTexture({
          target: ground,
          frame: new Rectangle(0, 0, area.width, area.height),
          resolution: 0.5,
        });
        ground.filters = [];
        return texture;
      });
      this.backdropSprite.texture = this.backdropTexture;
    }
    this.backdropSprite.scale.set(cover);
    this.backdropSprite.position.set(x, y);
    this.battleBackdrop = {
      x,
      y,
      width: area.width * cover,
      height: area.height * cover,
    };
  }

  private renderBattle(
    state: State,
    width: number,
    height: number,
    _resolution: number,
  ): void {
    const battle = state.battle;
    const arcade = state.arcade;
    if (battle === null && arcade === null) {
      this.battleLayer.visible = false;
      this.battleWash.visible = false;
      this.backdropSprite.visible = false;
      this.viewport.visible = true;
      this.scene.visible = true;
      this.battleBackdrop = null;
      for (const sprite of this.battleVfxSprites) sprite.visible = false;
      if (this.backdropTexture !== undefined) {
        this.backdropTexture.destroy(true);
        this.backdropTexture = undefined;
      }
      return;
    }
    this.battleLayer.visible = battle !== null;
    this.battleWash.visible = true;
    this.backdropSprite.visible = true;
    this.viewport.visible = false;
    this.scene.visible = false;
    const introProgress = battle?.phase === "intro"
      ? Math.min(1, Math.max(0, battle.phaseTicks / 18))
      : 1;
    const introEase = introProgress * (2 - introProgress);
    const backdropZoom = battle?.phase === "intro" ? 1 + 0.05 * (1 - introEase) : 1;
    this.renderBackdrop(state, width, height, backdropZoom);
    const scale = Math.min(width / this.viewWidth, height / this.viewHeight);
    const x = (width - this.viewWidth * scale) / 2;
    const y = (height - this.viewHeight * scale) / 2;
    // The claw machine's close-up is DOM over the blurred room: no battle
    // figures, and a lighter wash.
    const drawWash = (alpha: number): void => {
      const washKey = `${width}x${height}@${alpha}`;
      if (washKey === this.battleWashKey) return;
      this.battleWashKey = washKey;
      this.battleWash.clear().rect(0, 0, width, height).fill({ color: 0xfff6e6, alpha });
    };
    if (arcade !== null) {
      drawWash(0.28);
      return;
    }
    if (battle === null) return;
    const layout = this.layoutFor(state, width, height);
    const viewModel = battleView(this.world, state);
    const fighting = battleParty(this.world, state.party);
    const partyIds = fighting.map((member) => member.id);
    const partyCommands: Record<string, string | null> = {};
    for (const member of fighting) {
      partyCommands[member.id] = this.world.party[member.id]?.command?.id ?? null;
    }
    const choreo = computeBattleChoreography(
      battle,
      viewModel,
      state.tick,
      partyIds,
      partyCommands,
    );
    this.battleLayer.scale.set(scale);
    this.battleLayer.position.set(
      x + choreo.stageShake.x * scale,
      y + choreo.stageShake.y * scale,
    );
    drawWash(0.2);
    // Warm-cream radial focus spotlight centred behind the combatants, kept
    // well inside the viewport so the four painted corners stay untouched.
    this.battleSpotlight.position.set(this.viewWidth * 0.44, this.viewHeight * 0.46);
    this.battleSpotlight.width = this.viewWidth * 0.72;
    this.battleSpotlight.height = this.viewHeight * 0.68;

    const slideOffset = 14 * (1 - introEase);
    const critter = this.world.critters[battle.critterId];
    if (critter === undefined) return;
    const sheet = Assets.get<Spritesheet | undefined>(critter.atlas);
    if (sheet === undefined) return;
    const peekabooWatching =
      battle.phase === "check" &&
      battle.check?.kind === "peekaboo" &&
      peekabooStatus(battle.check) === "watching";
    const critterFrame =
      battle.phase === "soothed"
        ? "soothed_01"
        : battle.phase === "reward"
          ? "calm_idle_01"
          : battle.phase === "burst" ||
              (battle.phase === "check" &&
                battle.check?.side === "fae" &&
                (battle.check.kind !== "peekaboo" || peekabooWatching))
            ? "chaos_burst_01"
            : "chaos_idle_01";
    const body = sheet.textures[critterFrame];
    const aura = sheet.textures.chaos_aura_01;
    if (body === undefined || aura === undefined)
      throw new Error("Missing battle critter frame");
    this.battleCritter.texture = body;
    this.battleCritter.anchor.set(0.5, 504 / 512);
    // A wind-up swells the critter from its feet, 6% a turn, breathing a
    // little as it puffs (spec 8.1); the aura swells with it.
    const puff = viewModel?.puff ?? 0;
    const swell = puff === 0 ? 1 : 1 + 0.06 * puff + 0.012 * Math.sin(state.tick / 7);
    const critterScale = (critter.battleHeight / critter.figureHeight) * swell;
    const critterPose = choreo.critter;
    this.battleCritter.scale.set(
      critterScale * critterPose.scaleX,
      critterScale * critterPose.scaleY,
    );
    const critterX = (layout.critter.x - x) / scale + slideOffset;
    const critterY = (layout.critter.baseline - y) / scale;
    this.battleCritter.position.set(
      critterX + critterPose.offsetX,
      critterY + critterPose.offsetY,
    );
    this.battleCritter.rotation = critterPose.rotation;
    const critterShadowBase = Math.min(190, Math.max(92, critter.battleHeight * 0.58));
    const critterLift = liftShadowScale(critterPose.offsetY);
    const critterShadowScale = (1 + (swell - 1) * 0.65) * critterLift;
    this.battleCritterShadow.position.set(critterX + critterPose.offsetX * 0.85, critterY);
    this.battleCritterShadow.width = critterShadowBase * critterShadowScale;
    this.battleCritterShadow.height =
      critterShadowBase * 0.32 * (1 + (swell - 1) * 0.5) * critterLift;
    this.battleCritterShadow.alpha = 0.34 * critterLift;

    this.battleCritterAura.texture = aura;
    placeAura(
      this.battleCritterAura,
      this.battleCritter.position,
      critterScale * choreo.auraScaleBoost,
      critter.auraCentre,
      critter.bodyCentre,
    );
    // The aura fades as the critter is soothed, and a calm one (the reward)
    // has none.
    this.battleCritterAura.alpha =
      battle.phase === "reward"
        ? 0
        : battle.phase === "soothed"
          ? Math.max(0, 1 - battle.phaseTicks / 30)
          : 0.65 + Math.sin(state.tick / 18) * 0.2;
    this.battleCritterAura.rotation = state.tick / 180;
    const faeSheet = Assets.get<Spritesheet>("fae-sheet");
    const faeFrames = faeSheet.animations.idle_up;
    const fae = faeFrames?.[0];
    const faeX = (layout.fae.x - x) / scale - slideOffset;
    const faeY = (layout.fae.baseline - y) / scale;
    const faePose = choreo.fae;
    if (fae !== undefined) {
      this.battleFae.texture = fae;
      if (fae.defaultAnchor !== undefined)
        this.battleFae.anchor.copyFrom(fae.defaultAnchor);
      this.battleFae.scale.set(0.58 * faePose.scaleX, 0.58 * faePose.scaleY);
      this.battleFae.position.set(faeX + faePose.offsetX, faeY + faePose.offsetY);
      this.battleFae.rotation = faePose.rotation;
      this.battleFae.tint = warmFlashTint(faePose.tintFlash);
    }
    const faeLift = liftShadowScale(faePose.offsetY);
    this.battleFaeShadow.position.set(faeX + faePose.offsetX * 0.85, faeY);
    this.battleFaeShadow.width = 68 * faeLift;
    this.battleFaeShadow.height = 22 * faeLift;
    this.battleFaeShadow.alpha = 0.34 * faeLift;

    // The party stands with Fae: a sitter (Maddie) sits facing the critter,
    // anyone else is seen from behind like Fae. Flute friends sit it out.
    const inParty = new Set(fighting.map((member) => member.id));
    for (const [id, sprite] of this.battlePartySprites) {
      const visible = inParty.has(id);
      sprite.visible = visible;
      const shadow = this.battlePartyShadows.get(id);
      if (shadow !== undefined) shadow.visible = visible;
    }
    const partyAnchors = new Map<string, Point>();
    fighting.forEach((member, index) => {
      const sprite = this.battlePartySprites.get(member.id);
      const content = this.world.party[member.id];
      const place = layout.party[index];
      if (sprite === undefined || content === undefined || place === undefined)
        return;
      const memberSheet = Assets.get<Spritesheet>(`${member.id}-sheet`);
      const pose = content.sits ? "idle_down" : "idle_up";
      const frame = (memberSheet.animations[pose] ??
        memberSheet.animations.idle_down)?.[0];
      if (frame === undefined) return;
      sprite.texture = frame;
      if (frame.defaultAnchor !== undefined)
        sprite.anchor.copyFrom(frame.defaultAnchor);
      const baseScale = ((content.scale ?? 0.5) / 0.5) * 0.58;
      const memberPose = choreo.party[member.id] ?? NEUTRAL_POSE;
      sprite.scale.set(baseScale * memberPose.scaleX, baseScale * memberPose.scaleY);
      const memberX = (place.x - x) / scale - slideOffset;
      const memberY = (place.y - y) / scale;
      sprite.position.set(memberX + memberPose.offsetX, memberY + memberPose.offsetY);
      sprite.rotation = memberPose.rotation;
      partyAnchors.set(member.id, { x: memberX, y: memberY - 58 });
      const shadow = this.battlePartyShadows.get(member.id);
      if (shadow !== undefined) {
        const lift = liftShadowScale(memberPose.offsetY);
        const shadowWidth = content.box.width * 1.15 * lift;
        shadow.position.set(memberX + memberPose.offsetX * 0.85, memberY);
        shadow.width = shadowWidth;
        shadow.height = shadowWidth * 0.36;
        shadow.alpha = 0.32 * lift;
      }
    });

    const faeAnchor = { x: faeX, y: faeY - 72 };
    const critterAnchor = { x: critterX, y: critterY - critter.battleHeight * 0.5 };
    for (let i = 0; i < this.battleVfxSprites.length; i += 1) {
      const sprite = this.battleVfxSprites[i];
      if (sprite === undefined) continue;
      const particle = choreo.vfx[i];
      if (particle === undefined || particle.alpha <= 0.01) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      sprite.texture = this.vfx[particle.texture];
      sprite.blendMode = particle.blend;
      sprite.tint = particle.tint;
      sprite.alpha = particle.alpha;
      sprite.scale.set(particle.scaleX, particle.scaleY);
      sprite.rotation = particle.rotation;
      let baseX = critterAnchor.x;
      let baseY = critterAnchor.y;
      if (particle.anchor === "fae") {
        baseX = faeAnchor.x;
        baseY = faeAnchor.y;
      } else if (particle.anchor === "between") {
        const t = particle.t ?? 0.5;
        baseX = faeAnchor.x + (critterAnchor.x - faeAnchor.x) * t;
        baseY = faeAnchor.y + (critterAnchor.y - faeAnchor.y) * t;
      } else if (particle.anchor === "party" && particle.actorId !== undefined) {
        const actorAnchor = partyAnchors.get(particle.actorId);
        if (actorAnchor !== undefined) {
          baseX = actorAnchor.x;
          baseY = actorAnchor.y;
        }
      }
      sprite.position.set(baseX + particle.offsetX, baseY + particle.offsetY);
    }
    this.battleLayer.alpha = introEase;
  }

  // The one battle layout (spec 8), for the scene, the ring, and renderInfo.
  private layoutFor(state: State, width: number, height: number): BattleLayout {
    return battleLayout(
      width,
      height,
      this.viewWidth,
      this.viewHeight,
      this.world.critters[state.battle?.critterId ?? ""]?.battleHeight ?? 190,
      faeBox.height,
      battleParty(this.world, state.party).length,
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

  // Where the battle's check is drawn, in CSS px (spec 8.1); null outside a
  // check and at the reward (the card covers it). A ring sits on the critter,
  // or on Fae in a burst. A friend's charge meter stands on the side away from
  // the critter and their chain drops into their hands (Fae's own, for
  // Soothe). A burst's chain flies from the critter to a target on Fae.
  battleCheckGeometry(state: State, width: number, height: number): BattleCheckGeometry | null {
    const check = battleView(this.world, state)?.check ?? null;
    if (check === null || state.battle?.phase === "reward") return null;
    const layout = this.layoutFor(state, width, height);
    const fae = layout.fae;
    const faeCentre = { x: fae.x, y: fae.baseline - fae.height / 2 };
    const critter = layout.critter;
    const critterCentre = { x: critter.x, y: critter.baseline - critter.height / 2 };
    // Hints hang just under the feet line, in the open ground below the
    // party, kept on screen.
    const hintAt = (x: number): Point => ({
      x: Math.min(width - hintHalfWidth, Math.max(hintHalfWidth, x)),
      y: fae.baseline + 0.18 * fae.height,
    });
    if (check.kind === "ring")
      return check.side === "fae"
        ? { kind: "ring", ...faeCentre, radius: 0.55 * fae.height, hintAt: hintAt(fae.x) }
        : {
            kind: "ring",
            ...critterCentre,
            radius: 0.55 * critter.height,
            hintAt: hintAt(critter.x),
          };
    if (check.kind === "catch") {
      const figure = this.world.critters[state.battle?.critterId ?? ""]?.figureHeight ?? 1;
      return {
        kind: "catch",
        lanes: [
          fae.baseline - 1.05 * fae.height,
          fae.baseline - 0.55 * fae.height,
          fae.baseline - 0.1 * fae.height,
        ],
        fromX: critter.x - 0.35 * critter.height,
        catcherX: fae.x + 0.7 * fae.height,
        radius: 0.2 * fae.height,
        toyScale: (critter.height / figure) *
           (this.world.critters[state.battle?.critterId ?? ""]?.toyScale ?? 1),
        // Midway between the catch and the critter: the open ground clear of
        // the touch arrows (bottom left, past the notch inset) and confirm.
        hintAt: hintAt((fae.x + 0.7 * fae.height + critter.x) / 2),
      };
    }
    // Fae's figure stands about 1.3 heights tall: the track rides just over
    // her bun, under the HUD, and the swooshes blow along her front.
    if (check.kind === "lean")
      return {
        kind: "lean",
        track: {
          x: fae.x,
          y: fae.baseline - 1.45 * fae.height,
          width: 1.6 * fae.height,
          height: Math.max(12, 0.12 * fae.height),
        },
        wind: {
          x: fae.x + fae.height,
          rows: [1.05, 0.8, 0.55, 0.3].map((share) => fae.baseline - share * fae.height),
          length: Math.max(56, 0.6 * fae.height),
        },
        // Midway between Fae and the critter, like a catch's: clear of the
        // touch arrows bottom left.
        hintAt: hintAt((fae.x + critter.x) / 2),
      };
    if (check.kind === "peekaboo") {
      const trackWidth = Math.max(128, Math.min(200, 1.65 * fae.height));
      const trackHeight = Math.max(14, Math.min(20, 0.13 * fae.height));
      const x = Math.max(trackWidth / 2 + 24, fae.x);
      const y = Math.max(131, fae.baseline - 1.52 * fae.height);
      return {
        kind: "peekaboo",
        x,
        y,
        track: { x, y, width: trackWidth, height: trackHeight },
        hintAt: hintAt((fae.x + critter.x) / 2),
      };
    }
    if (check.side === "fae" && check.kind !== "trace")
      return {
        kind: "chain",
        from: critterCentre,
        to: faeCentre,
        radius: 0.3 * fae.height,
        hintAt: hintAt(fae.x),
      };
    if (check.kind === "trace") {
      const size = Math.min(360, Math.max(180, height - 150), width * 0.42);
      const x = Math.max(88, Math.min(width - size - 250, (fae.x + critter.x) / 2 - size / 2));
      const y = Math.max(88, Math.min(height - size - 92, fae.baseline - fae.height - size * 0.08));
      return {
        kind: "trace",
        rect: { x, y, width: size, height: size },
        brush: check.brush,
        points: check.path.points,
        checkpoint: check.checkpoint,
        hintAt: hintAt(x + size / 2),
      };
    }
    const feet = (check.actor === null ? undefined : layout.party[check.actor]) ??
      { x: fae.x, y: fae.baseline };
    if (check.kind === "chain")
      return {
        kind: "chain",
        from: { x: feet.x, y: feet.y - 1.6 * fae.height },
        to: { x: feet.x, y: feet.y - 0.6 * fae.height },
        radius: 0.16 * fae.height,
        hintAt: hintAt(feet.x),
      };
    const meterHeight = 1.1 * fae.height;
    const meterWidth = Math.max(22, 0.18 * fae.height);
    const meterX = feet.x - 0.3 * fae.height - meterWidth;
    return {
      kind: "charge",
      x: meterX,
      y: feet.y - meterHeight,
      width: meterWidth,
      height: meterHeight,
      hintAt: hintAt(meterX + meterWidth / 2),
    };
  }

  // Where the critter's thought cloud floats (spec 8.1), in CSS px: centred
  // in the open ground between Fae's party (Maddie sits on her near side)
  // and the critter's aura, its top just above the critter's head. The shell
  // keeps it below the HUD.
  battleFeelingAnchor(state: State, width: number, height: number): Point | null {
    if (state.battle === null) return null;
    const layout = this.layoutFor(state, width, height);
    const nearSide = layout.fae.x + 0.45 * layout.fae.height;
    const auraEdge = layout.critter.x - 0.62 * layout.critter.height;
    const critterTop = layout.critter.baseline - layout.critter.height;
    return { x: (nearSide + auraEdge) / 2, y: critterTop - 0.4 * layout.fae.height };
  }

  private battleCheckInfo(state: State): BattleCheckInfo | null {
    const check = state.battle?.check ?? null;
    const geometry = this.battleCheckGeometry(state, window.innerWidth, window.innerHeight);
    if (check === null || geometry === null) return null;
    const side = check.side;
    if (geometry.kind === "chain") return { ...geometry, side, x: geometry.to.x, y: geometry.to.y };
    if (geometry.kind === "catch") {
      const lane = check.kind === "catch" ? check.catcher : 1;
      const y = geometry.lanes[lane] ?? geometry.lanes[1];
      return { ...geometry, side, x: geometry.catcherX, y };
    }
    if (geometry.kind === "lean") {
      const view = battleView(this.world, state)?.check;
      const balance = view?.kind === "lean" ? view.balance : 0;
      const { track } = geometry;
      return { ...geometry, side, x: track.x + balance * track.width / 2, y: track.y };
    }
    if (geometry.kind === "trace")
      return {
        ...geometry,
        side,
        x: geometry.rect.x + geometry.rect.width * geometry.brush.x / 1000,
        y: geometry.rect.y + geometry.rect.height * geometry.brush.y / 1000,
      };
    if (geometry.kind === "peekaboo") return { ...geometry, side };
    return { ...geometry, side };
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
    battle: {
      phase: string | null;
      talk: {
        speaker: string | null;
        text: string;
        revealed: number;
        choices: string[];
        selected: number;
      } | null;
      check: BattleCheckInfo | null;
      critter: { id: string; frame: string } | null;
      layout: {
        critter: { x: number; baseline: number; height: number };
        fae: { x: number; baseline: number; height: number };
        party: { x: number; y: number }[];
      } | null;
      backdrop: { x: number; y: number; width: number; height: number } | null;
      overworldVisible: boolean;
      auraAlpha: number;
    };
  } {
    const fade = fadeAlpha(state.transition, this.world.tunables.doorFadeTicks);
    const layout =
      state.battle === null
        ? null
        : this.layoutFor(state, window.innerWidth, window.innerHeight);
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
      battle: {
        phase: state.battle?.phase ?? null,
        talk: state.battle?.talk === null || state.battle?.talk === undefined
          ? null
          : {
              speaker: state.battle.talk.speaker,
              text: state.battle.talk.text,
              revealed: state.battle.talk.revealed,
              choices: state.battle.talk.choices.slice(),
              selected: state.battle.talk.selected,
            },
        check: this.battleCheckInfo(state),
        layout,
        backdrop: this.battleBackdrop,
        critter:
          state.battle === null
            ? null
            : {
                id: state.battle.critterId,
                frame:
                  state.battle.phase === "soothed"
                    ? "soothed_01"
                    : state.battle.phase === "reward"
                      ? "calm_idle_01"
                      : state.battle.phase === "burst" ||
                          (state.battle.phase === "check" &&
                            state.battle.check?.side === "fae" &&
                            (state.battle.check.kind !== "peekaboo" ||
                              peekabooStatus(state.battle.check) === "watching"))
                        ? "chaos_burst_01"
                        : "chaos_idle_01",
              },
        overworldVisible: this.scene.visible,
        auraAlpha: state.battle === null ? 0 : this.battleCritterAura.alpha,
      },
    };
  }
}
