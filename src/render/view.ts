import {
  Assets,
  BlurFilter,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Spritesheet,
  Text,
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
  presentCritters,
  targetInteractable,
  type Area,
  type CheckSide,
  type PartyContent,
  type PartyMember,
  type Point,
  type State,
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
  // per toy-atlas pixel: the critter's own, since they were cut from it).
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
    };
// The check for tests (spec 11): its side and geometry, plus an anchor
// (`x`, `y`: a ring's centre, a meter's top-left, a chain's target, the
// catch where it is, a lean's star where it is).
export type BattleCheckInfo = BattleCheckGeometry & { side: CheckSide; x: number; y: number };
import { followCamera, worldToScreen } from "./camera";
import { selectFaeAnimation } from "./animation";
import { assetUrl } from "../platform/assets";
import { fadeAlpha } from "./fade";
import { battleLayout, type BattleLayout } from "./battle-layout";

// Critter frames are 512 px with the feet at y 504 (docs/art/critters.md).
// Aura and body centroids are measured in each critter's content atlas.
function placeAura(
  aura: Sprite,
  feet: { x: number; y: number },
  scale: number,
  auraCentre: Point,
  bodyCentre: Point,
): void {
  aura.anchor.set(auraCentre.x / 512, auraCentre.y / 512);
  aura.scale.set(scale * 1.15);
  aura.position.set(
    feet.x + (bodyCentre.x - 256) * scale,
    feet.y + (bodyCentre.y - 504) * scale,
  );
}

export class GameView {
  readonly root = new Container();
  readonly ready: Promise<void>;
  private readonly background = new Graphics();
  private readonly paper = new Graphics();
  private readonly fade = new Graphics();
  private readonly scene = new Container();
  private readonly lanternTint = new Graphics();
  private readonly glowLayer = new Container();
  private readonly depth = new Container();
  private readonly player = new Sprite();
  // One overworld sprite per roster member, labelled with its id; only the
  // members in the party are visible.
  private readonly partySprites = new Map<string, Sprite>();
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
  private readonly battleCritter = new Sprite();
  private readonly battleCritterAura = new Sprite();
  private readonly battleFae = new Sprite();
  private readonly battlePartySprites = new Map<string, Sprite>();
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
  private partyFrames: { id: string; animation: string; frame: number }[] = [];
  private readonly areaTextureUrls = new Set<string>();
  private critterSprites: { id: string; body: Sprite; aura: Sprite }[] = [];
  private critterKeys = "";
  // Each overworld critter: `id` is its key (a set piece's id or `wild:<den>`).
  private critterFrames: {
    id: string;
    kind: string;
    frame: string;
    x: number;
    y: number;
  }[] = [];
  private npcSprites: { npc: Area["npcs"][number]; sprite: Sprite }[] = [];
  private npcFrames: { id: string; frame: string; facing: string }[] = [];
  private glowSprites: { id: string; sprite: Sprite }[] = [];
  private drawnGlows: string[] = [];

  constructor(
    private readonly world: World,
    options: { debugLabel: boolean; renderer: Renderer },
  ) {
    this.renderer = options.renderer;
    this.depth.sortableChildren = true;
    this.player.label = "fae";
    for (const id of Object.keys(world.party)) {
      const sprite = new Sprite();
      sprite.label = id;
      sprite.visible = false;
      this.partySprites.set(id, sprite);
      const battleSprite = new Sprite();
      battleSprite.label = `battle:${id}`;
      battleSprite.visible = false;
      this.battlePartySprites.set(id, battleSprite);
    }
    this.battleCritter.label = "battle:critter";
    this.battleCritterAura.label = "battle:critter:aura";
    this.player.scale.set(0.5);
    this.root.addChild(
      this.background,
      this.paper,
      this.scene,
      this.viewportMask,
      this.fade,
      this.backdropSprite,
      this.battleWash,
      this.battleLayer,
      this.lanternTint,
      this.glowLayer,
    );
    this.scene.mask = this.viewportMask;
    this.scene.addChild(this.depth);
    this.depth.addChild(this.player);
    for (const sprite of this.partySprites.values())
      this.depth.addChild(sprite);
    this.battleLayer.addChild(
      this.battleCritterAura,
      this.battleCritter,
      this.battleFae,
      ...this.battlePartySprites.values(),
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
      // Kinds of one species can share an atlas (the fountain frog and the
      // bay's frogs), so critter atlases are loaded, and found, by URL.
      ...[
        ...new Set(
          Object.values(this.world.critters).map((critter) => critter.atlas),
        ),
      ].map((atlas) => Assets.load({ alias: atlas, src: assetUrl(atlas) })),
      ...Object.entries(this.world.party).map(([id, member]) =>
        Assets.load({
          alias: `${id}-sheet`,
          src: assetUrl(member.atlas),
          data: { textureOptions: { autoGenerateMipmaps: true } },
        }),
      ),
      Assets.load({
        alias: "glow-sheet",
        src: assetUrl("assets/glows/glows.json"),
      }),
      // The toys a catch throws are cropped from this sheet by the DOM
      // overlay, which reads their frames here.
      Assets.load({
        alias: this.world.battle.toyAtlas,
        src: assetUrl(this.world.battle.toyAtlas),
      }),
      ...Object.entries(this.world.characters).map(([id, character]) =>
        Assets.load({
          alias: `${id}-sheet`,
          src: assetUrl(character.atlas),
          data: { textureOptions: { autoGenerateMipmaps: true } },
        }),
      ),
    ]);
  }

  async setArea(area: Area): Promise<void> {
    const previous = this.areaView;
    if (previous !== undefined) await previous.destroy();
    const next = await AreaView.load(area, this.depth);
    this.areaView = next;
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
    for (const url of next.textureUrls) this.areaTextureUrls.add(url);
    this.scene.addChildAt(next.ground, 0);
    for (const sprite of this.critterSprites) {
      sprite.body.destroy();
      sprite.aura.destroy();
    }
    this.critterSprites = [];
    this.critterKeys = "";
    for (const { sprite } of this.npcSprites) sprite.destroy();
    this.npcSprites = area.npcs.map((npc) => {
      const sprite = new Sprite();
      sprite.label = `npc:${npc.id}`;
      sprite.scale.set(0.5);
      this.depth.addChild(sprite);
      return { npc, sprite };
    });
    this.previousCamera = undefined;
    this.staticWidth = 0;
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

  // A party member's frame: walk frames advance with its own distance; at
  // rest, a sitter (Maddie) keeps standing (walk frame 0) until sitDelayTicks
  // and then sits (its idle), anyone else idles at once.
  private setFollowerTexture(
    sprite: Sprite,
    member: PartyMember,
    content: PartyContent,
  ): { id: string; animation: string; frame: number } {
    const sheet = Assets.get<Spritesheet>(`${member.id}-sheet`);
    const side = member.facing === "right" ? "left" : member.facing;
    const mirror = member.facing === "right";
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
    sprite.scale.set(mirror ? -0.5 : 0.5, 0.5);
    return { id: member.id, animation, frame };
  }

  private renderParty(state: State): void {
    const inParty = new Set(state.party.map((member) => member.id));
    for (const [id, sprite] of this.partySprites)
      sprite.visible = inParty.has(id);
    this.partyFrames = state.party.flatMap((member) => {
      const sprite = this.partySprites.get(member.id);
      const content = this.world.party[member.id];
      if (sprite === undefined || content === undefined) return [];
      sprite.position.set(member.x, member.y);
      sprite.zIndex = member.y;
      return [this.setFollowerTexture(sprite, member, content)];
    });
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
    this.glowLayer.scale.set(scale);
    this.glowLayer.position.set(offsetX, offsetY);
    this.player.position.set(state.player.x, state.player.y);
    this.player.zIndex = state.player.y;
    this.setFaeTexture(state);
    this.renderParty(state);
    this.renderCritters(state);
    this.renderNpcs(state);
    loaded.update(
      this.world,
      state.ink,
      state.player,
      state.tick,
      this.figures(),
    );
    this.renderGlows(state, width, height);
    this.renderBattle(state, width, height, resolution);
    this.depth.sortChildren();
    if (this.label !== undefined)
      this.label.text =
        `Cloverhollow • tick ${state.tick} · ` +
        `${Math.round(state.player.x)},${Math.round(state.player.y)}`;
    const fade = fadeAlpha(state.transition, this.world.tunables.doorFadeTicks);
    this.fade.alpha = fade;
  }

  private renderGlows(state: State, width: number, height: number): void {
    const area = this.areaView?.area;
    const sheet = Assets.get<Spritesheet>("glow-sheet");
    const on = state.lantern && state.battle === null;
    this.lanternTint.clear();
    // Blacklight: the scene drops to a deep violet dusk so the added glows show;
    // on bright snow, added light would only saturate to white.
    if (on)
      this.lanternTint
        .rect(0, 0, width, height)
        .fill({ color: 0x1d0f3a, alpha: 0.55 });
    this.lanternTint.visible = on;
    const drawn: string[] = [];
    for (const { id, sprite } of this.glowSprites) {
      const glow = area?.glows.find((item) => item.id === id);
      const texture =
        glow === undefined ? undefined : sheet?.textures[glow.frame];
      sprite.visible = on && glow !== undefined && texture !== undefined;
      if (texture !== undefined && glow !== undefined) {
        sprite.texture = texture;
        sprite.position.set(glow.point.x, glow.point.y);
        sprite.scale.set(glow.flip === true ? -0.5 : 0.5, 0.5);
        sprite.alpha = 0.82 + Math.sin(state.tick / 24) * 0.12;
        if (sprite.visible) drawn.push(id);
      }
    }
    this.drawnGlows = drawn;
  }

  // People in the area, y-sorted with everyone else. They face Fae while she
  // talks to them; without a frame for that facing (Mom has no back view)
  // they show their front. idle_down steps through the character's idleTicks.
  private renderNpcs(state: State): void {
    const frames: { id: string; frame: string; facing: string }[] = [];
    for (const { npc, sprite } of this.npcSprites) {
      const sheet = Assets.get<Spritesheet>(`${npc.id}-sheet`);
      const character = this.world.characters[npc.id];
      // Someone the story has sent away isn't drawn (spec 6).
      sprite.visible = npcVisible(this.world, state, npc);
      if (sheet === undefined || character === undefined || !sprite.visible)
        continue;
      const facing = npcFacing(state, npc);
      const wanted = `idle_${facing}`;
      const animation =
        sheet.data.animations?.[wanted] !== undefined ? wanted : "idle_down";
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
      sprite.position.set(npc.point.x, npc.point.y);
      sprite.zIndex = npc.point.y;
      frames.push({ id: npc.id, frame: name, facing });
    }
    this.npcFrames = frames;
  }

  // Overworld critters: chaos (with the pulsing aura behind) or calm, y-sorted
  // with Fae, her party, and props, their figures overworldHeight tall.
  // Who is out can change in an area (a rest rolls it again, a set piece
  // comes and goes), so the sprites follow the present critters' keys.
  private renderCritters(state: State): void {
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
      }
      this.critterSprites = present.map((critter) => {
        const body = new Sprite();
        body.label = `critter:${critter.key}`;
        const aura = new Sprite();
        aura.label = `critter:${critter.key}:aura`;
        this.depth.addChild(aura, body);
        return { id: critter.key, body, aura };
      });
    }
    const frames: {
      id: string;
      kind: string;
      frame: string;
      x: number;
      y: number;
    }[] = [];
    for (const [index, { id, body, aura }] of this.critterSprites.entries()) {
      const critter = present[index];
      if (critter === undefined) continue;
      const content = critter.kind;
      const point = critter.point;
      const roamer = critter.wild;
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
      body.scale.set(scale);
      const bob = roamer?.moving === true ? Math.sin(state.tick / 4) * 3 : 0;
      body.position.set(point.x, point.y + bob);
      body.zIndex = point.y;
      if (roamer !== null)
        body.scale.x = roamer.facing === "right" ? -scale : scale;
      aura.visible = !calm;
      aura.texture = auraTexture;
      placeAura(
        aura,
        { x: point.x, y: point.y + bob },
        scale,
        content.auraCentre,
        content.bodyCentre,
      );
      aura.zIndex = point.y - 0.5;
      aura.alpha = 0.65 + Math.sin(state.tick / 18) * 0.2;
      aura.rotation = state.tick / 180;
      frames.push({ id, kind: content.id, frame, x: point.x, y: point.y });
    }
    this.critterFrames = frames;
  }

  /*
   * The battle backdrop is the area painting itself, scaled so its painted
   * interior covers the whole canvas plus a margin (never smaller than the
   * overworld zoom), centred on the critter and clamped, softly blurred. The
   * margin keeps the blur's edge fade off-screen.
   */
  private renderBackdrop(state: State, width: number, height: number): void {
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
    const cover = Math.max(
      (width + margin * 2) / (area.width - insetX * 2),
      (height + margin * 2) / (area.height - insetY * 2),
      Math.min(width / this.viewWidth, height / this.viewHeight),
    );
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
    resolution: number,
  ): void {
    const battle = state.battle;
    const arcade = state.arcade;
    if (battle === null && arcade === null) {
      this.battleLayer.visible = false;
      this.battleWash.visible = false;
      this.backdropSprite.visible = false;
      this.scene.visible = true;
      this.battleBackdrop = null;
      if (this.backdropTexture !== undefined) {
        this.backdropTexture.destroy(true);
        this.backdropTexture = undefined;
      }
      return;
    }
    this.battleLayer.visible = battle !== null;
    this.battleWash.visible = true;
    this.backdropSprite.visible = true;
    this.scene.visible = false;
    this.renderBackdrop(state, width, height);
    const scale = Math.min(width / this.viewWidth, height / this.viewHeight);
    const x = (width - this.viewWidth * scale) / 2;
    const y = (height - this.viewHeight * scale) / 2;
    // The claw machine's close-up is DOM over the blurred room: no battle
    // figures, and a lighter wash.
    if (arcade !== null) {
      this.battleWash.clear().rect(0, 0, width, height).fill({ color: 0xfff6e6, alpha: 0.28 });
      return;
    }
    if (battle === null) return;
    const layout = this.layoutFor(state, width, height);
    this.battleLayer.scale.set(scale);
    this.battleLayer.position.set(x, y);
    this.battleWash
      .clear()
      .rect(0, 0, width, height)
      .fill({ color: 0xfff6e6, alpha: 0.2 });
    const critter = this.world.critters[battle.critterId];
    if (critter === undefined) return;
    const sheet = Assets.get<Spritesheet>(critter.atlas);
    const critterFrame =
      battle.phase === "soothed"
        ? "soothed_01"
        : battle.phase === "reward"
          ? "calm_idle_01"
          : battle.phase === "burst" ||
              (battle.phase === "check" && battle.check?.side === "fae")
            ? "chaos_burst_01"
            : "chaos_idle_01";
    const body = sheet.textures[critterFrame];
    const aura = sheet.textures.chaos_aura_01;
    if (body === undefined || aura === undefined)
      throw new Error("Missing battle critter frame");
    this.battleCritter.texture = body;
    this.battleCritter.anchor.set(0.5, 504 / 512);
    const battleHeight = critter.battleHeight;
    this.battleCritter.scale.set(battleHeight / 380);
    this.battleCritter.position.set(
      (layout.critter.x - x) / scale,
      (layout.critter.baseline - y) / scale,
    );
    this.battleCritterAura.texture = aura;
    placeAura(
      this.battleCritterAura,
      this.battleCritter.position,
      battleHeight / 380,
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
    // The party stands with Fae: a sitter (Maddie) sits facing the critter,
    // anyone else is seen from behind like Fae. Flute friends sit it out.
    const fighting = battleParty(this.world, state.party);
    const inParty = new Set(fighting.map((member) => member.id));
    for (const [id, sprite] of this.battlePartySprites)
      sprite.visible = inParty.has(id);
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
      sprite.scale.set(0.5);
      sprite.position.set((place.x - x) / scale, (place.y - y) / scale);
    });
    this.battleLayer.alpha =
      battle.phase === "intro" ? Math.min(1, battle.phaseTicks / 18) : 1;
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
        toyScale: critter.height / figure,
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
    if (check.side === "fae")
      return {
        kind: "chain",
        from: critterCentre,
        to: faeCentre,
        radius: 0.3 * fae.height,
        hintAt: hintAt(fae.x),
      };
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
    return { ...geometry, side };
  }

  renderInfo(state: State): {
    area: string;
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
    // Each canopy's alpha: below 1 while Fae is behind it.
    canopies: { id: string; alpha: number }[];
    // Each prop's current state, whether it lies flat (drawn under everyone),
    // and its strips: world x range and the y it sorts by (spec 6).
    props: {
      id: string;
      state: string;
      flat: boolean;
      strips: { left: number; right: number; zIndex: number }[];
    }[];
    lantern: { on: boolean; glows: string[] };
    battle: {
      phase: string | null;
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
    const renderLayout = layout ?? {
      critter: { x: 0, baseline: 0, height: 0 },
      fae: { x: 0, baseline: 0, height: 0 },
    };
    return {
      area: this.areaView?.area.id ?? "",
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
      canopies: this.areaView?.canopyAlphas ?? [],
      props: this.areaView?.propInfo ?? [],
      lantern: {
        on: state.lantern && state.battle === null,
        glows: this.drawnGlows.slice(),
      },
      battle: {
        phase: state.battle?.phase ?? null,
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
                            state.battle.check?.side === "fae")
                        ? "chaos_burst_01"
                        : "chaos_idle_01",
              },
        overworldVisible: this.scene.visible,
        auraAlpha: state.battle === null ? 0 : this.battleCritterAura.alpha,
      },
    };
  }
}
