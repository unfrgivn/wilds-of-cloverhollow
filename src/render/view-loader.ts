import { Assets, type Container, type Spritesheet } from "pixi.js";
import type { Area, World } from "../core";
import { assetUrl } from "../platform/assets";
import { CHARACTER_POSE_ATLASES } from "./animation";
import { AreaView } from "./area-view";
import { cutsceneAreaAtlases } from "./cutscene-render";
import { CLUBHOUSE_PRIZES_ALIAS } from "./overworld-effects";
import { areaEntityAtlases, type EntityAtlas } from "./overworld-render";
import { RESTORATION_ATLAS_ALIAS, RESTORATION_ATLAS_URL } from "./restoration";
import { computeAreaEvictions } from "./view-projections";

/** Loads a Pixi spritesheet with mipmap generation enabled for crisp zoom scaling. */
export function mipmapSheet(alias: string, src: string): Promise<Spritesheet> {
  return Assets.load<Spritesheet>({
    alias,
    src,
    data: { textureOptions: { autoGenerateMipmaps: true } },
  });
}

/**
 * Manages permanent Pixi spritesheets, per-area texture/entity loading and prefetching,
 * and bounded current + previous area cache residency for `GameView`.
 */
export class AreaAssetManager {
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

  constructor(private readonly world: World) {
    this.permanentAliases = new Set([
      "fae-sheet",
      "glow-sheet",
      "ambient-sheet",
      RESTORATION_ATLAS_ALIAS,
      world.battle.toyAtlas,
      ...Object.keys(world.party).map((id) => `${id}-sheet`),
      ...Object.keys(CHARACTER_POSE_ATLASES).map((id) => `${id}-poses`),
    ]);
  }

  /** Preloads permanent character, party, pose, VFX, restoration, and battle toy sheets. */
  async loadPermanentSheets(): Promise<void> {
    await Promise.all([
      mipmapSheet("fae-sheet", assetUrl("assets/characters/fae/fae.json")),
      ...Object.entries(this.world.party).map(([id, member]) =>
        mipmapSheet(`${id}-sheet`, assetUrl(member.atlas)),
      ),
      ...Object.entries(CHARACTER_POSE_ATLASES).map(([id, atlas]) =>
        mipmapSheet(`${id}-poses`, assetUrl(atlas)),
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
    const base = area.id === "clubhouse"
      ? [...entities, { alias: CLUBHOUSE_PRIZES_ALIAS, src: assetUrl(this.world.arcade.atlas) }]
      : entities;
    return [...base, ...cutsceneAreaAtlases(this.world, area, base)];
  }

  /** Loads an area's ground, props, and entity atlases, then evicts displaced residency cache. */
  async loadArea(
    area: Area,
    depth: Container,
    previous: AreaView | undefined,
  ): Promise<AreaView> {
    const previousEntities = this.currentEntityAliases;
    const areaAtlases = this.areaAtlasesFor(area);
    const [next] = await Promise.all([
      AreaView.load(area, depth),
      ...areaAtlases.map((entry) => mipmapSheet(entry.alias, entry.src)),
    ]);
    const nextEntities = areaAtlases.map((entry) => entry.alias);
    this.currentEntityAliases = nextEntities;
    await this.evict(previous, next, previousEntities, nextEntities);
    for (const url of next.textureUrls) this.areaTextureUrls.add(url);
    return next;
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
    if (unloadKeys.length > 0) {
      await Promise.all(unloadKeys.map((key) => Assets.unload(key)));
    }
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

  /** Loads a battle critter's spritesheet on demand (used by Sanctuary Dream Memory Encore). */
  async ensureCritterAtlas(critterId: string): Promise<void> {
    const atlas = this.world.critters[critterId]?.atlas;
    if (atlas === undefined || Assets.get<Spritesheet | undefined>(atlas) !== undefined) return;
    await mipmapSheet(atlas, assetUrl(atlas));
    if (!this.currentEntityAliases.includes(atlas)) {
      this.currentEntityAliases = [...this.currentEntityAliases, atlas];
    }
  }

  /** Reports area ground and prop texture URLs currently resident in Pixi's Assets cache. */
  cachedAreaTextures(): string[] {
    return [...this.areaTextureUrls].filter((url) => Assets.cache.has(url));
  }
}
