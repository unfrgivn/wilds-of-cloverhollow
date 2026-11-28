import { describe, expect, it } from "vitest";
import {
  blankInput,
  createState,
  distance,
  distanceToPolygon,
  inkFacts,
  nextRandom,
  npcVisible,
  pointInPolygon,
  propCovers,
  propState,
  rollWild,
  sceneryArea,
  setInkVariables,
  step,
  type ActionFrame,
  type Area,
  type State,
  type World,
} from "../../src/core";
import { critterErrors, loadContent } from "../../src/content/load";
import { areaConnectionErrors } from "../../src/content/area-checks";

// Contract for recurring critters (Milestone 28), EarthBound style. Critters
// are species placed many times: every time Fae arrives in an area, its dens
// roll their chaos critters fresh from the seeded PRNG in the state. One she
// calms stays calm only until she leaves. Every calm pays its coins; each
// species gives its sticker once. Story set pieces (the fountain frog, the
// school raccoon, the grumpy gull) are unique and never respawn.

const content = loadContent();
const world = content.world;
const press = (frame: Partial<ActionFrame>): ActionFrame => ({ ...blankInput(), ...frame });

function areaFor(id: string): Area {
  const area = world.areas[id];
  if (area === undefined) throw new Error(`area ${id} missing`);
  return area;
}

// The state a step later, after a door into `area` at `spawn` has faded out.
function arrive(state: State, area: string, spawn: string): State {
  const fading: State = { ...state, transition: { target: { area, spawn }, phase: "out",
    elapsed: world.tunables.doorFadeTicks - 1 } };
  return step(world, fading, blankInput()).state;
}

describe("the arrival roll", () => {
  const park = areaFor("park");

  it("draws twice per den, in den order, whatever comes out", () => {
    const base = createState(world, { area: "park", spawn: "plaza-path", seed: 5 });
    const dens = park.recurring?.dens.length ?? 0;
    expect(dens).toBe(2);
    for (const rng of [1, 77, 4242, 99999, 3141592653]) {
      const rolled = rollWild(world, { ...base, rng }, park);
      let expected = { ...base, rng };
      for (let draw = 0; draw < dens * 2; draw += 1) expected = nextRandom(expected)[1];
      expect(rolled.rng, `rng ${rng}`).toBe(expected.rng);
    }
  });

  it("is the same roll for the same PRNG state (replays stay exact)", () => {
    const base = createState(world, { area: "park", spawn: "plaza-path", seed: 5 });
    expect(rollWild(world, base, park)).toEqual(rollWild(world, base, park));
  });

  it("takes each den's kinds and chance and spreads spawns across walkable spots", () => {
    const base = createState(world, { area: "park", spawn: "plaza-path", seed: 5 });
    const outs = new Map<string, number>();
    const radius = world.tunables.follow.radius;
    const scenery = sceneryArea(world, base.ink, park);
    const visibleNpcs = park.npcs.filter((npc) => npcVisible(world, base, npc));
    const solids = [...scenery.blockers, ...visibleNpcs.map((npc) => npc.footprint)];
    const occluding = park.props
      .filter((prop) => !prop.canopy)
      .map((prop) => propState(world, base.ink, prop))
      .filter((ps) => !ps.flat && !ps.hidden && ps.silhouette.columns.length > 0);
    const pupSpots: { x: number; y: number }[] = [];
    let movedFromDen = 0;
    for (let rng = 1; rng <= 400; rng += 1) {
      const { wild } = rollWild(world, { ...base, rng: Math.imul(rng, 2654435761) >>> 0 }, park);
      const pup = wild.find((critter) => critter.den === 0);
      expect(pup?.kind).toBe("pup");
      if (pup !== undefined) pupSpots.push({ x: pup.x, y: pup.y });
      for (const critter of wild.filter((item) => item.den === 1))
        outs.set(critter.kind, (outs.get(critter.kind) ?? 0) + 1);
      for (const critter of wild) {
        const den = park.recurring?.dens[critter.den];
        expect(den?.kinds).toContain(critter.kind);
        expect(critter.mood).toBe("chaos");
        expect(critter.home).toEqual({ x: critter.x, y: critter.y });
        expect(pointInPolygon(critter, park.walkable)).toBe(true);
        expect(distanceToPolygon(critter, park.walkable)).toBeGreaterThanOrEqual(radius);
        for (const poly of solids) {
          expect(pointInPolygon(critter, poly)).toBe(false);
          expect(distanceToPolygon(critter, poly)).toBeGreaterThanOrEqual(radius);
        }
        const touch = Math.max(
          ...(den?.kinds.map((id) => world.critters[id]?.touchRadius ?? 70) ?? [70]),
        );
        expect(distance(base.player, critter)).toBeGreaterThan(world.tunables.roam.sight + touch);
        if (den !== undefined && distance(critter, den.point) > 25) {
          movedFromDen += 1;
          for (const trigger of park.triggers) {
            expect(pointInPolygon(critter, trigger.polygon)).toBe(false);
            expect(distanceToPolygon(critter, trigger.polygon)).toBeGreaterThan(touch + 60);
          }
          const covered = occluding.reduce(
            (sum, ps) => sum + propCovers(ps, critter, { width: 50, height: 70 }),
            0,
          );
          expect(covered).toBeLessThanOrEqual(0.5);
        }
      }
      if (wild.length >= 2) {
        const first = wild[0];
        const second = wild[1];
        const secondDen = second === undefined ? undefined : park.recurring?.dens[second.den];
        if (
          first !== undefined &&
          second !== undefined &&
          secondDen !== undefined &&
          distance(second, secondDen.point) > 1
        ) {
          expect(distance(first, second)).toBeGreaterThanOrEqual(220);
        }
      }
    }
    // Den 1 (cats and raccoons, chance 0.6) is out about 60% of the time.
    const total = (outs.get("cat") ?? 0) + (outs.get("raccoon") ?? 0);
    expect(total).toBeGreaterThan(400 * 0.45);
    expect(total).toBeLessThan(400 * 0.75);
    expect(outs.get("cat")).toBeGreaterThan(40);
    expect(outs.get("raccoon")).toBeGreaterThan(40);
    // Repeated arrivals spread critters widely across the area rather than pinning them to dens.
    expect(movedFromDen).toBeGreaterThan(350);
    const xs = pupSpots.map((spot) => spot.x);
    const ys = pupSpots.map((spot) => spot.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(400);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(200);
  });

  it("respects closed crossings in Crystal Cavern until cavern_bridge_lit opens them", () => {
    const cavern = areaFor("cavern");
    const closedBase = createState(world, { area: "cavern", spawn: "entrance", seed: 1 });
    const onWestBank = (point: { x: number; y: number }): boolean =>
      point.x < (point.y <= 590 ? 850 : 850 + (point.y - 590) * 0.85);
    const batWestXs: number[] = [];
    const moleEastXs: number[] = [];
    for (let seed = 1; seed <= 80; seed += 1) {
      const rng = Math.imul(seed, 2654435761) >>> 0;
      const { wild } = rollWild(world, { ...closedBase, rng }, cavern);
      const bat = wild.find((critter) => critter.kind === "bat");
      const mole = wild.find((critter) => critter.kind === "crystal-mole");
      expect(bat).toBeDefined();
      expect(mole).toBeDefined();
      if (bat !== undefined) {
        expect(onWestBank(bat), `closed bat seed ${seed} (${bat.x}, ${bat.y})`).toBe(true);
        batWestXs.push(bat.x);
      }
      if (mole !== undefined) {
        expect(onWestBank(mole), `closed mole seed ${seed} (${mole.x}, ${mole.y})`).toBe(false);
        moleEastXs.push(mole.x);
      }
    }
    expect(Math.max(...batWestXs) - Math.min(...batWestXs)).toBeGreaterThan(150);
    expect(Math.max(...moleEastXs) - Math.min(...moleEastXs)).toBeGreaterThan(150);

    const openBase: State = {
      ...closedBase,
      ink: setInkVariables(closedBase.ink, { cavern_bridge_lit: true }),
    };
    let batCrossedEast = false;
    let moleCrossedWest = false;
    for (let seed = 1; seed <= 80; seed += 1) {
      const rng = Math.imul(seed, 2654435761) >>> 0;
      const { wild } = rollWild(world, { ...openBase, rng }, cavern);
      const bat = wild.find((critter) => critter.kind === "bat");
      const mole = wild.find((critter) => critter.kind === "crystal-mole");
      if (bat !== undefined && !onWestBank(bat)) batCrossedEast = true;
      if (mole !== undefined && onWestBank(mole)) moleCrossedWest = true;
    }
    expect(batCrossedEast).toBe(true);
    expect(moleCrossedWest).toBe(true);
  });

  it("never spawns critters in unreachable pockets across all 8 recurring areas", () => {
    const recurringIds = Object.values(world.areas)
      .filter((area) => area.recurring !== undefined)
      .map((area) => area.id)
      .sort();
    expect(recurringIds).toEqual([
      "bay",
      "cavern",
      "hills",
      "park",
      "pass",
      "plaza",
      "trail",
      "woods",
    ]);
    const playerRadius = world.tunables.playerRadius;
    const gridStep = 15;
    let totalSpawns = 0;
    let totalFallbacks = 0;

    for (const areaId of recurringIds) {
      const area = areaFor(areaId);
      const spawnName = Object.keys(area.spawns)[0];
      if (spawnName === undefined) throw new Error(`${areaId} has no spawns`);
      const raw = createState(world, { area: areaId, spawn: spawnName, seed: 1 });
      const base: State = {
        ...raw,
        critters: {
          ...raw.critters,
          "fountain-frog": "calm",
          lifeguard: "calm",
          "lodge-keeper": "calm",
        },
      };
      const scenery = sceneryArea(world, base.ink, area);
      const visibleNpcs = area.npcs.filter((npc) => npcVisible(world, base, npc));
      const solids = [...scenery.blockers, ...visibleNpcs.map((npc) => npc.footprint)];
      const passable = (pt: { x: number; y: number }): boolean =>
        pointInPolygon(pt, area.walkable) &&
        distanceToPolygon(pt, area.walkable) >= playerRadius &&
        solids.every(
          (poly) => !pointInPolygon(pt, poly) && distanceToPolygon(pt, poly) >= playerRadius,
        );

      // Independent 15-unit BFS from each den to verify Fae can actually reach every spawn.
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const [vx, vy] of area.walkable) {
        if (vx < minX) minX = vx;
        if (vx > maxX) maxX = vx;
        if (vy < minY) minY = vy;
        if (vy > maxY) maxY = vy;
      }
      const minGx = Math.floor(minX / gridStep);
      const maxGx = Math.ceil(maxX / gridStep);
      const minGy = Math.floor(minY / gridStep);
      const maxGy = Math.ceil(maxY / gridStep);
      const cols = maxGx - minGx + 1;
      const rows = maxGy - minGy + 1;
      const passCache = new Int8Array(cols * rows);
      const cellOk = (gx: number, gy: number): boolean => {
        if (gx < minGx || gx > maxGx || gy < minGy || gy > maxGy) return false;
        const idx = (gy - minGy) * cols + (gx - minGx);
        if (passCache[idx] !== 0) return passCache[idx] === 1;
        const ok = passable({ x: gx * gridStep, y: gy * gridStep });
        passCache[idx] = ok ? 1 : -1;
        return ok;
      };
      const denComponents = (area.recurring?.dens ?? []).map((den) => {
        const sGx = Math.round(den.point.x / gridStep);
        const sGy = Math.round(den.point.y / gridStep);
        const visited = new Uint8Array(cols * rows);
        let seedIdx = -1;
        for (let ring = 0; ring <= 2 && seedIdx < 0; ring += 1) {
          for (let dy = -ring; dy <= ring && seedIdx < 0; dy += 1) {
            for (let dx = -ring; dx <= ring && seedIdx < 0; dx += 1) {
              if (cellOk(sGx + dx, sGy + dy)) {
                seedIdx = (sGy + dy - minGy) * cols + (sGx + dx - minGx);
              }
            }
          }
        }
        if (seedIdx >= 0) {
          visited[seedIdx] = 1;
          const queue = [seedIdx];
          let head = 0;
          while (head < queue.length) {
            const idx = queue[head] ?? 0;
            head += 1;
            const gx = minGx + (idx % cols);
            const gy = minGy + Math.floor(idx / cols);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
              if (!cellOk(gx + dx, gy + dy)) continue;
              const nIdx = (gy + dy - minGy) * cols + (gx + dx - minGx);
              if (visited[nIdx] === 1) continue;
              visited[nIdx] = 1;
              queue.push(nIdx);
            }
          }
        }
        return visited;
      });

      for (let seed = 1; seed <= 50; seed += 1) {
        const rng = Math.imul(seed, 2654435761) >>> 0;
        const { wild } = rollWild(world, { ...base, rng }, area);
        for (const critter of wild) {
          totalSpawns += 1;
          const den = area.recurring?.dens[critter.den];
          const comp = denComponents[critter.den];
          if (den === undefined || comp === undefined) throw new Error("missing den");
          if (distance(critter, den.point) < 1e-6) {
            totalFallbacks += 1;
            continue;
          }
          expect(passable(critter), `${areaId} seed ${seed} den ${critter.den} passable`).toBe(
            true,
          );
          const gx = Math.round(critter.x / gridStep);
          const gy = Math.round(critter.y / gridStep);
          let reached = false;
          for (let dy = -1; dy <= 1 && !reached; dy += 1) {
            for (let dx = -1; dx <= 1 && !reached; dx += 1) {
              const nx = gx + dx;
              const ny = gy + dy;
              if (nx < minGx || nx > maxGx || ny < minGy || ny > maxGy) continue;
              if (comp[(ny - minGy) * cols + (nx - minGx)] === 1) reached = true;
            }
          }
          expect(
            reached,
            `${areaId} seed ${seed} den ${critter.den} (${critter.x}, ${critter.y}) unreachable`,
          ).toBe(true);
        }
      }
    }
    expect(totalSpawns).toBeGreaterThan(500);
    expect(totalFallbacks / totalSpawns).toBeLessThan(0.05);
  });

  it("keeps the plaza quiet, drawing nothing, until the fountain frog is calm", () => {
    const plaza = areaFor("plaza");
    const quiet = createState(world, { area: "plaza", spawn: "fountain", seed: 3 });
    expect(rollWild(world, quiet, plaza)).toEqual({ wild: [], rng: quiet.rng });
    const calm: State = { ...quiet, critters: { ...quiet.critters, "fountain-frog": "calm" } };
    const rolled = rollWild(world, calm, plaza);
    expect(rolled.rng).not.toBe(quiet.rng);
    for (const critter of rolled.wild) expect(["raccoon", "pup", "cat"]).toContain(critter.kind);
  });

  it("happens on every arrival: through a door, and back again", () => {
    let state = createState(world, { area: "park", spawn: "plaza-path", seed: 9 });
    const before = state.rng;
    state = arrive(state, "plaza", "park-path");
    expect(state.wild, "the plaza is quiet until its frog is calm").toEqual([]);
    expect(state.rng, "and draws nothing").toBe(before);
    state = arrive(state, "park", "plaza-path");
    expect(state.rng).not.toBe(before);
    expect(state.wild.map((critter) => critter.kind)).toContain("pup");
    expect(state.wild.every((critter) => critter.mood === "chaos")).toBe(true);
  });
});

describe("a calmed recurring critter", () => {
  // Fae in the park, the pond's pup out, calm.
  function calmPark(): State {
    const start = createState(world, { area: "park", spawn: "plaza-path", seed: 1 });
    return { ...start, wild: start.wild.map((critter) =>
      critter.den === 0 ? { ...critter, mood: "calm" } : critter) };
  }

  it("stays calm while Fae stays, and never battles", () => {
    let state = calmPark();
    const pup = state.wild.find((critter) => critter.den === 0);
    if (pup === undefined) throw new Error("no pup");
    state = { ...state, player: { x: pup.x - 90, y: pup.y }, facing: "right" };
    for (let tick = 0; tick < 60; tick += 1)
      state = step(world, state, press({ move: { x: 1, y: 0 } })).state;
    expect(state.battle).toBeNull();
    expect(state.wild.find((critter) => critter.den === 0)?.mood).toBe("calm");
  });

  it("is gone when Fae leaves: the next arrival rolls it fresh, in chaos", () => {
    const state = arrive(calmPark(), "park", "plaza-path");
    expect(state.wild.find((critter) => critter.den === 0)).toMatchObject({
      kind: "pup", mood: "chaos" });
  });

  it("is rolled fresh after a rest in the same area too (a rest is an arrival)", () => {
    const start = calmPark();
    const rested: State = { ...start, transition: { target: start.safeSpot, phase: "out",
      elapsed: world.tunables.doorFadeTicks - 1 } };
    const after = step(world, rested, blankInput()).state;
    expect(after.area).toBe("park");
    expect(after.wild.find((critter) => critter.den === 0)?.mood).toBe("chaos");
  });
});

describe("what the story asks", () => {
  it("answers calmed(species) from the stickers, and a set piece from its own mood", () => {
    const fresh = createState(world, { area: "bay", spawn: "plaza-road", seed: 1 });
    // A bay frog calmed: the frogs' sticker (the fountain frog's), but the
    // fountain frog himself is still fizzy.
    const facts = inkFacts(world, { ...fresh, stickers: ["fountain-frog"] }).calmed;
    expect(facts).toMatchObject({ frog: true, "fountain-frog": false });
    expect(facts["pup"]).toBeUndefined();
    const calm = inkFacts(world, { ...fresh,
      critters: { ...fresh.critters, "fountain-frog": "calm" } }).calmed;
    expect(calm["fountain-frog"]).toBe(true);
  });
});

describe("content checks", () => {
  const { critters, stickers, areas } = world;

  it("pass for the shipped content", () => {
    expect(critterErrors(areas, critters, stickers)).toEqual([]);
  });

  it("refuse a den of story set pieces, a set piece placed twice, and an unknown `after`", () => {
    const plaza = areaFor("plaza");
    const broken: World["areas"] = {
      ...areas,
      plaza: { ...plaza, recurring: { after: "dragon", dens: [{ point: { x: 800, y: 395 },
        radius: 90, kinds: ["fountain-frog"], chance: 1 }] } },
      park: { ...areaFor("park"), critters: [{ id: "gull", point: { x: 880, y: 600 } }] },
    };
    expect(critterErrors(broken, critters, stickers)).toEqual([
      "trail: set piece gull is in park too",
      "plaza: recurring.after dragon is neither a set piece nor a species",
      "plaza: den 0 lists fountain-frog, which isn't a recurring kind",
    ]);
  });

  it("refuse two stickers for one species", () => {
    const frog = critters["frog"];
    if (frog === undefined) throw new Error("no frog");
    const odd = { ...critters, frog: { ...frog, sticker: { ...frog.sticker, id: "bay-frog" } } };
    expect(critterErrors(areas, odd, stickers)).toEqual(expect.arrayContaining([
      "critter frog: species frog has two stickers, fountain-frog and bay-frog",
      "critter frog: sticker bay-frog isn't in the album",
    ]));
  });

  it("refuse a den where Fae would arrive in its critters' sight", () => {
    const park = areaFor("park");
    const spawn = park.spawns["plaza-path"];
    if (spawn === undefined) throw new Error("no spawn");
    const near: Area = { ...park, recurring: { dens: [{
      point: { x: spawn.x + 120, y: spawn.y - 100 }, radius: 60, kinds: ["pup"], chance: 1 }] } };
    expect(areaConnectionErrors({ park: near }, world.tunables, critters, world.party))
      .toContain("park: den 0 is within 250 of spawn plaza-path");
  });

  it("refuse a den mostly behind scenery, where its critters can't be seen", () => {
    // Behind the park's play tower, where a den once was.
    const park = areaFor("park");
    const hidden: Area = { ...park, recurring: { dens: [{
      point: { x: 1150, y: 380 }, radius: 80, kinds: ["cat"], chance: 1 }] } };
    expect(areaConnectionErrors({ park: hidden }, world.tunables, critters, world.party))
      .toContain("park: den 0 is mostly behind scenery");
  });
});
