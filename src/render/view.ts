import {
  Assets,
  BlurFilter,
  Container,
  Graphics,
  Sprite,
  Spritesheet,
  Text,
} from "pixi.js";
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
import { battleLayout } from "./battle-layout";

// Critter frames are 512 px with the feet at y 504 (docs/art/critters.md).
// The frog's aura turns about its own centroid (264, 275), placed on the
// body's centroid (253, 311); both were measured from the frog atlas.
function placeAura(aura: Sprite, feet: { x: number; y: number }, scale: number): void {
  aura.anchor.set(264 / 512, 275 / 512);
  aura.scale.set(scale * 1.15);
  aura.position.set(feet.x + (253 - 256) * scale, feet.y + (311 - 504) * scale);
}

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
  private readonly battleLayer = new Container();
  // A light cream wash over the blurred backdrop so the figures stand out.
  private readonly battleWash = new Graphics();
  // Not clipped to the viewport, so the blur samples real painting past the
  // canvas edges instead of fading into transparency there.
  private readonly backdropBlur = new BlurFilter({
    strength: 4,
    quality: 2,
    resolution: 0.5,
    clipToViewport: false,
  });
  private battleBackdrop: { x: number; y: number; width: number; height: number } | null = null;
  // Pixi's filters getter returns undefined until a filter is set, so track it here.
  private backdropBlurred = false;
  private readonly battleFrog = new Sprite();
  private readonly battleAura = new Sprite();
  private readonly battleFae = new Sprite();
  private readonly battleMaddie = new Sprite();
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
  private critterSprites: { id: string; body: Sprite; aura: Sprite }[] = [];
  private critterFrames: { id: string; frame: string }[] = [];

  constructor(
    private readonly world: World,
    options: { debugLabel: boolean },
  ) {
    this.depth.sortableChildren = true;
    this.player.label = "fae";
    this.maddie.label = "maddie";
    this.battleFrog.label = "battle:frog";
    this.battleAura.label = "battle:frog:aura";
    this.player.scale.set(0.5);
    this.root.addChild(
      this.background,
      this.paper,
      this.scene,
      this.viewportMask,
      this.fade,
      this.battleWash,
      this.battleLayer,
    );
    this.scene.mask = this.viewportMask;
    this.scene.addChild(this.depth);
    this.depth.addChild(this.player);
    this.depth.addChild(this.maddie);
    this.battleLayer.addChild(
      this.battleAura,
      this.battleFrog,
      this.battleFae,
      this.battleMaddie,
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
      Assets.load({
        alias: "fae-sheet",
        src: assetUrl("assets/characters/fae/fae.json"),
        data: { textureOptions: { autoGenerateMipmaps: true } },
      }),
      Assets.load({
        alias: "frog-sheet",
        src: assetUrl("assets/critters/frog/frog.json"),
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
    for (const sprite of this.critterSprites) {
      sprite.body.destroy();
      sprite.aura.destroy();
    }
    this.critterSprites = area.critters.map((critter) => {
      const body = new Sprite();
      body.label = `critter:${critter.id}`;
      const aura = new Sprite();
      aura.label = `critter:${critter.id}:aura`;
      this.depth.addChild(aura, body);
      return { id: critter.id, body, aura };
    });
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
    this.paper
      .clear()
      .rect(
        letterboxX,
        letterboxY,
        this.viewWidth * scale,
        this.viewHeight * scale,
      )
      .fill(paper);
    this.viewportMask
      .clear()
      .rect(
        letterboxX,
        letterboxY,
        this.viewWidth * scale,
        this.viewHeight * scale,
      )
      .fill(0xffffff);
    this.fade
      .clear()
      .rect(
        letterboxX,
        letterboxY,
        this.viewWidth * scale,
        this.viewHeight * scale,
      )
      .fill(paper);
    this.fade.alpha = 0;
    this.staticWidth = width;
    this.staticHeight = height;
    this.staticPaper = paper;
  }

  private setFaeTexture(state: State): void {
    const sheet = Assets.get<Spritesheet>("fae-sheet");
    const idleName =
      state.facing === "right" ? "idle_left" : `idle_${state.facing}`;
    const walkName =
      state.facing === "right" ? "walk_left" : `walk_${state.facing}`;
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
    if (texture === undefined)
      throw new Error(`Missing Fae frame ${selection.frame}`);
    this.player.texture = texture;
    if (texture.defaultAnchor === undefined)
      throw new Error("Fae anchor missing");
    this.player.anchor.copyFrom(texture.defaultAnchor);
    this.player.scale.x = selection.mirror ? -0.5 : 0.5;
    this.currentAnimation = selection.animation;
    this.currentFrame = selection.frame;
  }

  private setMaddieTexture(state: State): void {
    const sheet = Assets.get<Spritesheet>("maddie-sheet");
    const side = state.maddie.facing === "right" ? "left" : state.maddie.facing;
    const mirror = state.maddie.facing === "right";
    const sitting =
      !state.maddie.motion.moving &&
      state.maddie.stillTicks >= this.world.tunables.follow.sitDelayTicks;
    const animation = sitting ? `idle_${side}` : `walk_${side}`;
    const frames = sheet.animations[animation];
    if (frames === undefined || frames.length === 0)
      throw new Error(`Missing Maddie animation ${animation}`);
    const frame = sitting
      ? 0
      : state.maddie.motion.moving
        ? Math.floor(
            (state.maddie.motion.distance /
              this.world.tunables.follow.walkCycleUnits) *
              frames.length,
          ) % frames.length
        : 0;
    const texture = frames[frame];
    if (texture === undefined) throw new Error(`Missing Maddie frame ${frame}`);
    this.maddie.texture = texture;
    if (texture.defaultAnchor === undefined)
      throw new Error("Maddie anchor missing");
    this.maddie.anchor.copyFrom(texture.defaultAnchor);
    this.maddie.scale.x = mirror ? -0.5 : 0.5;
    this.currentMaddieAnimation = animation;
    this.currentMaddieFrame = frame;
  }

  render(
    state: State,
    width: number,
    height: number,
    resolution: number,
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
    const scale = Math.min(width / this.viewWidth, height / this.viewHeight);
    const camera = followCamera(
      this.previousCamera,
      state.player,
      { width: this.viewWidth, height: this.viewHeight },
      area,
      { x: 80, y: 60 },
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
    this.player.position.set(state.player.x, state.player.y);
    this.player.zIndex = state.player.y;
    this.maddie.position.set(state.maddie.x, state.maddie.y);
    this.maddie.zIndex = state.maddie.y;
    this.setFaeTexture(state);
    this.setMaddieTexture(state);
    this.renderCritters(state);
    this.renderBattle(state, width, height, resolution);
    this.depth.sortChildren();
    if (this.label !== undefined)
      this.label.text =
        `Cloverhollow • tick ${state.tick} · ` +
        `${Math.round(state.player.x)},${Math.round(state.player.y)}`;
    const fade = fadeAlpha(state.transition, this.world.tunables.doorFadeTicks);
    this.fade.alpha = fade;
  }

  // Overworld critters: chaos (with the pulsing aura behind) or calm, y-sorted
  // with Fae, Maddie, and the occluders, their figures overworldHeight tall.
  private renderCritters(state: State): void {
    const area = this.areaView?.area;
    const frames: { id: string; frame: string }[] = [];
    for (const { id, body, aura } of this.critterSprites) {
      const point = area?.critters.find((item) => item.id === id)?.point;
      const content = this.world.critters[id];
      const sheet = Assets.get<Spritesheet>(`${id}-sheet`);
      if (point === undefined || content === undefined || sheet === undefined) continue;
      const calm = state.critters[id] === "calm";
      const frame = calm ? "calm_idle_01" : "chaos_idle_01";
      const texture = sheet.textures[frame];
      const auraTexture = sheet.textures.chaos_aura_01;
      if (texture === undefined || auraTexture === undefined) continue;
      const scale = content.overworldHeight / content.figureHeight;
      body.texture = texture;
      body.anchor.set(0.5, 504 / 512);
      body.scale.set(scale);
      body.position.set(point.x, point.y);
      body.zIndex = point.y;
      aura.visible = !calm;
      aura.texture = auraTexture;
      placeAura(aura, point, scale);
      aura.zIndex = point.y - 0.5;
      aura.alpha = 0.65 + Math.sin(state.tick / 18) * 0.2;
      aura.rotation = state.tick / 180;
      frames.push({ id, frame });
    }
    this.critterFrames = frames;
  }

  /*
   * The battle backdrop is the area painting itself, scaled so its painted
   * interior covers the whole canvas plus a margin (never smaller than the
   * overworld zoom), centred on the critter and clamped, softly blurred. The
   * margin keeps the blur's edge fade off-screen.
   */
  private renderBackdrop(critterId: string, width: number, height: number): void {
    const area = this.areaView?.area;
    if (area === undefined) return;
    const focus = area.critters.find((item) => item.id === critterId)?.point ??
      { x: area.width / 2, y: area.height / 2 };
    // Watercolour areas fade to bare paper near their edges (the plaza by
    // about 120 units at the sides and 50 at the top and bottom), so frame
    // only the painted interior, 8% in from every side.
    const insetX = area.width * 0.08;
    const insetY = area.height * 0.08;
    const margin = 32;
    const cover = Math.max((width + margin * 2) / (area.width - insetX * 2),
      (height + margin * 2) / (area.height - insetY * 2),
      Math.min(width / this.viewWidth, height / this.viewHeight));
    const clamp = (value: number, low: number, high: number): number =>
      Math.min(high, Math.max(low, value));
    const x = clamp(width / 2 - focus.x * cover,
      width + margin - (area.width - insetX) * cover, -margin - insetX * cover);
    const y = clamp(height / 2 - focus.y * cover,
      height + margin - (area.height - insetY) * cover, -margin - insetY * cover);
    this.scene.scale.set(cover);
    this.scene.position.set(x, y);
    if (!this.backdropBlurred) {
      // Widen the viewport clip to the whole canvas. (Unassigning the mask
      // instead would draw its white rectangle over the scene.)
      this.viewportMask.clear().rect(0, 0, width, height).fill(0xffffff);
      this.scene.filters = [this.backdropBlur];
      this.backdropBlurred = true;
    }
    this.battleBackdrop = { x, y, width: area.width * cover, height: area.height * cover };
  }

  private renderBattle(
    state: State,
    width: number,
    height: number,
    resolution: number,
  ): void {
    const battle = state.battle;
    if (battle === null) {
      this.battleLayer.visible = false;
      this.battleWash.visible = false;
      this.depth.visible = true;
      this.battleBackdrop = null;
      if (this.backdropBlurred) {
        this.scene.filters = [];
        this.backdropBlurred = false;
        // Put the viewport clip back (the battle widened it to the canvas).
        this.drawStatic(width, height, this.staticPaper);
      }
      return;
    }
    this.battleLayer.visible = true;
    this.battleWash.visible = true;
    this.depth.visible = false;
    this.renderBackdrop(battle.critterId, width, height);
    const scale = Math.min(width / this.viewWidth, height / this.viewHeight);
    const x = (width - this.viewWidth * scale) / 2;
    const y = (height - this.viewHeight * scale) / 2;
    const layout = battleLayout(
      width,
      height,
      this.viewWidth,
      this.viewHeight,
      this.world.critters.frog?.battleHeight ?? 190,
      140,
    );
    this.battleLayer.scale.set(scale);
    this.battleLayer.position.set(x, y);
    this.battleWash.clear().rect(0, 0, width, height).fill({ color: 0xfff6e6, alpha: 0.2 });
    const sheet = Assets.get<Spritesheet>("frog-sheet");
    const frogFrame =
      battle.phase === "soothed"
        ? "soothed_01"
        : battle.phase === "reward"
          ? "calm_idle_01"
          : battle.phase === "burst" ||
              (battle.phase === "aim" && battle.aim?.side === "fae")
            ? "chaos_burst_01"
            : "chaos_idle_01";
    const frog = sheet.textures[frogFrame];
    const aura = sheet.textures.chaos_aura_01;
    if (frog === undefined || aura === undefined)
      throw new Error("Missing battle frog frame");
    this.battleFrog.texture = frog;
    this.battleFrog.anchor.set(0.5, 504 / 512);
    const battleHeight = this.world.critters.frog?.battleHeight ?? 190;
    this.battleFrog.scale.set(battleHeight / 380);
    this.battleFrog.position.set(
      (layout.frog.x - x) / scale,
      (layout.frog.baseline - y) / scale,
    );
    this.battleAura.texture = aura;
    placeAura(this.battleAura, this.battleFrog.position, battleHeight / 380);
    this.battleAura.alpha =
      battle.phase === "soothed"
        ? Math.max(0, 1 - battle.phaseTicks / 30)
        : 0.65 + Math.sin(state.tick / 18) * 0.2;
    this.battleAura.rotation = state.tick / 180;
    const faeSheet = Assets.get<Spritesheet>("fae-sheet");
    const faeFrames = faeSheet.animations.idle_up;
    const fae = faeFrames?.[0];
    if (fae !== undefined) {
      this.battleFae.texture = fae;
      if (fae.defaultAnchor !== undefined)
        this.battleFae.anchor.copyFrom(fae.defaultAnchor);
      this.battleFae.scale.set(0.65);
      this.battleFae.position.set(
        (layout.fae.x - x) / scale,
        (layout.fae.baseline - y) / scale,
      );
    }
    const maddieSheet = Assets.get<Spritesheet>("maddie-sheet");
    const maddieFrames = maddieSheet.animations.idle_down;
    const maddie = maddieFrames?.[0];
    if (maddie !== undefined) {
      this.battleMaddie.texture = maddie;
      if (maddie.defaultAnchor !== undefined)
        this.battleMaddie.anchor.copyFrom(maddie.defaultAnchor);
      this.battleMaddie.scale.set(0.5);
      this.battleMaddie.position.set(
        (layout.fae.x - x) / scale + 42,
        (layout.fae.baseline - y) / scale,
      );
    }
    this.battleLayer.alpha =
      battle.phase === "intro" ? Math.min(1, battle.phaseTicks / 18) : 1;
  }

  /** The Talk prompt for this frame, anchored at the target in CSS px. */
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
      label: target.prompt.toUpperCase(),
      x: point.x,
      y: point.y,
    };
  }

  battleRingView(
    state: State,
    width: number,
    height: number,
  ): { x: number; y: number; radius: number } | null {
    const aim = state.battle?.aim;
    if (aim === null || aim === undefined) return null;
    const layout = battleLayout(
      width,
      height,
      this.viewWidth,
      this.viewHeight,
      this.world.critters.frog?.battleHeight ?? 190,
      140,
    );
    const centre =
      aim.side === "fae"
        ? {
            x: layout.fae.x,
            y: layout.fae.baseline - layout.fae.height / 2,
            radius: 0.55 * layout.fae.height,
          }
        : {
            x: layout.frog.x,
            y: layout.frog.baseline - layout.frog.height / 2,
            radius: 0.55 * layout.frog.height,
          };
    return {
      x: centre.x,
      y: centre.y,
      radius: centre.radius,
    };
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
    critters: { id: string; frame: string }[];
    battle: {
      phase: string | null;
      ring: { x: number; y: number; radius: number } | null;
      frogFrame: string;
      layout: {
        frog: { x: number; baseline: number; height: number };
        fae: { x: number; baseline: number; height: number };
      } | null;
      backdrop: { x: number; y: number; width: number; height: number } | null;
      frogBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
      } | null;
      faeBounds: { x: number; y: number; width: number; height: number } | null;
      overworldVisible: boolean;
      auraAlpha: number;
    };
  } {
    const fade = fadeAlpha(state.transition, this.world.tunables.doorFadeTicks);
    const layout =
      state.battle === null
        ? null
        : battleLayout(
            window.innerWidth,
            window.innerHeight,
            this.viewWidth,
            this.viewHeight,
            this.world.critters.frog?.battleHeight ?? 190,
            140,
          );
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
      battle: {
        phase: state.battle?.phase ?? null,
        ring:
          state.battle?.aim === null || state.battle === null
            ? null
            : {
                x:
                  state.battle.aim.side === "fae"
                    ? layout!.fae.x
                    : layout!.frog.x,
                y:
                  state.battle.aim.side === "fae"
                    ? layout!.fae.baseline - layout!.fae.height / 2
                    : layout!.frog.baseline - layout!.frog.height / 2,
                radius:
                  state.battle.aim.side === "fae"
                    ? 0.55 * layout!.fae.height
                    : 0.55 * layout!.frog.height,
              },
        layout,
        backdrop: this.battleBackdrop,
        frogFrame:
          state.battle === null
            ? state.critters.frog === "calm"
              ? "calm_idle_01"
              : "chaos_idle_01"
            : state.battle.phase === "soothed"
              ? "soothed_01"
              : state.battle.phase === "reward"
                ? "calm_idle_01"
                : state.battle.phase === "burst" ||
                    (state.battle.phase === "aim" &&
                      state.battle.aim?.side === "fae")
                  ? "chaos_burst_01"
                  : "chaos_idle_01",
        frogBounds:
          state.battle === null
            ? null
            : (() => {
                const scale = Math.min(
                  window.innerWidth / this.viewWidth,
                  window.innerHeight / this.viewHeight,
                );
                return {
                  x:
                    (window.innerWidth - this.viewWidth * scale) / 2 +
                    (this.viewWidth * 0.66 -
                      (this.world.critters.frog?.battleHeight ?? 190) / 2) *
                      scale,
                  y:
                    (window.innerHeight - this.viewHeight * scale) / 2 +
                    (432 - (this.world.critters.frog?.battleHeight ?? 190)) *
                      scale,
                  width:
                    (this.world.critters.frog?.battleHeight ?? 190) * scale,
                  height:
                    (this.world.critters.frog?.battleHeight ?? 190) * scale,
                };
              })(),
        faeBounds:
          state.battle === null
            ? null
            : (() => {
                const scale = Math.min(
                  window.innerWidth / this.viewWidth,
                  window.innerHeight / this.viewHeight,
                );
                return {
                  x:
                    (window.innerWidth - this.viewWidth * scale) / 2 +
                    (this.viewWidth * 0.24 - 70) * scale,
                  y:
                    (window.innerHeight - this.viewHeight * scale) / 2 +
                    (640 - 140) * scale,
                  width: 140 * scale,
                  height: 140 * scale,
                };
              })(),
        overworldVisible: this.depth.visible,
        auraAlpha: state.battle === null ? 0 : this.battleAura.alpha,
      },
    };
  }
}
