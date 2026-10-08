import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { Spritesheet } from "pixi.js";
import {
  faeBox, propCovers, propStateName, type Area, type Point, type Prop, type World,
} from "../core";
import { bodyCover } from "../content/area-checks";
import { parseGroundManifest, parseOccluderManifest } from "../content/load";
import { assetUrl } from "../platform/assets";

const colour = (value: string): number => parseInt(value.slice(1), 16);

// A canopy fades to this alpha while Fae stands behind it, this much a tick.
const CANOPY_ALPHA = 0.4;
const CANOPY_STEP = 0.08;

async function json(path: string): Promise<unknown> {
  const response = await fetch(assetUrl(path));
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

// A box in world units.
export type Rect = { x0: number; y0: number; x1: number; y1: number };
type Strip = { sprite: Sprite; left: number; right: number; top: number; bottom: number };
// One prop state's art: its strips (each a slice of the frame, sorted by the
// front edge of its columns), its whole frame, and its shadow decal.
type StateView = {
  strips: Strip[];
  frame: Texture;
  shadow: Sprite | undefined;
};
type PropView = { prop: Prop; states: Map<string, StateView>; shown: string; alpha: number };

function frameTexture(sheets: Spritesheet[], name: string): Texture {
  for (const sheet of sheets) {
    const texture = sheet.textures[name];
    if (texture !== undefined) return texture;
  }
  throw new Error(`No prop frame ${name}`);
}

/*
 * A prop state as strips: consecutive columns with the same front y share one
 * sprite. Each strip is a sub-texture of the same atlas page, so the strips
 * draw exactly the frame, and each sorts by its own front edge (spec 6).
 */
function stateStrips(prop: Prop, name: string, frame: Texture): StateView["strips"] {
  const state = prop.states[name];
  if (state === undefined) throw new Error(`${prop.id} has no state ${name}`);
  const anchor = frame.defaultAnchor ?? { x: 0.5, y: 1 };
  const width = frame.frame.width / 2;
  const top = prop.y - anchor.y * (frame.frame.height / 2);
  const bottom = top + frame.frame.height / 2;
  const { left: origin, step, ys } = state.front;
  const groups: { from: number; to: number; y: number }[] = [];
  ys.forEach((y, index) => {
    const last = groups.at(-1);
    if (last !== undefined && Math.abs(last.y - y) < 0.01) last.to = index + 1;
    else groups.push({ from: index, to: index + 1, y });
  });
  return groups.flatMap(({ from, to, y }) => {
    const left = origin + from * step;
    const right = Math.min(origin + to * step, origin + width);
    if (right <= left) return [];
    const pixels = prop.flip ? frame.frame.width - (right - origin) * 2 : (left - origin) * 2;
    const texture = new Texture({
      source: frame.source,
      frame: new Rectangle(frame.frame.x + pixels, frame.frame.y, (right - left) * 2,
        frame.frame.height),
    });
    const sprite = new Sprite(texture);
    sprite.label = `prop:${prop.id}`;
    sprite.zIndex = y;
    sprite.scale.set(prop.flip ? -0.5 : 0.5, 0.5);
    sprite.position.set(prop.flip ? right : left, top);
    return [{ sprite, left, right, top, bottom }];
  });
}

function anchored(texture: Texture, prop: Prop): Sprite {
  const sprite = new Sprite(texture);
  if (texture.defaultAnchor !== undefined) sprite.anchor.copyFrom(texture.defaultAnchor);
  sprite.position.set(prop.x, prop.y);
  sprite.scale.set(prop.flip ? -0.5 : 0.5, 0.5);
  return sprite;
}

export class AreaView {
  // The ground plate, with the props' shadow decals multiplied over it.
  readonly ground = new Container();
  readonly paper: number;
  private readonly shadows = new Container();
  private readonly textures: string[] = [];
  private readonly sprites: Sprite[] = [];
  private readonly canopies: { occluder: Area["occluders"][number]; sprite: Sprite }[] = [];
  private readonly props: PropView[] = [];
  private canopyTick: number | undefined;

  private constructor(
    readonly area: Area,
    paper: number,
  ) {
    this.paper = paper;
  }

  get textureUrls(): readonly string[] {
    return this.textures;
  }

  static async load(area: Area, depth: Container): Promise<AreaView> {
    if (area.ground === undefined) {
      const view = new AreaView(area, 0xf8edcf);
      const room = new Graphics();
      room.poly(area.walkable.map(([x, y]) => ({ x, y }))).fill(0xc7e4c2);
      for (const blocker of area.blockers)
        room.poly(blocker.map(([x, y]) => ({ x, y }))).fill(0xc58d62);
      view.ground.addChild(room);
      return view;
    }
    const root = `assets/areas/${area.ground}`;
    const manifest = parseGroundManifest(
      await json(`${root}/ground.json`),
      `${root}/ground.json`,
    );
    const view = new AreaView(area, colour(manifest.paper));
    for (const tile of manifest.tiles) {
      const path = assetUrl(`${root}/${tile.file}`);
      const texture = await Assets.load<Texture>({
        src: path,
        data: { autoGenerateMipmaps: true },
      });
      view.textures.push(path);
      const sprite = new Sprite(texture);
      sprite.position.set(tile.x / 2, tile.y / 2);
      sprite.scale.set(0.5);
      view.sprites.push(sprite);
      view.ground.addChild(sprite);
    }
    view.ground.addChild(view.shadows);
    if (area.occluders.length > 0) {
      const cutouts = parseOccluderManifest(
        await json(`${root}/occluders.json`),
        `${root}/occluders.json`,
      );
      for (const cutout of cutouts.cutouts) {
        const occluder = area.occluders.find((item) => item.id === cutout.id);
        if (occluder === undefined) continue;
        const path = assetUrl(`${root}/${cutout.file}`);
        const texture = await Assets.load<Texture>({
          src: path,
          data: { autoGenerateMipmaps: true },
        });
        view.textures.push(path);
        const sprite = new Sprite(texture);
        sprite.position.set(cutout.x, cutout.y);
        sprite.scale.set(0.5);
        sprite.label = `occluder:${cutout.id}`;
        sprite.zIndex = occluder.baseline;
        view.sprites.push(sprite);
        if (occluder.canopy === true) view.canopies.push({ occluder, sprite });
        depth.addChild(sprite);
      }
    }
    const sheets: Spritesheet[] = [];
    for (const atlas of area.atlases) {
      const path = assetUrl(atlas);
      sheets.push(await Assets.load<Spritesheet>({
        src: path,
        data: { textureOptions: { autoGenerateMipmaps: true } },
      }));
      view.textures.push(path);
    }
    for (const prop of area.props) {
      const states = new Map<string, StateView>();
      for (const [name, state] of Object.entries(prop.states)) {
        const frame = frameTexture(sheets, state.frame);
        const strips = stateStrips(prop, name, frame);
        for (const { sprite } of strips) {
          sprite.visible = false;
          view.sprites.push(sprite);
          depth.addChild(sprite);
        }
        let shadow: Sprite | undefined;
        if (state.shadow !== null) {
          shadow = anchored(frameTexture(sheets, state.shadow), prop);
          shadow.label = `prop-shadow:${prop.id}`;
          shadow.blendMode = "multiply";
          shadow.visible = false;
          view.sprites.push(shadow);
          view.shadows.addChild(shadow);
        }
        states.set(name, { strips, frame, shadow });
      }
      view.props.push({ prop, states, shown: "", alpha: 1 });
    }
    return view;
  }

  /*
   * Shows each prop in its current state, and fades the canopies Fae is
   * behind (spec 6): a canopy fades while it covers more than 5% of her body
   * and eases back once she steps out. It moves by ticks, not frames, so it
   * fades alike at any frame rate and in the paused harness. A painted prop
   * is drawn only where it overlaps one of `figures` (everyone in the depth
   * layer): the plate already shows it everywhere else, pixel for pixel.
   * Render-only.
   */
  update(world: World, ink: string, feet: Point, tick: number, figures: Rect[]): void {
    const ticks = this.canopyTick === undefined
      ? 1
      : Math.min(Math.max(tick - this.canopyTick, 0), 30);
    this.canopyTick = tick;
    const ease = (alpha: number, behind: boolean): number => {
      const gap = (behind ? CANOPY_ALPHA : 1) - alpha;
      return alpha + Math.sign(gap) * Math.min(Math.abs(gap), CANOPY_STEP * ticks);
    };
    for (const { occluder, sprite } of this.canopies)
      sprite.alpha = ease(sprite.alpha,
        feet.y < occluder.baseline && bodyCover(occluder.polygon, feet) > 0.05);
    for (const view of this.props) {
      const shown = propStateName(world, ink, view.prop);
      if (shown !== view.shown) {
        for (const [name, state] of view.states) {
          for (const { sprite } of state.strips) sprite.visible = name === shown;
          if (state.shadow !== undefined) state.shadow.visible = name === shown;
        }
        view.shown = shown;
      }
      if (view.prop.painted)
        for (const strip of view.states.get(shown)?.strips ?? [])
          strip.sprite.visible = figures.some((box) => box.x0 < strip.right &&
            box.x1 > strip.left && box.y0 < strip.bottom && box.y1 > strip.top);
      const state = view.prop.states[shown];
      if (!view.prop.canopy || state === undefined) continue;
      view.alpha = ease(view.alpha, propCovers(state, feet, faeBox) > 0.05);
      for (const { sprite } of view.states.get(shown)?.strips ?? []) sprite.alpha = view.alpha;
    }
  }

  get canopyAlphas(): { id: string; alpha: number }[] {
    return [
      ...this.canopies.map(({ occluder, sprite }) => ({ id: occluder.id, alpha: sprite.alpha })),
      ...this.props.filter((view) => view.prop.canopy)
        .map((view) => ({ id: view.prop.id, alpha: view.alpha })),
    ];
  }

  // Each prop's state and strips (world x range and sort y), for the harness.
  get propInfo(): {
    id: string;
    state: string;
    strips: { left: number; right: number; zIndex: number }[];
  }[] {
    return this.props.map((view) => ({
      id: view.prop.id,
      state: view.shown,
      strips: (view.states.get(view.shown)?.strips ?? []).map(({ sprite, left, right }) =>
        ({ left, right, zIndex: sprite.zIndex })),
    }));
  }

  /*
   * Lends the plate with every prop on it, whole and in y order, to `draw`
   * (the battle backdrop is rendered from it), then takes the props off.
   */
  withScenery<T>(draw: (target: Container) => T): T {
    const scenery = new Container();
    const order = [...this.props].sort((a, b) => a.prop.y - b.prop.y);
    for (const view of order) {
      const state = view.states.get(view.shown);
      if (state !== undefined) scenery.addChild(anchored(state.frame, view.prop));
    }
    this.ground.addChild(scenery);
    try {
      return draw(this.ground);
    } finally {
      scenery.removeFromParent();
      scenery.destroy({ children: true });
    }
  }

  async destroy(): Promise<void> {
    const slices = this.props.flatMap((view) => [...view.states.values()]
      .flatMap((state) => state.strips.map(({ sprite }) => sprite.texture)));
    for (const sprite of this.sprites) {
      sprite.removeFromParent();
      sprite.destroy({ texture: false });
    }
    // The strips' sub-textures, not the atlas pages they slice.
    for (const texture of slices) texture.destroy();
    this.ground.destroy({ children: true });
    const unique = [...new Set(this.textures)];
    await Promise.all(unique.map((path) => Assets.unload(path)));
  }
}
