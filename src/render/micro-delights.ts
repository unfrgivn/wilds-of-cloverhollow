import {
  npcVisible, targetInteractable, type Npc, type NpcChatterBubble, type Point, type State,
  type World,
} from "../core";
import type { CompanionAudioEffect } from "../platform/audio-effects";
import { NEUTRAL_POSE, type MotionPose } from "./motion";

// --- 1. Kickable Bubblegum Bay Beach Ball ---

/**
 * Resting spot on sunlit south-east Bubblegum Bay sand: strictly east of x=1280
 * and south of y=905+18 so desktop (1280x720) and phone (874x402) bay arrival
 * snapshots never frame it, while keeping clear of every prop and interactable.
 */
export const BEACH_BALL_HOME: Point = { x: 1465, y: 946 };
export const BEACH_BALL_SANDBOX = { minX: 1160, maxX: 1580, minY: 690, maxY: 965 } as const;
export const BEACH_BALL_KICK_RADIUS = 34;
export const BEACH_BALL_KICK_COOLDOWN = 14;
export const BEACH_BALL_KICK_SPEED = 6.4;
export const BEACH_BALL_KICK_ZVEL = 4.2;
export const BEACH_BALL_SAND_DRAG = 0.935;

export type BeachBallState = {
  x: number; y: number; vx: number; vy: number; z: number; vz: number;
  spin: number; kicks: number; kickedCooldown: number; lastTick: number;
};

export function createBeachBallState(): BeachBallState {
  return {
    x: BEACH_BALL_HOME.x, y: BEACH_BALL_HOME.y, vx: 0, vy: 0, z: 0, vz: 0,
    spin: 0, kicks: 0, kickedCooldown: 0, lastTick: -1,
  };
}

export function stepBeachBall(
  ball: BeachBallState, player: Point, playerMoving: boolean, tick: number, reducedMotion: boolean,
): { kicked: boolean } {
  if (ball.lastTick >= 0 && tick === ball.lastTick) return { kicked: false };
  if (ball.lastTick >= 0 && tick < ball.lastTick) Object.assign(ball, createBeachBallState());

  let kicked = false;
  if (ball.kickedCooldown > 0) ball.kickedCooldown -= 1;

  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= BEACH_BALL_KICK_RADIUS && ball.kickedCooldown === 0 && (playerMoving || dist <= 26)) {
    const nx = dist > 0.001 ? dx / dist : 1;
    const ny = dist > 0.001 ? dy / dist : -0.35;
    ball.vx = nx * BEACH_BALL_KICK_SPEED;
    ball.vy = ny * BEACH_BALL_KICK_SPEED;
    ball.vz = reducedMotion ? 0 : BEACH_BALL_KICK_ZVEL;
    ball.kicks += 1;
    ball.kickedCooldown = BEACH_BALL_KICK_COOLDOWN;
    kicked = true;
  }

  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vx *= BEACH_BALL_SAND_DRAG;
  ball.vy *= BEACH_BALL_SAND_DRAG;
  if (Math.hypot(ball.vx, ball.vy) < 0.04) { ball.vx = 0; ball.vy = 0; }

  if (ball.x < BEACH_BALL_SANDBOX.minX) {
    ball.x = BEACH_BALL_SANDBOX.minX; ball.vx = Math.abs(ball.vx) * 0.72;
  } else if (ball.x > BEACH_BALL_SANDBOX.maxX) {
    ball.x = BEACH_BALL_SANDBOX.maxX; ball.vx = -Math.abs(ball.vx) * 0.72;
  }
  if (ball.y < BEACH_BALL_SANDBOX.minY) {
    ball.y = BEACH_BALL_SANDBOX.minY; ball.vy = Math.abs(ball.vy) * 0.72;
  } else if (ball.y > BEACH_BALL_SANDBOX.maxY) {
    ball.y = BEACH_BALL_SANDBOX.maxY; ball.vy = -Math.abs(ball.vy) * 0.72;
  }

  if (reducedMotion) {
    ball.z = 0; ball.vz = 0;
  } else {
    if (ball.z > 0 || ball.vz !== 0) {
      ball.vz -= 0.34; ball.z += ball.vz;
      if (ball.z <= 0) {
        ball.z = 0; ball.vz = Math.abs(ball.vz) > 0.6 ? Math.abs(ball.vz) * 0.56 : 0;
      }
    }
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0) ball.spin += (ball.vx >= 0 ? 1 : -1) * speed * 0.055;
  }

  ball.lastTick = tick;
  return { kicked };
}

// --- 2. Pond & Shore Pebble Skipping ---

export type PebbleSkipSpot = {
  id: string; area: string; x: number; y: number; radius: number;
  launch: Point; dx: number; dy: number; skips: number;
};

export const PEBBLE_SKIP_DURATION = 54;

export const PEBBLE_SKIP_SPOTS: readonly PebbleSkipSpot[] = [
  {
    id: "park-pond-skip", area: "park", x: 765, y: 785, radius: 62,
    launch: { x: 845, y: 775 }, dx: 0.98, dy: -0.18, skips: 4,
  },
  {
    id: "bay-surf-skip", area: "bay", x: 1315, y: 760, radius: 58,
    launch: { x: 1385, y: 590 }, dx: 0.92, dy: -0.35, skips: 4,
  },
  {
    id: "island-cove-skip", area: "island", x: 1035, y: 745, radius: 58,
    launch: { x: 985, y: 905 }, dx: -0.85, dy: 0.52, skips: 3,
  },
];

export type PebbleRipple = { x: number; y: number; radius: number; alpha: number };
export type PebbleDroplet = { x: number; y: number; alpha: number };

export type PebbleSkip = {
  spotId: string; area: string; startTick: number; duration: number; reducedMotion: boolean;
  launch: Point; dx: number; dy: number; skips: number;
};

export type PebbleSkipFrame = {
  active: boolean;
  stone: { x: number; y: number; z: number; alpha: number } | null;
  ripples: PebbleRipple[];
  droplets: PebbleDroplet[];
};

function isOverworldActionOpen(state: State): boolean {
  return (
    state.dialogue === null && state.battle === null && state.arcade === null &&
    !state.journalOpen && state.finale === null && state.transition === null
  );
}

export function findPebbleSkipSpot(world: World, state: State): PebbleSkipSpot | null {
  if (!isOverworldActionOpen(state)) return null;
  if (targetInteractable(world, state) !== undefined) return null;
  let best: PebbleSkipSpot | null = null;
  let bestDist = Infinity;
  for (const spot of PEBBLE_SKIP_SPOTS) {
    if (spot.area !== state.area) continue;
    const dist = Math.hypot(state.player.x - spot.x, state.player.y - spot.y);
    if (dist <= spot.radius && dist < bestDist) {
      best = spot;
      bestDist = dist;
    }
  }
  return best;
}

export function createPebbleSkip(
  spot: PebbleSkipSpot, tick: number, reducedMotion: boolean,
): PebbleSkip {
  return {
    spotId: spot.id, area: spot.area, startTick: tick, duration: PEBBLE_SKIP_DURATION,
    reducedMotion, launch: { ...spot.launch }, dx: spot.dx, dy: spot.dy, skips: spot.skips,
  };
}

export function stepPebbleSkip(skip: PebbleSkip, tick: number): PebbleSkipFrame {
  const elapsed = tick - skip.startTick;
  if (elapsed < 0 || elapsed >= skip.duration) {
    return { active: false, stone: null, ripples: [], droplets: [] };
  }
  if (skip.reducedMotion) {
    const progress = elapsed / skip.duration;
    return {
      active: true, stone: null, droplets: [],
      ripples: [{
        x: skip.launch.x + skip.dx * 72, y: skip.launch.y + skip.dy * 72,
        radius: 8 + progress * 24, alpha: 0.55 * (1 - progress),
      }],
    };
  }

  const hopTicks = 10;
  const flightTicks = skip.skips * hopTicks;
  const hopSpacing = 52;
  let stone: PebbleSkipFrame["stone"] = null;
  if (elapsed < flightTicks) {
    const hopIndex = Math.floor(elapsed / hopTicks);
    const hopPhase = (elapsed % hopTicks) / hopTicks;
    const travel = (hopIndex + hopPhase) * hopSpacing;
    const peak = Math.max(7, 19 - hopIndex * 3.5);
    stone = {
      x: skip.launch.x + skip.dx * travel,
      y: skip.launch.y + skip.dy * travel,
      z: Math.sin(hopPhase * Math.PI) * peak,
      alpha: hopIndex === skip.skips - 1 && hopPhase > 0.78 ? 1 - (hopPhase - 0.78) / 0.22 : 1,
    };
  }

  const ripples: PebbleRipple[] = [];
  const droplets: PebbleDroplet[] = [];
  for (let i = 1; i <= skip.skips; i += 1) {
    const age = elapsed - i * hopTicks;
    if (age < 0) continue;
    const ix = skip.launch.x + skip.dx * (i * hopSpacing);
    const iy = skip.launch.y + skip.dy * (i * hopSpacing);
    if (age < 22) {
      const u = age / 22;
      ripples.push({
        x: ix, y: iy, radius: 5 + u * (i === skip.skips ? 24 : 18), alpha: 0.65 * (1 - u),
      });
    }
    if (age < 10) {
      const du = age / 10;
      const lift = Math.sin(du * Math.PI) * 11;
      droplets.push(
        { x: ix - 5 - du * 6, y: iy - lift, alpha: 0.75 * (1 - du) },
        { x: ix + 5 + du * 6, y: iy - lift * 0.85, alpha: 0.7 * (1 - du) },
      );
    }
  }
  return { active: true, stone, ripples, droplets };
}

// --- 3. Cozy Shop Door Bells ---

const SHOP_BELL_AREAS: ReadonlySet<string> = new Set(["cafe", "market", "parlor", "lodge"]);

export function shopBellForAreaEntry(
  prevArea: string | null, nextArea: string,
): CompanionAudioEffect | null {
  if (prevArea === null || prevArea === nextArea) return null;
  if (nextArea === "arcade") return "arcade-bell";
  return SHOP_BELL_AREAS.has(nextArea) ? "shop-bell" : null;
}

// --- 4. Scenic Camera-Pullback Benches with Warm Party Chatter ---

export type ScenicRestConfig = {
  zoom: number;
  lines: Readonly<Record<"sue" | "jordan" | "maddie", string>>;
};

const scenic = (sue: string, jordan: string, maddie: string): ScenicRestConfig => ({
  zoom: 0.91, lines: { sue, jordan, maddie },
});

export const SCENIC_REST_SPOTS: Readonly<Record<string, ScenicRestConfig>> = {
  "bay-bench": scenic(
    "Smell that salt breeze? Best view in Bubblegum Bay.",
    "Bet I could skip a shell past that whole pier!",
    "Purr... warm sunny sand and salty air.",
  ),
  "park-bench": scenic(
    "Even the pond ripples look painted from right here.",
    "Good spot to catch our breath under the big tree.",
    "Mrrp... clover breeze feels extra soft today.",
  ),
  "trail-stream-overlook": scenic(
    "Listen to that stream rushing down toward the coast.",
    "Mountain air and sea breeze meeting right here!",
    "Purr... butterflies love this shady overlook.",
  ),
  "summit-bench": scenic(
    "You can almost see all of Cloverhollow from up here!",
    "Crisp pine air! Glad we stopped to take it in.",
    "Mrrp... snowy peaks sparkle like sugar.",
  ),
  "island-mat": scenic(
    "The lighthouse waves look so calm from this cove.",
    "Feels like our own quiet starlight hideout.",
    "Purr... gentle tide, warm shells, cozy paws.",
  ),
  "sanctuary-blanket": scenic(
    "Look how happy all the calm critters are out here.",
    "Ranger Fern really made the best meadow in the valley.",
    "Purr... everyone is safe and sleepy in the clover.",
  ),
};

export const SCENIC_ZOOM_START_TICK = 18;
export const SCENIC_ZOOM_FULL_TICK = 48;
export const SCENIC_CHATTER_START_TICK = 36;
export const SCENIC_CHATTER_END_TICK = 240;

export function scenicBenchZoom(
  spotId: string | null, elapsedTicks: number, reducedMotion: boolean,
): number {
  if (reducedMotion || spotId === null || elapsedTicks < SCENIC_ZOOM_START_TICK) return 1;
  const config = SCENIC_REST_SPOTS[spotId];
  if (config === undefined) return 1;
  const t = Math.min(
    1, (elapsedTicks - SCENIC_ZOOM_START_TICK) / (SCENIC_ZOOM_FULL_TICK - SCENIC_ZOOM_START_TICK),
  );
  return 1 - (1 - config.zoom) * (t * t * (3 - 2 * t));
}

export type ScenicBenchChatter = {
  npcId: string; speakerName: string; text: string; tone: "warm";
};

const SCENIC_SPEAKERS: readonly ("sue" | "jordan" | "maddie")[] = ["sue", "jordan", "maddie"];
const SCENIC_NAMES: Readonly<Record<"sue" | "jordan" | "maddie", string>> = {
  sue: "Sue", jordan: "Jordan", maddie: "Maddie",
};

export function scenicBenchChatter(
  spotId: string | null, elapsedTicks: number, partyIds: readonly string[], area: string,
): ScenicBenchChatter | null {
  if (
    spotId === null || elapsedTicks < SCENIC_CHATTER_START_TICK ||
    elapsedTicks > SCENIC_CHATTER_END_TICK
  ) return null;
  const config = SCENIC_REST_SPOTS[spotId];
  if (config === undefined) return null;
  const eligible = SCENIC_SPEAKERS.filter((id) => partyIds.includes(id));
  const speaker = eligible[area.length % Math.max(1, eligible.length)];
  if (speaker === undefined) return null;
  return { npcId: speaker, speakerName: SCENIC_NAMES[speaker], text: config.lines[speaker],
    tone: "warm" };
}

// --- 5. Unique Sanctuary Calm Critter Pet Hops (All 17 Species) ---

export type SanctuaryHopStyle =
  | "spring-leap" | "excited-bounce" | "wing-flutter" | "belly-waddle" | "double-hop"
  | "purr-stretch" | "roll-pop" | "twirl-hop" | "peek-hop" | "pinch-dance";

export const SANCTUARY_HOP_DURATION = 36;

export const SANCTUARY_HOP_STYLES: Readonly<Record<string, SanctuaryHopStyle>> = {
  "sanctuary-frog": "spring-leap", "sanctuary-pup": "excited-bounce",
  "sanctuary-bluebird": "wing-flutter", "sanctuary-gull": "wing-flutter",
  "sanctuary-owl": "wing-flutter", "sanctuary-moon-owl": "wing-flutter",
  "sanctuary-bat": "wing-flutter", "sanctuary-penguin": "belly-waddle",
  "sanctuary-lamb": "double-hop", "sanctuary-bunny": "double-hop",
  "sanctuary-cat": "purr-stretch", "sanctuary-hamster": "roll-pop",
  "sanctuary-hedgehog": "roll-pop", "sanctuary-squirrel": "twirl-hop",
  "sanctuary-raccoon": "twirl-hop", "sanctuary-crystal-mole": "peek-hop",
  "sanctuary-crab": "pinch-dance",
};

const pose = (
  offsetX: number, offsetY: number, scaleX: number, scaleY: number, rotation: number,
): MotionPose => ({ offsetX, offsetY, scaleX, scaleY, rotation });

export function sanctuaryCritterHopPose(
  npcId: string, elapsedTicks: number, reducedMotion: boolean,
): MotionPose {
  if (reducedMotion || elapsedTicks < 0 || elapsedTicks >= SANCTUARY_HOP_DURATION) {
    return NEUTRAL_POSE;
  }
  const style = SANCTUARY_HOP_STYLES[npcId];
  if (style === undefined) return NEUTRAL_POSE;
  const u = elapsedTicks / SANCTUARY_HOP_DURATION;
  const arc = Math.sin(u * Math.PI);
  const sin2 = Math.sin(u * Math.PI * 2);
  const sin3 = Math.sin(u * Math.PI * 3);
  const sin4 = Math.sin(u * Math.PI * 4);
  const dbl = Math.abs(sin2);
  const fade = 1 - u * 0.25;

  switch (style) {
    case "spring-leap":
      return pose(
        0, -19 * arc, 1 - 0.12 * arc + (u < 0.14 ? 0.14 : 0),
        1 + 0.16 * arc - (u < 0.14 ? 0.12 : 0), 0.04 * sin2,
      );
    case "excited-bounce":
      return pose(sin4 * 2.4 * fade, -12 * dbl * fade, 1 - 0.06 * dbl, 1 + 0.09 * dbl,
        0.11 * sin4 * fade);
    case "wing-flutter": {
      const flap = Math.sin(u * Math.PI * 6);
      return pose(sin2 * 3.5 * arc, -14 * arc - Math.abs(flap) * 3.5 * arc,
        1 + 0.07 * flap * arc, 1 - 0.04 * flap * arc, 0.08 * sin3 * arc);
    }
    case "belly-waddle":
      return pose(sin3 * 5.2 * fade, -5.5 * Math.abs(sin3), 1 + 0.06 * arc, 1 - 0.05 * arc,
        0.16 * sin3 * fade);
    case "double-hop":
      return pose(0, -14 * dbl * (u < 0.5 ? 1 : 0.8), 1 - 0.07 * dbl, 1 + 0.11 * dbl, 0.05 * sin2);
    case "purr-stretch":
      return pose(0, -8 * arc, 1 + 0.1 * sin2 * fade, 1 + 0.09 * arc, 0.06 * sin2);
    case "roll-pop": {
      const c4 = Math.cos(u * Math.PI * 4);
      return pose(sin2 * 4 * arc, -11 * arc, 1 + 0.08 * c4 * arc, 1 - 0.08 * c4 * arc,
        0.24 * sin2 * arc);
    }
    case "twirl-hop":
      return pose(sin2 * 3 * arc, -13 * arc, 1 - 0.18 * dbl * arc, 1 + 0.09 * arc,
        0.14 * sin2 * arc);
    case "peek-hop": {
      const lift = u < 0.25
        ? 4 * Math.sin((u / 0.25) * Math.PI)
        : -13 * Math.sin(((u - 0.25) / 0.75) * Math.PI);
      return pose(0, lift, u < 0.25 ? 1.12 : 1 - 0.06 * arc, u < 0.25 ? 0.86 : 1 + 0.12 * arc,
        0.05 * sin3 * arc);
    }
    case "pinch-dance":
      return pose(sin4 * 7.5 * fade, -6 * Math.abs(sin4), 1 + 0.07 * Math.abs(sin4),
        1 - 0.05 * Math.abs(sin4), 0.12 * sin4 * fade);
  }
}

export function findSanctuaryCritterByKnot(world: World, state: State, knot: string): Npc | null {
  if (state.area !== "sanctuary") return null;
  const area = world.areas.sanctuary;
  if (area === undefined) return null;
  for (const npc of area.npcs) {
    if (
      npc.knot === knot &&
      SANCTUARY_HOP_STYLES[npc.id] !== undefined &&
      npcVisible(world, state, npc)
    ) return npc;
  }
  return null;
}

export function findNearbySanctuaryCritter(world: World, state: State, radius = 84): Npc | null {
  if (state.area !== "sanctuary" || !isOverworldActionOpen(state)) return null;
  if (targetInteractable(world, state) !== undefined) return null;
  const area = world.areas.sanctuary;
  if (area === undefined) return null;
  let best: Npc | null = null;
  let bestDist = Infinity;
  for (const npc of area.npcs) {
    if (SANCTUARY_HOP_STYLES[npc.id] === undefined || !npcVisible(world, state, npc)) continue;
    const dist = Math.hypot(state.player.x - npc.point.x, state.player.y - npc.point.y);
    if (dist <= radius && dist < bestDist) { best = npc; bestDist = dist; }
  }
  return best;
}

export function scenicBenchChatterBubble(
  spotId: string | null,
  elapsedTicks: number,
  state: Pick<State, "party" | "player" | "area">,
): NpcChatterBubble | null {
  const bench = scenicBenchChatter(
    spotId, elapsedTicks, state.party.map((member) => member.id), state.area,
  );
  if (bench === null) return null;
  const anchor = state.party.find((item) => item.id === bench.npcId) ?? state.player;
  const fadeIn = Math.min(1, (elapsedTicks - 36) / 14);
  const fadeOut = Math.min(1, (240 - elapsedTicks) / 18);
  const alpha = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));
  const progress = Math.max(0, Math.min(1, (elapsedTicks - 36) / 204));
  return { ...bench, x: anchor.x, y: anchor.y, alpha, adult: false, emote: "heart", progress };
}
