import { evaluateIndoorAtmosphere } from "./atmosphere-indoor";
import { evaluateOutdoorAtmosphere } from "./atmosphere-outdoor";
import { evaluateWeatherParticles } from "./weather-particles";
import {
  addFloatingMotes,
  areaSeed,
  resolveStoryAtmosphereOptions,
  SUNLIT_MOTE_TINTS,
  type AtmosphereBlend,
  type AtmosphereLayer,
  type AtmosphereOptions,
  type AtmosphereParticle,
  type AtmosphereTextureKey,
} from "./atmosphere-shared";

export {
  resolveStoryAtmosphereOptions,
  type AtmosphereBlend,
  type AtmosphereLayer,
  type AtmosphereOptions,
  type AtmosphereParticle,
  type AtmosphereTextureKey,
};

function evaluateFallbackAtmosphere(
  areaId: string,
  width: number,
  height: number,
  rawTick: number,
  options?: AtmosphereOptions,
): AtmosphereParticle[] {
  const tick = options?.reducedMotion === true ? 0 : rawTick;
  const out: AtmosphereParticle[] = [];
  addFloatingMotes(out, areaSeed(areaId) + 900, width, height, tick, 8, SUNLIT_MOTE_TINTS, {
    driftX: 0.1,
    driftY: -0.04,
    minScale: 0.18,
    maxScale: 0.32,
    minAlpha: 0.16,
    maxAlpha: 0.38,
  });
  return out;
}

/**
 * Pure deterministic biome atmosphere particle evaluator for any area and tick.
 * Zero Math.random(), zero core state. Returns [] for `harness`.
 * Holds particle positions and pulses steady across ticks under `reducedMotion`.
 */
export function evaluateAtmosphere(
  areaId: string,
  width: number,
  height: number,
  rawTick: number,
  options?: AtmosphereOptions,
): AtmosphereParticle[] {
  if (areaId === "harness") return [];
  const particles =
    evaluateOutdoorAtmosphere(areaId, width, height, rawTick, options) ??
    evaluateIndoorAtmosphere(areaId, width, height, rawTick, options) ??
    evaluateFallbackAtmosphere(areaId, width, height, rawTick, options);
  if (options?.weather !== undefined && options.weather !== "clear") {
    particles.push(
      ...evaluateWeatherParticles(
        options.weather,
        width,
        height,
        rawTick,
        options.reducedMotion === true,
      ),
    );
  }
  return particles;
}
