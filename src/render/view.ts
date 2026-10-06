import { Assets, Container, Graphics, Sprite, Spritesheet, Text } from "pixi.js";
import {
  hiddenFraction,
  targetInteractable,
  type Area,
  type Point,
  type State,
  type World,
} from "../core";
import { AreaView } from "./area-view";
import { followCamera, worldToScreen } from "./camera";
import { selectFaeAnimation } from "./animation";
import { assetUrl } from "../platform/assets";
import { fadeAlpha } from "./fade";

export class GameView {
  readonly root = new Container();
  readonly ready: Promise<void>;
  private readonly background = new Graphics();
  private readonly paper = new Graphics();
  private readonly fade = new Graphics();
  private readonly scene = new Container();
  private readonly depth = new Container();
  private readonly player = new Sprite();
  private readonly maddie = new Sprite();
  private readonly viewportMask = new Graphics();
  private readonly label: Text | undefined;
  private areaView: AreaView | undefined;
  private viewWidth = 960;
  private viewHeight = 720;
  private previousCamera: Point | undefined;
  private staticWidth = 0;
  private staticHeight = 0;
  private staticPaper = 0;
  private currentAnimation = "idle_down";
  private currentFrame = 0;
  private currentMaddieAnimation = "idle_down";
  private currentMaddieFrame = 0;
  private readonly areaTextureUrls = new Set<string>();

  constructor(
    private readonly world: World,
    options: { debugLabel: boolean },
  ) {
    this.depth.sortableChildren = true;
    this.player.label = "fae";
    this.maddie.label = "maddie";
    this.player.scale.set(0.5);
    this.root.addChild(
      this.background,
      this.paper,
      this.scene,
      this.viewportMask,
      this.fade,
    );
    this.scene.mask = this.viewportMask;
    this.scene.addChild(this.depth);
    this.depth.addChild(this.player);
    this.depth.addChild(this.maddie);
    if (options.debugLabel) {
      this.label = new Text({ text: "", style: { fill: 0x513b32, fontSize: 18 } });
      this.label.position.set(20, 20);
      this.root.addChild(this.label);
    }
    this.ready = this.loadCharacter();
  }

  private async loadCharacter(): Promise<void> {
    await Promise.all([
      Assets.load({
        alias: "fae-sheet",
        src: assetUrl("assets/characters/fae/fae.json"),
        data: { textureOptions: { autoGenerateMipmaps: true } },
      }),
      Assets.load({
        alias: "maddie-sheet",
        src: assetUrl("assets/characters/maddie/maddie.json"),
        data: { textureOptions: { autoGenerateMipmaps: true } },
      }),
    ]);
  }

  async setArea(area: Area): Promise<void> {
    const previous = this.areaView;
    if (previous !== undefined) await previous.destroy();
    const next = await AreaView.load(area, this.depth);
    this.areaView = next;
    for (const url of next.textureUrls) this.areaTextureUrls.add(url);
    this.scene.addChildAt(next.ground, 0);
    this.previousCamera = undefined;
    this.staticWidth = 0;
  }

  resize(width: number, height: number): void {
    this.viewWidth = Math.max(960, Math.min(1600, (720 * width) / height));
    this.viewHeight = 720;
  }

  resetCamera(): void {
    this.previousCamera = undefined;
  }

  loadedAreaId(): string {
    return this.areaView?.area.id ?? "";
  }

  private drawStatic(width: number, height: number, paper: number): void {
    const scale = Math.min(width / this.viewWidth, height / this.viewHeight);
    const letterboxX = (width - this.viewWidth * scale) / 2;
    const letterboxY = (height - this.viewHeight * scale) / 2;
    this.background.clear().rect(0, 0, width, height).fill(0xf8edcf);
    this.paper.clear().rect(letterboxX, letterboxY,
      this.viewWidth * scale, this.viewHeight * scale).fill(paper);
    this.viewportMask.clear().rect(letterboxX, letterboxY,
      this.viewWidth * scale, this.viewHeight * scale).fill(0xffffff);
    this.fade.clear().rect(letterboxX, letterboxY,
      this.viewWidth * scale, this.viewHeight * scale).fill(paper);
    this.fade.alpha = 0;
    this.staticWidth = width;
    this.staticHeight = height;
    this.staticPaper = paper;
  }

  private setFaeTexture(state: State): void {
    const sheet = Assets.get<Spritesheet>("fae-sheet");
    const idleName = state.facing === "right" ? "idle_left" : `idle_${state.facing}`;
    const walkName = state.facing === "right" ? "walk_left" : `walk_${state.facing}`;
    const name = state.motion.moving ? walkName : idleName;
    const frames = sheet.animations[name];
    if (frames === undefined || frames.length === 0)
      throw new Error(`Missing Fae animation ${name}`);
    const selection = selectFaeAnimation(
      state.facing,
      state.motion,
      frames.length,
      this.world.tunables.walkCycleUnits,
    );
    const texture = frames[selection.frame];
    if (texture === undefined) throw new Error(`Missing Fae frame ${selection.frame}`);
    this.player.texture = texture;
    if (texture.defaultAnchor === undefined) throw new Error("Fae anchor missing");
    this.player.anchor.copyFrom(texture.defaultAnchor);
    this.player.scale.x = selection.mirror ? -0.5 : 0.5;
    this.currentAnimation = selection.animation;
    this.currentFrame = selection.frame;
  }

  private setMaddieTexture(state: State): void {
    const sheet = Assets.get<Spritesheet>("maddie-sheet");
    const side = state.maddie.facing === "right" ? "left" : state.maddie.facing;
    const mirror = state.maddie.facing === "right";
    const sitting = !state.maddie.motion.moving &&
      state.maddie.stillTicks >= this.world.tunables.follow.sitDelayTicks;
    const animation = sitting ? `idle_${side}` : `walk_${side}`;
    const frames = sheet.animations[animation];
    if (frames === undefined || frames.length === 0)
      throw new Error(`Missing Maddie animation ${animation}`);
    const frame = sitting ? 0 : state.maddie.motion.moving
      ? Math.floor(state.maddie.motion.distance /
        this.world.tunables.follow.walkCycleUnits * frames.length) % frames.length
      : 0;
    const texture = frames[frame];
    if (texture === undefined) throw new Error(`Missing Maddie frame ${frame}`);
    this.maddie.texture = texture;
    if (texture.defaultAnchor === undefined) throw new Error("Maddie anchor missing");
    this.maddie.anchor.copyFrom(texture.defaultAnchor);
    this.maddie.scale.x = mirror ? -0.5 : 0.5;
    this.currentMaddieAnimation = animation;
    this.currentMaddieFrame = frame;
  }

  render(state: State, width: number, height: number, resolution: number): void {
    const area = this.world.areas[state.area];
    if (area === undefined) return;
    this.resize(width, height);
    const loaded = this.areaView;
    if (loaded === undefined || loaded.area.id !== area.id) {
      this.drawStatic(width, height, loaded?.paper ?? 0xf8edcf);
      this.fade.alpha = 1;
      return;
    }
    if (width !== this.staticWidth || height !== this.staticHeight ||
        this.staticPaper !== loaded.paper)
      this.drawStatic(width, height, loaded.paper);
    const scale = Math.min(width / this.viewWidth, height / this.viewHeight);
    const camera = followCamera(this.previousCamera, state.player,
      { width: this.viewWidth, height: this.viewHeight }, area, { x: 80, y: 60 });
    this.previousCamera = camera;
    const letterboxX = (width - this.viewWidth * scale) / 2;
    const letterboxY = (height - this.viewHeight * scale) / 2;
    const offsetX = Math.round((letterboxX - camera.x * scale) * resolution) / resolution;
    const offsetY = Math.round((letterboxY - camera.y * scale) * resolution) / resolution;
    this.scene.scale.set(scale);
    this.scene.position.set(offsetX, offsetY);
    this.player.position.set(state.player.x, state.player.y);
    this.player.zIndex = state.player.y;
    this.maddie.position.set(state.maddie.x, state.maddie.y);
    this.maddie.zIndex = state.maddie.y;
    this.setFaeTexture(state);
    this.setMaddieTexture(state);
    this.depth.sortChildren();
    if (this.label !== undefined)
      this.label.text = `Cloverhollow • tick ${state.tick} · ` +
        `${Math.round(state.player.x)},${Math.round(state.player.y)}`;
    const fade = fadeAlpha(state.transition, this.world.tunables.doorFadeTicks);
    this.fade.alpha = fade;
  }

  /** The Talk prompt for this frame, anchored at the target in CSS px. */
  promptView(state: State): { visible: boolean; label: string; x: number; y: number } {
    const target = targetInteractable(this.world, state);
    if (target === undefined || this.previousCamera === undefined)
      return { visible: false, label: "", x: 0, y: 0 };
    const point = worldToScreen(target.point, this.previousCamera, this.viewWidth,
      this.viewHeight, window.innerWidth, window.innerHeight);
    return { visible: true, label: target.prompt.toUpperCase(), x: point.x, y: point.y };
  }

  renderInfo(state: State): {
    area: string;
    drawOrder: { label: string; zIndex: number }[];
    animation: string;
    frame: number;
    maddie: { animation: string; frame: number };
    hidden: number;
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
  } {
    const fade = fadeAlpha(state.transition, this.world.tunables.doorFadeTicks);
    return {
      area: this.areaView?.area.id ?? "",
      drawOrder: this.depth.children.map((child) => ({
        label: child.label,
        zIndex: child.zIndex,
      })),
      animation: this.currentAnimation,
      frame: this.currentFrame,
      maddie: {
        animation: this.currentMaddieAnimation,
        frame: this.currentMaddieFrame,
      },
      hidden: hiddenFraction(state.maddie, state.player),
      fade,
      cachedAreaTextures: [...this.areaTextureUrls].filter((url) =>
        Assets.cache.has(url)),
      prompt: this.promptView(state),
      dialogue: {
        open: state.dialogue !== null,
        speaker: state.dialogue?.speaker ?? null,
        revealed: state.dialogue?.revealed ?? 0,
        length: state.dialogue?.text.length ?? 0,
        choices: state.dialogue?.choices ?? [],
        selected: state.dialogue?.selected ?? 0,
      },
    };
  }
}
