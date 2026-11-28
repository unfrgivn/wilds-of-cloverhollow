import {
  Assets,
  Container,
  Sprite,
  Spritesheet,
  type Renderer,
  type Texture,
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
import type { CozyWeatherKind } from "../core/weather";
import { getCozyWeatherMode } from "../platform/weather-prefs";
import type { AreaView } from "./area-view";
import { selectBattleActorPose } from "./animation";
import { computeBattleChoreography } from "./battle-choreography";
import {
  renderMultiFoeFormation,
  type FoeSpritePair,
} from "./battle-formation-render";
import {
  battleLayout,
  computeBattleCheckGeometry,
  type BattleCheckGeometry,
  type BattleLayout,
} from "./battle-layout";
import {
  BattleStageRenderer,
  makeShadowSprite,
  type BattleBackdropBounds,
} from "./battle-stage-render";
import { evaluateBattleWeather } from "./battle-weather";
import { NEUTRAL_POSE } from "./motion";
import { liftShadowScale, warmFlashTint } from "./overworld-render";
import type { VfxTextures } from "./vfx-textures";

export { makeShadowSprite, type BattleCheckGeometry };

// Battle sprite scale for Fae (overworld is 0.5); fighting friends scale proportionally.
const FAE_BATTLE_SCALE = 0.72;
// Logical Fae height used for battle layout & check anchors (clears HUD on 874x402).
const FAE_BATTLE_LAYOUT_HEIGHT = 156;

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
  faePose: string | null;
  partyPoses: Record<string, string>;
  layout: {
    critter: { x: number; baseline: number; height: number };
    fae: { x: number; baseline: number; height: number };
    party: { x: number; y: number }[];
  } | null;
  backdrop: BattleBackdropBounds | null;
  overworldVisible: boolean;
  auraAlpha: number;
  weather: { kind: CozyWeatherKind; count: number };
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

function resolveBattleActorFrame(
  actorId: string,
  battle: NonNullable<State["battle"]>,
  fallback: Texture | undefined,
): { texture: Texture | undefined; mirror: boolean; poseName: string } {
  const pose = selectBattleActorPose(actorId, battle);
  const poseTex = pose === null
    ? undefined
    : Assets.get<Spritesheet | undefined>(`${actorId}-poses`)?.animations[pose.animation]?.[0];
  return poseTex !== undefined && pose !== null
    ? { texture: poseTex, mirror: pose.mirror, poseName: pose.animation }
    : { texture: fallback, mirror: true, poseName: "idle_left" };
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
  private readonly extraFoes: readonly [FoeSpritePair, FoeSpritePair];
  private readonly battleFae = new Sprite();
  private readonly battlePartySprites = new Map<string, Sprite>();
  private hasRenderedBattle = false;
  private lastFaePose: string | null = null;
  private lastPartyPoses: Record<string, string> = {};
  private lastWeather: { kind: CozyWeatherKind; count: number } = { kind: "clear", count: 0 };

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
    const mkExtra = (slot: number): FoeSpritePair => {
      const body = new Sprite();
      const aura = new Sprite();
      body.label = `battle:foe-${slot}`;
      aura.label = `battle:foe-${slot}:aura`;
      body.visible = false;
      aura.visible = false;
      return { body, aura };
    };
    this.extraFoes = [mkExtra(1), mkExtra(2)];

    this.battleLayer.addChild(
      ...this.stage.underlaySprites,
      this.stage.weatherLayer,
      ...this.stage.shadowSprites,
      this.battleCritterAura,
      this.battleCritter,
      this.extraFoes[0].aura,
      this.extraFoes[0].body,
      this.extraFoes[1].aura,
      this.extraFoes[1].body,
      ...this.battlePartySprites.values(),
      this.battleFae,
      this.stage.turnIndicator,
      this.stage.targetIndicator,
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
      if (
        state.transition?.tone === "dark" &&
        state.transition.phase === "out" &&
        this.hasRenderedBattle
      ) {
        return false;
      }
      this.hasRenderedBattle = false;
      this.lastFaePose = null;
      this.lastPartyPoses = {};
      this.lastWeather = { kind: "clear", count: 0 };
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
      this.lastFaePose = null;
      this.lastPartyPoses = {};
      this.lastWeather = { kind: "clear", count: 0 };
      this.stage.renderWeather([]);
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
      battle, viewModel, state.tick, partyIds, partyCommands, reducedMotion,
    );
    this.battleLayer.scale.set(scale);
    this.battleLayer.position.set(
      x + (reducedMotion ? 0 : choreo.stageShake.x * scale),
      y + (reducedMotion ? 0 : choreo.stageShake.y * scale),
    );
    if (choreo.stageMood === "together-active") {
      this.stage.drawWash(width, height, 0.54, 0x201042);
    } else if (choreo.stageMood === "rest") {
      const washAlpha = reducedMotion
        ? 0.55
        : 0.25 + 0.37 * Math.min(1, Math.max(0, battle.phaseTicks / 36));
      this.stage.drawWash(width, height, washAlpha, 0x120d1f);
    } else {
      this.stage.drawWash(width, height, 0.2);
    }

    const weatherFrame = evaluateBattleWeather(
      state.area, viewWidth, viewHeight, state.tick, getCozyWeatherMode(), reducedMotion,
    );
    this.stage.renderWeather(weatherFrame.particles);
    this.lastWeather = { kind: weatherFrame.kind, count: weatherFrame.particles.length };

    const slideOffset = 14 * (1 - introEase);
    const critter = this.world.critters[battle.critterId];
    if (critter === undefined) return false;
    const critterFrame = critterFrameForBattle(battle);
    const critterPose = choreo.critter;
    const foes = viewModel?.foes ?? [];
    let critterX: number;
    let critterY: number;
    let critterFocusHeight = critter.battleHeight;
    let targetHead: Point | undefined;
    if (foes.length > 1) {
      const placed = renderMultiFoeFormation({
        world: this.world, stage: this.stage,
        primary: { body: this.battleCritter, aura: this.battleCritterAura },
        extras: this.extraFoes, battle, foes,
        targetIndex: viewModel?.targetIndex ?? 0, critterFrame, critterPose,
        auraScaleBoost: choreo.auraScaleBoost, tick: state.tick,
        width, height, stageX: x, stageY: y, scale, slideOffset, reducedMotion, placeAura,
      });
      critterX = placed.critterX;
      critterY = placed.critterY;
      critterFocusHeight = placed.critterHeight;
      targetHead = battle.phase === "command" ? placed.targetHead : undefined;
    } else {
      for (const extra of this.extraFoes) {
        extra.body.visible = false;
        extra.aura.visible = false;
      }
      this.stage.updateExtraFoeShadow(1, false, 0, 0, 145, 1, 1);
      this.stage.updateExtraFoeShadow(2, false, 0, 0, 145, 1, 1);
      const sheet = Assets.get<Spritesheet | undefined>(critter.atlas);
      if (sheet === undefined) return false;
      const body = sheet.textures[critterFrame];
      const aura = sheet.textures.chaos_aura_01;
      if (body === undefined || aura === undefined) throw new Error("Missing battle critter frame");
      this.battleCritter.visible = true;
      this.battleCritterAura.visible = true;
      this.battleCritter.texture = body;
      this.battleCritter.anchor.set(0.5, 504 / 512);
      const puff = viewModel?.puff ?? 0;
      const swell = puff === 0 ? 1 : 1 + 0.06 * puff + 0.012 * Math.sin(state.tick / 7);
      const critterScale = (critter.battleHeight / critter.figureHeight) * swell;
      this.battleCritter.scale.set(
        critterScale * critterPose.scaleX, critterScale * critterPose.scaleY,
      );
      critterX = (layout.critter.x - x) / scale + slideOffset;
      critterY = (layout.critter.baseline - y) / scale;
      this.battleCritter.position.set(
        critterX + critterPose.offsetX, critterY + critterPose.offsetY,
      );
      this.battleCritter.rotation = critterPose.rotation;
      this.stage.updateCritterShadow(
        critterX + critterPose.offsetX * 0.85, critterY, critter.battleHeight,
        swell, liftShadowScale(critterPose.offsetY),
      );
      this.battleCritterAura.texture = aura;
      placeAura(
        this.battleCritterAura, this.battleCritter.position,
        critterScale * choreo.auraScaleBoost, critter.auraCentre, critter.bodyCentre,
      );
      this.battleCritterAura.alpha =
        battle.phase === "reward"
          ? 0
          : battle.phase === "soothed"
            ? Math.max(0, 1 - battle.phaseTicks / 30)
            : 0.65 + Math.sin(state.tick / 18) * 0.2;
      this.battleCritterAura.rotation = state.tick / 180;
    }
    this.stage.updateTargetIndicator(targetHead, state.tick, reducedMotion);

    const faeSheet = Assets.get<Spritesheet>("fae-sheet");
    const faeFallback = (faeSheet.animations.idle_left ?? faeSheet.animations.idle_up)?.[0];
    const faeFrame = resolveBattleActorFrame("fae", battle, faeFallback);
    this.lastFaePose = faeFrame.poseName;
    const faeX = (layout.fae.x - x) / scale - slideOffset;
    const faeY = (layout.fae.baseline - y) / scale;
    const faePose = choreo.fae;
    if (faeFrame.texture !== undefined) {
      this.battleFae.texture = faeFrame.texture;
      if (faeFrame.texture.defaultAnchor !== undefined)
        this.battleFae.anchor.copyFrom(faeFrame.texture.defaultAnchor);
      const sign = faeFrame.mirror ? -FAE_BATTLE_SCALE : FAE_BATTLE_SCALE;
      this.battleFae.scale.set(sign * faePose.scaleX, FAE_BATTLE_SCALE * faePose.scaleY);
      this.battleFae.position.set(faeX + faePose.offsetX, faeY + faePose.offsetY);
      this.battleFae.rotation = faePose.rotation;
      this.battleFae.tint = warmFlashTint(faePose.tintFlash);
    }
    this.stage.updateFaeShadow(
      faeX + faePose.offsetX * 0.85, faeY, liftShadowScale(faePose.offsetY),
    );
    const phase2 = viewModel?.bossPhase2 ?? null;
    this.stage.renderLighting(
      choreo.stageMood, state.tick, viewWidth, viewHeight, faeX, faeY, critterX, critterY,
      reducedMotion,
      phase2 === null
        ? undefined
        : { waveA: phase2.waveATint, waveB: phase2.waveBTint, spotlight: phase2.spotlightTint },
    );

    // Fae and all fighting party members face right toward the critter
    // (mirrored `idle_left`), lined up behind Fae with pets at the end. Flute
    // friends sit battles out, hopping in only for a brief cameo.
    const inParty = new Set(fighting.map((member) => member.id));
    for (const [id, sprite] of this.battlePartySprites) {
      const visible = inParty.has(id);
      sprite.visible = visible;
      sprite.alpha = 1;
    }
    this.stage.setPartyShadowsVisible(inParty);
    const partyAnchors = new Map<string, Point>();
    const actorHeads = new Map<string, Point>();
    actorHeads.set("fae", {
      x: faeX + faePose.offsetX,
      y: faeY - faeBox.height * (FAE_BATTLE_SCALE / 0.5) - 10,
    });
    const nextPartyPoses: Record<string, string> = {};
    fighting.forEach((member, index) => {
      const sprite = this.battlePartySprites.get(member.id);
      const content = this.world.party[member.id];
      const place = layout.party[index];
      if (sprite === undefined || content === undefined || place === undefined) return;
      const memberSheet = Assets.get<Spritesheet>(`${member.id}-sheet`);
      const fallback = (memberSheet.animations.idle_left ?? memberSheet.animations.idle_down)?.[0];
      const resolved = resolveBattleActorFrame(member.id, battle, fallback);
      if (resolved.texture === undefined) return;
      nextPartyPoses[member.id] = resolved.poseName;
      sprite.texture = resolved.texture;
      if (resolved.texture.defaultAnchor !== undefined)
        sprite.anchor.copyFrom(resolved.texture.defaultAnchor);
      const baseScale = ((content.scale ?? 0.5) / 0.5) * FAE_BATTLE_SCALE;
      const memberPose = choreo.party[member.id] ?? NEUTRAL_POSE;
      const sign = resolved.mirror ? -baseScale : baseScale;
      sprite.scale.set(sign * memberPose.scaleX, baseScale * memberPose.scaleY);
      const memberX = (place.x - x) / scale - slideOffset;
      const memberY = (place.y - y) / scale;
      sprite.position.set(memberX + memberPose.offsetX, memberY + memberPose.offsetY);
      sprite.rotation = memberPose.rotation;
      partyAnchors.set(member.id, { x: memberX, y: memberY - 58 });
      actorHeads.set(member.id, {
        x: memberX + memberPose.offsetX,
        y: memberY - content.box.height * (baseScale / 0.5) - 10,
      });
      this.stage.updatePartyShadow(
        member.id, memberX + memberPose.offsetX * 0.85, memberY, content.box.width,
        liftShadowScale(memberPose.offsetY),
      );
    });
    this.lastPartyPoses = nextPartyPoses;

    const activeHead = battle.phase === "command" && viewModel !== null
      ? actorHeads.get(viewModel.activeActor.id)
      : undefined;
    this.stage.updateTurnIndicator(activeHead, state.tick, reducedMotion);

    const cameoSparkles = this.stage.renderFluteCameo(
      state,
      battle,
      faeX,
      faeY,
      this.battlePartySprites,
    );
    this.stage.renderVfx(choreo.vfx, cameoSparkles, {
      fae: { x: faeX, y: faeY - 72 },
      critter: { x: critterX, y: critterY - critterFocusHeight * 0.5 },
      party: partyAnchors,
    });
    this.battleLayer.alpha = introEase;
    this.hasRenderedBattle = true;
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
      this.world.critters[state.battle?.critterId ?? ""]?.battleHeight ?? 145,
      FAE_BATTLE_LAYOUT_HEIGHT,
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
    return computeBattleCheckGeometry(
      this.world,
      state,
      battleView(this.world, state),
      this.layoutFor(state, width, height, viewWidth, viewHeight),
      width,
      height,
    );
  }

  // Where the critter's thought cloud floats (spec 8.1), in CSS px: centred
  // in the open ground between Fae (at the front of her party) and the
  // critter's aura, its top just above the critter's head. The shell keeps it
  // below the HUD.
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
        ...geometry, side,
        x: geometry.rect.x + geometry.rect.width * geometry.brush.x / 1000,
        y: geometry.rect.y + geometry.rect.height * geometry.brush.y / 1000,
      };
    if (geometry.kind === "spin-snag")
      return {
        ...geometry, side,
        x: geometry.rect.x + geometry.rect.width / 2,
        y: geometry.rect.y + geometry.rect.height / 2,
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
      faePose: state.battle === null ? null : this.lastFaePose,
      partyPoses: state.battle === null ? {} : { ...this.lastPartyPoses },
      overworldVisible,
      auraAlpha: state.battle === null ? 0 : this.battleCritterAura.alpha,
      weather: state.battle === null
        ? { kind: "clear", count: 0 }
        : { kind: this.lastWeather.kind, count: this.lastWeather.count },
    };
  }
}
