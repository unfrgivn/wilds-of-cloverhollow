import { Assets, type Sprite, type Spritesheet } from "pixi.js";
import type { Battle, BattleFoeView, Point, World } from "../core";
import { formationFoeLayouts } from "./battle-layout";
import type { BattleStageRenderer } from "./battle-stage-render";
import type { MotionPose } from "./motion";
import { liftShadowScale } from "./overworld-render";

export type FoeSpritePair = {
  body: Sprite;
  aura: Sprite;
};

export type MultiFoeRenderParams = {
  world: World;
  stage: BattleStageRenderer;
  primary: FoeSpritePair;
  extras: readonly [FoeSpritePair, FoeSpritePair];
  battle: Battle;
  foes: readonly BattleFoeView[];
  targetIndex: number;
  critterFrame: string;
  critterPose: MotionPose;
  auraScaleBoost: number;
  tick: number;
  width: number;
  height: number;
  stageX: number;
  stageY: number;
  scale: number;
  slideOffset: number;
  reducedMotion: boolean;
  placeAura: (
    aura: Sprite,
    feet: Point,
    scale: number,
    auraCentre: Point,
    bodyCentre: Point,
  ) => void;
};

export type MultiFoeRenderResult = {
  critterX: number;
  critterY: number;
  critterHeight: number;
  targetHead: Point | undefined;
};

/**
 * Places 2–3 formation critters, their auras, and pooled contact shadows on
 * the battle stage, returning the targeted foe's anchor and head point.
 */
export function renderMultiFoeFormation(params: MultiFoeRenderParams): MultiFoeRenderResult {
  const {
    world, stage, primary, extras, battle, foes, targetIndex, critterFrame,
    critterPose, auraScaleBoost, tick, width, height, stageX, stageY, scale,
    slideOffset, reducedMotion, placeAura,
  } = params;
  const slots = formationFoeLayouts(width, height, scale, foes);
  const pairs: readonly FoeSpritePair[] = [primary, extras[0], extras[1]];
  let focusX = width * 0.5;
  let focusY = height * 0.42;
  let focusHeight = 145;
  let targetHead: Point | undefined;

  for (let idx = 0; idx < pairs.length; idx += 1) {
    const pair = pairs[idx];
    const foe = foes[idx];
    const slot = slots[idx];
    if (pair === undefined) continue;
    if (foe === undefined || slot === undefined) {
      pair.body.visible = false;
      pair.aura.visible = false;
      if (idx === 1 || idx === 2) stage.updateExtraFoeShadow(idx, false, 0, 0, 145, 1, 1);
      continue;
    }
    const entry = world.critters[foe.critterId];
    const sheet =
      entry === undefined ? undefined : Assets.get<Spritesheet | undefined>(entry.atlas);
    const frameName = foe.soothed ? "calm_idle_01" : critterFrame;
    const bodyTex = sheet?.textures[frameName] ?? sheet?.textures.chaos_idle_01;
    const auraTex = sheet?.textures.chaos_aura_01;
    if (entry === undefined || bodyTex === undefined || auraTex === undefined) {
      pair.body.visible = false;
      pair.aura.visible = false;
      if (idx === 1 || idx === 2) stage.updateExtraFoeShadow(idx, false, 0, 0, 145, 1, 1);
      continue;
    }
    pair.body.visible = true;
    pair.aura.visible = true;
    pair.body.texture = bodyTex;
    pair.body.anchor.set(0.5, 504 / 512);
    const targeted = idx === targetIndex;
    const staggerBob = !targeted && !reducedMotion && !foe.soothed
      ? -Math.abs(Math.sin((tick + idx * 7) / 11)) * 2.2
      : 0;
    const poseOffsetX = targeted ? critterPose.offsetX : 0;
    const poseOffsetY = targeted ? critterPose.offsetY : staggerBob;
    const poseScaleX = targeted ? critterPose.scaleX : 1;
    const poseScaleY = targeted ? critterPose.scaleY : 1;
    const poseRot = targeted ? critterPose.rotation : 0;
    const puff = foe.windUp === null ? 0 : Math.max(1, foe.windUp.bubbles.length);
    const swell = puff === 0 || foe.soothed
      ? 1
      : 1 + 0.05 * puff + (reducedMotion ? 0 : 0.012 * Math.sin((tick + idx * 5) / 7));
    const foeScale = (entry.battleHeight / entry.figureHeight) * swell;
    const fx = (slot.x - stageX) / scale + slideOffset;
    const fy = (slot.baseline - stageY) / scale;
    pair.body.scale.set(foeScale * poseScaleX, foeScale * poseScaleY);
    pair.body.position.set(fx + poseOffsetX, fy + poseOffsetY);
    pair.body.rotation = poseRot;

    const lift = liftShadowScale(poseOffsetY);
    if (idx === 0) {
      stage.updateCritterShadow(fx + poseOffsetX * 0.85, fy, entry.battleHeight, swell, lift);
    } else if (idx === 1 || idx === 2) {
      stage.updateExtraFoeShadow(
        idx, true, fx + poseOffsetX * 0.85, fy, entry.battleHeight, swell, lift,
      );
    }

    pair.aura.texture = auraTex;
    placeAura(
      pair.aura,
      pair.body.position,
      foeScale * (targeted ? auraScaleBoost : 1),
      entry.auraCentre,
      entry.bodyCentre,
    );
    pair.aura.alpha = foe.soothed || battle.phase === "reward"
      ? 0
      : battle.phase === "soothed"
        ? Math.max(0, 1 - battle.phaseTicks / 30)
        : 0.65 + Math.sin((tick + idx * 9) / 18) * 0.2;
    pair.aura.rotation = (tick + idx * 24) / 180;

    if (targeted) {
      focusX = fx;
      focusY = fy;
      focusHeight = entry.battleHeight;
      targetHead = { x: fx + poseOffsetX, y: fy - entry.battleHeight - 16 };
    }
  }

  return {
    critterX: focusX,
    critterY: focusY,
    critterHeight: focusHeight,
    targetHead,
  };
}
