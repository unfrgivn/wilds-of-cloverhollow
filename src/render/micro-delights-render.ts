import { Container, Graphics, Sprite } from "pixi.js";
import { npcVisible, type State, type World } from "../core";
import { makeShadowSprite } from "./battle-view";
import {
  createBeachBallState, createPebbleSkip, SANCTUARY_HOP_DURATION, stepBeachBall, stepPebbleSkip,
  type BeachBallState, type PebbleSkip, type PebbleSkipSpot,
} from "./micro-delights";
import type { VfxTextures } from "./vfx-textures";

export type MicroDelightsRenderInfo = {
  beachBall: { x: number; y: number; z: number; kicks: number } | null;
  activeSkips: number;
  activeHopNpc: string | null;
  scenicZoom: number;
};

const BEACH_BALL_RADIUS = 18;
const PANEL_COLORS: readonly number[] = [
  0xf28482, 0xfff7e6, 0x7ec8e3, 0xfff7e6, 0xf6d55c, 0xfff7e6,
];
const HOP_PARTICLE_COUNT = 4;
const HOP_PARTICLE_TINTS: readonly number[] = [0xff8fab, 0xffe066, 0xffa8c2, 0xb8f2e6];

function drawBeachBall(graphic: Graphics): void {
  const r = BEACH_BALL_RADIUS;
  graphic.clear();
  const slice = (Math.PI * 2) / PANEL_COLORS.length;
  for (let i = 0; i < PANEL_COLORS.length; i += 1) {
    const start = i * slice - Math.PI / 2;
    graphic.moveTo(0, 0).arc(0, 0, r, start, start + slice).closePath()
      .fill(PANEL_COLORS[i] ?? 0xfff7e6);
  }
  for (let i = 0; i < PANEL_COLORS.length; i += 1) {
    const angle = i * slice - Math.PI / 2;
    graphic.moveTo(0, 0).lineTo(Math.cos(angle) * r, Math.sin(angle) * r)
      .stroke({ color: 0x47321f, width: 1.5, alpha: 0.52 });
  }
  // Soft painterly bottom-right shade + sunlit watercolor highlight.
  graphic.arc(0, 0, r - 1, Math.PI * 0.08, Math.PI * 0.88).fill({ color: 0x6b4730, alpha: 0.16 });
  graphic.circle(-r * 0.28, -r * 0.3, r * 0.28).fill({ color: 0xfffef8, alpha: 0.45 });
  graphic.circle(0, 0, 3.8).fill(0xfffaf0).stroke({ color: 0x47321f, width: 1.4, alpha: 0.8 });
  graphic.circle(0, 0, r).stroke({ color: 0x47321f, width: 2.3, alpha: 0.92 });
}

/**
 * Owns Pixi visual pools for Track E16 overworld micro-delights: the kickable
 * Bubblegum Bay beach ball, shoreline pebble-skipping arcs/ripples, and joyful
 * Sanctuary critter pet-hop hearts/sparkles.
 */
export class MicroDelightsRenderer {
  readonly pebbleLayer = new Container();
  readonly hopSparkleLayer = new Container();

  private readonly ballContainer = new Container();
  private readonly ballGraphic = new Graphics();
  private readonly ballShadow: Sprite;
  private readonly pebbleGraphic = new Graphics();
  private readonly hopSprites: Sprite[] = [];

  private beachBall: BeachBallState = createBeachBallState();
  private skips: PebbleSkip[] = [];
  private activeHop: { npcId: string; startTick: number } | null = null;
  private scenicZoom = 1;

  constructor(vfx: VfxTextures, depthLayer: Container, shadowLayer: Container) {
    this.pebbleLayer.label = "micro:pebbles";
    this.pebbleLayer.addChild(this.pebbleGraphic);

    this.ballContainer.label = "micro:beach-ball";
    this.ballContainer.visible = false;
    drawBeachBall(this.ballGraphic);
    this.ballContainer.addChild(this.ballGraphic);
    depthLayer.addChild(this.ballContainer);

    this.ballShadow = makeShadowSprite(vfx.contactShadow, "shadow:micro:beach-ball");
    this.ballShadow.visible = false;
    shadowLayer.addChild(this.ballShadow);

    this.hopSparkleLayer.label = "micro:sanctuary-hop";
    for (let i = 0; i < HOP_PARTICLE_COUNT; i += 1) {
      const sprite = new Sprite(i % 2 === 0 ? vfx.heart : vfx.sparkle);
      sprite.label = `micro:hop:${i}`;
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.hopSprites.push(sprite);
      this.hopSparkleLayer.addChild(sprite);
    }
  }

  reset(): void {
    this.beachBall = createBeachBallState();
    this.skips = [];
    this.activeHop = null;
    this.scenicZoom = 1;
    this.ballContainer.visible = false;
    this.ballShadow.visible = false;
    this.pebbleGraphic.clear();
    for (const sprite of this.hopSprites) sprite.visible = false;
  }

  stepOverworldTick(state: State, reducedMotion: boolean): { beachBallKicked: boolean } {
    if (
      state.area !== "bay" || state.battle !== null || state.arcade !== null ||
      state.dialogue !== null || state.transition !== null || state.journalOpen ||
      state.finale !== null
    ) return { beachBallKicked: false };
    const result = stepBeachBall(
      this.beachBall, state.player, state.motion.moving, state.tick, reducedMotion,
    );
    return { beachBallKicked: result.kicked };
  }

  triggerPebbleSkip(spot: PebbleSkipSpot, tick: number, reducedMotion: boolean): void {
    this.skips.push(createPebbleSkip(spot, tick, reducedMotion));
    if (this.skips.length > 4) this.skips.shift();
  }

  triggerSanctuaryHop(npcId: string, tick: number): void {
    this.activeHop = { npcId, startTick: tick };
  }

  activeHopInfo(state: State): { npcId: string; elapsed: number } | null {
    if (this.activeHop === null || state.area !== "sanctuary") return null;
    const elapsed = state.tick - this.activeHop.startTick;
    if (elapsed < 0 || elapsed >= SANCTUARY_HOP_DURATION || state.battle !== null) {
      this.activeHop = null;
      return null;
    }
    return { npcId: this.activeHop.npcId, elapsed };
  }

  setScenicZoom(zoom: number): void {
    this.scenicZoom = zoom;
  }

  render(
    world: World, state: State, areaId: string, shadowAlpha: number, reducedMotion: boolean,
  ): void {
    const overworldVisible = state.battle === null && state.arcade === null;
    const showBall = overworldVisible && areaId === "bay";
    this.ballContainer.visible = showBall;
    this.ballShadow.visible = showBall;
    if (showBall) {
      this.ballContainer.position.set(
        this.beachBall.x, this.beachBall.y - this.beachBall.z - BEACH_BALL_RADIUS + 2,
      );
      this.ballContainer.zIndex = this.beachBall.y;
      this.ballGraphic.rotation = this.beachBall.spin;
      const liftScale = Math.max(0.55, 1 - this.beachBall.z * 0.015);
      this.ballShadow.position.set(this.beachBall.x, this.beachBall.y);
      this.ballShadow.width = 30 * liftScale;
      this.ballShadow.height = 12 * liftScale;
      this.ballShadow.alpha = shadowAlpha * liftScale;
    }

    this.pebbleGraphic.clear();
    if (overworldVisible && this.skips.length > 0) {
      const remaining: PebbleSkip[] = [];
      for (const skip of this.skips) {
        if (skip.area !== areaId) continue;
        const frame = stepPebbleSkip(skip, state.tick);
        if (!frame.active) continue;
        remaining.push(skip);
        for (const r of frame.ripples) {
          this.pebbleGraphic.ellipse(r.x, r.y, r.radius, r.radius * 0.48)
            .stroke({ color: 0xfdf7e4, width: 1.8, alpha: r.alpha });
          if (r.radius > 10) {
            this.pebbleGraphic.ellipse(r.x, r.y, r.radius * 0.62, r.radius * 0.3)
              .stroke({ color: 0x7fd4e6, width: 1.2, alpha: r.alpha * 0.72 });
          }
        }
        for (const d of frame.droplets) {
          this.pebbleGraphic.circle(d.x, d.y, 2.2).fill({ color: 0xebfaff, alpha: d.alpha });
        }
        if (frame.stone !== null) {
          this.pebbleGraphic.ellipse(frame.stone.x, frame.stone.y + 1, 4.2, 2.1)
            .fill({ color: 0x264454, alpha: 0.25 * frame.stone.alpha });
          this.pebbleGraphic.ellipse(frame.stone.x, frame.stone.y - frame.stone.z, 4.5, 2.6)
            .fill({ color: 0x6f5846, alpha: frame.stone.alpha })
            .stroke({ color: 0x3b2a1e, width: 1.1, alpha: frame.stone.alpha });
        }
      }
      this.skips = remaining;
    } else if (!overworldVisible) {
      this.skips = [];
    }

    const hop = overworldVisible ? this.activeHopInfo(state) : null;
    const area = world.areas[areaId];
    const hopNpc = hop === null || area === undefined
      ? undefined
      : area.npcs.find((npc) => npc.id === hop.npcId && npcVisible(world, state, npc));
    if (hop === null || hopNpc === undefined || reducedMotion) {
      for (const sprite of this.hopSprites) sprite.visible = false;
      return;
    }
    const u = hop.elapsed / SANCTUARY_HOP_DURATION;
    for (let i = 0; i < this.hopSprites.length; i += 1) {
      const sprite = this.hopSprites[i];
      if (sprite === undefined) continue;
      const spread = (i - 1.5) * 14;
      const rise = 44 + u * 34 + (i % 2) * 8;
      const sway = Math.sin(u * Math.PI * 2 + i * 1.4) * 4;
      const alpha = u < 0.2 ? u / 0.2 : Math.max(0, 1 - (u - 0.2) / 0.8);
      sprite.visible = alpha > 0.02;
      sprite.position.set(hopNpc.point.x + spread + sway, hopNpc.point.y - rise);
      const size = i % 2 === 0 ? 15 : 13;
      sprite.width = size;
      sprite.height = size;
      sprite.tint = HOP_PARTICLE_TINTS[i] ?? 0xff8fab;
      sprite.alpha = alpha * 0.92;
    }
  }

  info(state: State): MicroDelightsRenderInfo {
    const activeSkips = this.skips.filter(
      (skip) => skip.area === state.area && stepPebbleSkip(skip, state.tick).active,
    ).length;
    const hop = this.activeHopInfo(state);
    return {
      beachBall: state.area === "bay"
        ? {
            x: Math.round(this.beachBall.x * 10) / 10,
            y: Math.round(this.beachBall.y * 10) / 10,
            z: Math.round(this.beachBall.z * 10) / 10,
            kicks: this.beachBall.kicks,
          }
        : null,
      activeSkips,
      activeHopNpc: hop?.npcId ?? null,
      scenicZoom: Math.round(this.scenicZoom * 1000) / 1000,
    };
  }
}
