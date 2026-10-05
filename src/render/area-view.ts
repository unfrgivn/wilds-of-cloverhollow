import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import type { Area } from "../core";
import { parseGroundManifest, parseOccluderManifest } from "../content/load";
import { assetUrl } from "../platform/assets";

const colour = (value: string): number => parseInt(value.slice(1), 16);

async function json(path: string): Promise<unknown> {
  const response = await fetch(assetUrl(path));
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

export class AreaView {
  readonly ground = new Container();
  readonly paper: number;
  private readonly textures: string[] = [];
  private readonly sprites: Sprite[] = [];

  private constructor(
    readonly area: Area,
    private readonly depth: Container,
    paper: number,
  ) {
    this.paper = paper;
  }

  static async load(area: Area, depth: Container): Promise<AreaView> {
    if (area.ground === undefined) {
      const view = new AreaView(area, depth, 0xf8edcf);
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
    const view = new AreaView(area, depth, colour(manifest.paper));
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
      depth.addChild(sprite);
    }
    return view;
  }

  async destroy(): Promise<void> {
    for (const sprite of this.sprites) {
      sprite.removeFromParent();
      sprite.destroy({ texture: false });
    }
    this.ground.destroy({ children: true });
    const unique = [...new Set(this.textures)];
    await Promise.all(unique.map((path) => Assets.unload(path)));
  }
}
