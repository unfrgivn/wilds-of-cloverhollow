import { evaluateIndoorAtmosphere } from "./atmosphere-indoor";
import { evaluateOutdoorAtmosphere } from "./atmosphere-outdoor";
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
  const outdoor = evaluateOutdoorAtmosphere(areaId, width, height, rawTick, options);
  if (outdoor !== null) return outdoor;
  const indoor = evaluateIndoorAtmosphere(areaId, width, height, rawTick, options);
  if (indoor !== null) return indoor;

  // Fallback for any future outdoor area: gentle sunlit motes.
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
