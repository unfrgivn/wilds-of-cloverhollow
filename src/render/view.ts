import { Container, Graphics, Text } from "pixi.js";
import type { Area, Point, State, World } from "../core";
import { followCamera } from "./camera";

export class GameView {
  readonly root = new Container();
  private readonly background = new Graphics();
  private readonly scene = new Container();
  private readonly room = new Graphics();
  private readonly player = new Graphics();
  private readonly viewportMask = new Graphics();
  /** Dev/harness-only readout (`tick N · x,y`) so screenshots describe state. */
  private readonly label: Text | undefined;
  private areaId = "";
  private viewWidth = 960;
  private viewHeight = 720;
  private previousCamera: Point | undefined;

  constructor(
    private readonly world: World,
    options: { debugLabel: boolean },
  ) {
    this.player
      .circle(0, 0, this.world.tunables.playerRadius)
      .fill(0xffd166)
      .stroke({ width: 4, color: 0x6b4e3d });
    this.root.addChild(this.background, this.scene, this.viewportMask);
    if (options.debugLabel) {
      this.label = new Text({
        text: "",
        style: { fill: 0x513b32, fontSize: 18 },
      });
      this.label.position.set(20, 20);
      this.root.addChild(this.label);
    }
    this.scene.mask = this.viewportMask;
    this.scene.addChild(this.room, this.player);
  }

  resize(width: number, height: number): void {
    this.viewWidth = Math.max(960, Math.min(1600, (720 * width) / height));
    this.viewHeight = 720;
  }

  private rebuildArea(area: Area): void {
    this.room.clear();
    this.room
      .poly(area.walkable.map(([x, y]) => ({ x, y })))
      .fill(0xc7e4c2)
      .stroke({ width: 8, color: 0x795548 });
    for (const blocker of area.blockers) {
      this.room
        .poly(blocker.map(([x, y]) => ({ x, y })))
        .fill(0xc58d62)
        .stroke({ width: 8, color: 0x70452f });
    }
    this.areaId = area.id;
  }

  resetCamera(): void {
    this.previousCamera = undefined;
  }

  render(
    state: State,
    width: number,
    height: number,
    resolution: number,
  ): void {
    const area = this.world.areas[state.area];
    if (area === undefined)
      throw new Error(`Unknown render area: ${state.area}`);
    if (area.id !== this.areaId) {
      this.rebuildArea(area);
      this.resetCamera();
    }
    this.resize(width, height);
    this.background.clear().rect(0, 0, width, height).fill(0xf8edcf);
    const scale = Math.min(width / this.viewWidth, height / this.viewHeight);
    const deadZone = { x: 80, y: 60 };
    const camera = followCamera(
      this.previousCamera,
      state.player,
      {
        width: this.viewWidth,
        height: this.viewHeight,
      },
      area,
      deadZone,
    );
    this.previousCamera = camera;
    const letterboxX = (width - this.viewWidth * scale) / 2;
    const letterboxY = (height - this.viewHeight * scale) / 2;
    const offsetX =
      Math.round((letterboxX - camera.x * scale) * resolution) / resolution;
    const offsetY =
      Math.round((letterboxY - camera.y * scale) * resolution) / resolution;
    this.scene.scale.set(scale);
    this.scene.x = offsetX;
    this.scene.y = offsetY;
    this.player.position.set(state.player.x, state.player.y);
    this.viewportMask
      .clear()
      .rect(
        letterboxX,
        letterboxY,
        this.viewWidth * scale,
        this.viewHeight * scale,
      )
      .fill(0xffffff);
    if (this.label !== undefined) {
      const position = `${Math.round(state.player.x)},${Math.round(state.player.y)}`;
      const text = `Cloverhollow • tick ${state.tick} · ${position}`;
      if (this.label.text !== text) this.label.text = text;
    }
  }
}
