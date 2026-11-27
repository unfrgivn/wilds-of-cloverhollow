import {
  Assets,
  Container,
  Sprite,
  Spritesheet,
  type Renderer,
} from "pixi.js";
import {
  battleParty,
  battleView,
  faeBox,
  peekabooStatus,
  type CheckSide,
  type Point,
  type State,
  type World,
} from "../core";
import type { AreaView } from "./area-view";
import { computeBattleChoreography } from "./battle-choreography";
import { battleLayout, type BattleLayout } from "./battle-layout";
import {
  BattleStageRenderer,
  makeShadowSprite,
  type BattleBackdropBounds,
} from "./battle-stage-render";
import { NEUTRAL_POSE } from "./motion";
import { liftShadowScale, warmFlashTint } from "./overworld-render";
import type { VfxTextures } from "./vfx-textures";

export { makeShadowSprite };

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
    }
  | { kind: "echo"; x: number; y: number; hintAt: Point };

// The check for tests (spec 11): its side and geometry, plus an anchor
// (`x`, `y`: a ring's centre, a meter's top-left, a chain's target, the
// catch where it is, a lean's star where it is).
export type BattleCheckInfo = BattleCheckGeometry & { side: CheckSide; x: number; y: number };

export type BattleRenderInfo = {
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
  backdrop: BattleBackdropBounds | null;
  overworldVisible: boolean;
  auraAlpha: number;
};

export type BattleRenderContext = {
  state: State;
  areaView: AreaView | undefined;
  width: number;
  height: number;
  viewWidth: number;
  viewHeight: number;
  reducedMotion: boolean;
};

// Critter frames are 512 px with the feet at y 504 (docs/art/critters.md).
// Aura and body centroids are measured in each critter's content atlas.
export function placeAura(
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

function critterFrameForBattle(battle: NonNullable<State["battle"]>): string {
  const peekabooWatching =
    battle.phase === "check" &&
    battle.check?.kind === "peekaboo" &&
    peekabooStatus(battle.check) === "watching";
  if (battle.phase === "soothed") return "soothed_01";
  if (battle.phase === "reward") return "calm_idle_01";
  if (
    battle.phase === "burst" ||
    (battle.phase === "check" &&
      battle.check?.side === "fae" &&
      (battle.check.kind !== "peekaboo" || peekabooWatching))
  ) {
    return "chaos_burst_01";
  }
  return "chaos_idle_01";
}

export class BattleViewController {
  readonly root = new Container();
  private readonly battleLayer = new Container();
  private readonly stage: BattleStageRenderer;
  private readonly battleCritter = new Sprite();
  private readonly battleCritterAura = new Sprite();
  private readonly battleFae = new Sprite();
  private readonly battlePartySprites = new Map<string, Sprite>();

  constructor(
    private readonly world: World,
    vfx: VfxTextures,
    renderer: Renderer,
  ) {
    this.stage = new BattleStageRenderer(world, vfx, renderer);

    for (const id of Object.keys(world.party)) {
      const battleSprite = new Sprite();
      battleSprite.label = `battle:${id}`;
      battleSprite.visible = false;
      this.battlePartySprites.set(id, battleSprite);
    }
    this.battleCritter.label = "battle:critter";
    this.battleCritterAura.label = "battle:critter:aura";

    this.battleLayer.addChild(
      ...this.stage.underlaySprites,
      ...this.stage.shadowSprites,
      this.battleCritterAura,
      this.battleCritter,
      this.battleFae,
      ...this.battlePartySprites.values(),
      this.stage.vfxLayer,
    );
    this.root.addChild(this.stage.backdropSprite, this.stage.wash, this.battleLayer);
  }

  /** Destroys the cached blurred backdrop texture so a restored GPU context rebuilds it. */
  invalidateBackdrop(): void {
    this.stage.invalidateBackdrop();
  }

  /** Renders battle/arcade backdrop and stage; returns true if the overworld stays visible. */
  render(context: BattleRenderContext): boolean {
    const { state, areaView, width, height, viewWidth, viewHeight, reducedMotion } = context;
    const battle = state.battle;
    const arcade = state.arcade;
    if (battle === null && arcade === null) {
      this.battleLayer.visible = false;
      this.stage.hide();
      return true;
    }
    this.battleLayer.visible = battle !== null;
    const introProgress = reducedMotion || battle?.phase !== "intro"
      ? 1
      : Math.min(1, Math.max(0, battle.phaseTicks / 18));
    const introEase = introProgress * (2 - introProgress);
    const backdropZoom = !reducedMotion && battle?.phase === "intro"
      ? 1 + 0.05 * (1 - introEase)
      : 1;
    this.stage.renderBackdrop(state, areaView, width, height, viewWidth, viewHeight, backdropZoom);
    const scale = Math.min(width / viewWidth, height / viewHeight);
    const x = (width - viewWidth * scale) / 2;
    const y = (height - viewHeight * scale) / 2;
    // The claw machine's close-up is DOM over the blurred room: no battle
    // figures, and a lighter wash.
    if (arcade !== null) {
      this.stage.drawWash(width, height, 0.28);
      return false;
    }
    if (battle === null) return false;
    const layout = this.layoutFor(state, width, height, viewWidth, viewHeight);
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
      reducedMotion,
    );
    this.battleLayer.scale.set(scale);
    this.battleLayer.position.set(
      x + (reducedMotion ? 0 : choreo.stageShake.x * scale),
      y + (reducedMotion ? 0 : choreo.stageShake.y * scale),
    );
    if (choreo.stageMood === "together-active") {
      this.stage.drawWash(width, height, 0.54, 0x201042);
    } else {
      this.stage.drawWash(width, height, 0.2);
    }

    const slideOffset = 14 * (1 - introEase);
    const critter = this.world.critters[battle.critterId];
    if (critter === undefined) return false;
    const sheet = Assets.get<Spritesheet | undefined>(critter.atlas);
    if (sheet === undefined) return false;
    const critterFrame = critterFrameForBattle(battle);
    const body = sheet.textures[critterFrame];
    const aura = sheet.textures.chaos_aura_01;
    if (body === undefined || aura === undefined) {
      throw new Error("Missing battle critter frame");
    }
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
    this.stage.updateCritterShadow(
      critterX + critterPose.offsetX * 0.85,
      critterY,
      critter.battleHeight,
      swell,
      liftShadowScale(critterPose.offsetY),
    );

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
      if (fae.defaultAnchor !== undefined) {
        this.battleFae.anchor.copyFrom(fae.defaultAnchor);
      }
      this.battleFae.scale.set(0.58 * faePose.scaleX, 0.58 * faePose.scaleY);
      this.battleFae.position.set(faeX + faePose.offsetX, faeY + faePose.offsetY);
      this.battleFae.rotation = faePose.rotation;
      this.battleFae.tint = warmFlashTint(faePose.tintFlash);
    }
    this.stage.updateFaeShadow(
      faeX + faePose.offsetX * 0.85,
      faeY,
      liftShadowScale(faePose.offsetY),
    );
    this.stage.renderLighting(
      choreo.stageMood,
      state.tick,
      viewWidth,
      viewHeight,
      faeX,
      faeY,
      critterX,
      critterY,
      reducedMotion,
    );

    // The party stands with Fae: a sitter (Maddie) sits facing the critter,
    // anyone else is seen from behind like Fae. Flute friends sit it out,
    // hopping in only for a brief cameo when Fae calls them with the flute.
    const inParty = new Set(fighting.map((member) => member.id));
    for (const [id, sprite] of this.battlePartySprites) {
      const visible = inParty.has(id);
      sprite.visible = visible;
      sprite.alpha = 1;
    }
    this.stage.setPartyShadowsVisible(inParty);
    const partyAnchors = new Map<string, Point>();
    fighting.forEach((member, index) => {
      const sprite = this.battlePartySprites.get(member.id);
      const content = this.world.party[member.id];
      const place = layout.party[index];
      if (sprite === undefined || content === undefined || place === undefined) return;
      const memberSheet = Assets.get<Spritesheet>(`${member.id}-sheet`);
      const pose = content.sits ? "idle_down" : "idle_up";
      const frame = (memberSheet.animations[pose] ?? memberSheet.animations.idle_down)?.[0];
      if (frame === undefined) return;
      sprite.texture = frame;
      if (frame.defaultAnchor !== undefined) sprite.anchor.copyFrom(frame.defaultAnchor);
      const baseScale = ((content.scale ?? 0.5) / 0.5) * 0.58;
      const memberPose = choreo.party[member.id] ?? NEUTRAL_POSE;
      sprite.scale.set(baseScale * memberPose.scaleX, baseScale * memberPose.scaleY);
      const memberX = (place.x - x) / scale - slideOffset;
      const memberY = (place.y - y) / scale;
      sprite.position.set(memberX + memberPose.offsetX, memberY + memberPose.offsetY);
      sprite.rotation = memberPose.rotation;
      partyAnchors.set(member.id, { x: memberX, y: memberY - 58 });
      this.stage.updatePartyShadow(
        member.id,
        memberX + memberPose.offsetX * 0.85,
        memberY,
        content.box.width,
        liftShadowScale(memberPose.offsetY),
      );
    });

    const cameoSparkles = this.stage.renderFluteCameo(
      state,
      battle,
      faeX,
      faeY,
      this.battlePartySprites,
    );
    this.stage.renderVfx(choreo.vfx, cameoSparkles, {
      fae: { x: faeX, y: faeY - 72 },
      critter: { x: critterX, y: critterY - critter.battleHeight * 0.5 },
      party: partyAnchors,
    });
    this.battleLayer.alpha = introEase;
    return false;
  }

  // The one battle layout (spec 8), for the scene, the ring, and renderInfo.
  layoutFor(
    state: State,
    width: number,
    height: number,
    viewWidth: number,
    viewHeight: number,
  ): BattleLayout {
    return battleLayout(
      width,
      height,
      viewWidth,
      viewHeight,
      this.world.critters[state.battle?.critterId ?? ""]?.battleHeight ?? 190,
      faeBox.height,
      battleParty(this.world, state.party).length,
    );
  }

  // Where the battle's check is drawn, in CSS px (spec 8.1); null outside a
  // check and at the reward (the card covers it). A ring sits on the critter,
  // or on Fae in a burst. A friend's charge meter stands on the side away from
  // the critter and their chain drops into their hands (Fae's own, for
  // Soothe). A burst's chain flies from the critter to a target on Fae.
  battleCheckGeometry(
    state: State,
    width: number,
    height: number,
    viewWidth: number,
    viewHeight: number,
  ): BattleCheckGeometry | null {
    const check = battleView(this.world, state)?.check ?? null;
    if (check === null || state.battle?.phase === "reward") return null;
    const layout = this.layoutFor(state, width, height, viewWidth, viewHeight);
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
    if (check.kind === "echo") {
      // Right stage: wide open while commands hide, leaving Fae and the
      // critter completely unobstructed at phone and desktop widths.
      const x = Math.min(
        width - (width >= 1000 ? 164 : 206),
        Math.max(critter.x + critter.height * 0.56 + 132, Math.round(width * 0.77)),
      );
      const y = width >= 1000
        ? Math.max(214, Math.round(critterCentre.y))
        : Math.max(166, Math.round(critterCentre.y));
      const baseHint = hintAt((fae.x + critter.x) / 2);
      return {
        kind: "echo",
        x,
        y,
        hintAt: { x: baseHint.x, y: Math.min(height - 46, Math.max(baseHint.y, 268)) },
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
  battleFeelingAnchor(
    state: State,
    width: number,
    height: number,
    viewWidth: number,
    viewHeight: number,
  ): Point | null {
    if (state.battle === null) return null;
    const layout = this.layoutFor(state, width, height, viewWidth, viewHeight);
    const nearSide = layout.fae.x + 0.45 * layout.fae.height;
    const auraEdge = layout.critter.x - 0.62 * layout.critter.height;
    const critterTop = layout.critter.baseline - layout.critter.height;
    return { x: (nearSide + auraEdge) / 2, y: critterTop - 0.4 * layout.fae.height };
  }

  private battleCheckInfo(
    state: State,
    width: number,
    height: number,
    viewWidth: number,
    viewHeight: number,
  ): BattleCheckInfo | null {
    const check = state.battle?.check ?? null;
    const geometry = this.battleCheckGeometry(state, width, height, viewWidth, viewHeight);
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
    return { ...geometry, side };
  }

  renderInfo(
    state: State,
    width: number,
    height: number,
    viewWidth: number,
    viewHeight: number,
    overworldVisible: boolean,
  ): BattleRenderInfo {
    const layout = state.battle === null
      ? null
      : this.layoutFor(state, width, height, viewWidth, viewHeight);
    return {
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
      check: this.battleCheckInfo(state, width, height, viewWidth, viewHeight),
      layout,
      backdrop: this.stage.bounds(),
      critter:
        state.battle === null
          ? null
          : {
              id: state.battle.critterId,
              frame: critterFrameForBattle(state.battle),
            },
      overworldVisible,
      auraAlpha: state.battle === null ? 0 : this.battleCritterAura.alpha,
    };
  }
}
