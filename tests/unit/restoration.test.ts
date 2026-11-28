import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import {
  createState,
  distanceToPolygon,
  pointInPolygon,
  surfaceAt,
  type State,
} from "../../src/core";
import {
  advanceRestorationPulse,
  evaluateAreaRestoration,
  evaluateRestorationFrame,
  isRestorationZoneId,
  RESTORATION_PETAL_COUNT,
  RESTORATION_PULSE_TICKS,
  RESTORATION_ZONE_IDS,
  RESTORATION_ZONES,
  restorationMaxRadius,
  type RestorationPulseState,
} from "../../src/render/restoration-math";

const { world, fixtures } = loadContent();

function stateWith(
  area: string,
  options?: {
    variables?: Record<string, boolean>;
    critters?: Record<string, "chaos" | "calm">;
    calms?: Record<string, number>;
    stickers?: string[];
  },
): State {
  const matchedFixture = fixtures[area];
  const fallbackSpawn = Object.keys(world.areas[area]!.spawns)[0]!;
  const base = createState(world, {
    ...(matchedFixture ?? fixtures["new-game"]!),
    area,
    spawn: matchedFixture !== undefined ? matchedFixture.spawn : fallbackSpawn,
    variables: { ...(matchedFixture?.variables ?? {}), ...(options?.variables ?? {}) },
    calms: { ...(matchedFixture?.calms ?? {}), ...(options?.calms ?? {}) },
  });
  return {
    ...base,
    critters: { ...base.critters, ...(options?.critters ?? {}) },
    stickers: options?.stickers ?? base.stickers,
  };
}

describe("Live Watercolor Chaos-to-Paint Area Restoration (E13)", () => {
  it("maps all 9 signature zones from chaotic to restored using existing core facts", () => {
    expect(RESTORATION_ZONE_IDS).toEqual([
      "plaza",
      "park",
      "bay",
      "pass",
      "woods",
      "school",
      "hills",
      "cavern",
      "enchanted",
    ]);

    // 1. Plaza: fountain-frog
    expect(evaluateAreaRestoration(world, stateWith("plaza"))?.restored).toBe(false);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("plaza", { critters: { "fountain-frog": "calm" } }),
      )?.restored,
    ).toBe(true);

    // 2. Park: Zoomie Pup
    expect(evaluateAreaRestoration(world, stateWith("park"))?.restored).toBe(false);
    expect(
      evaluateAreaRestoration(world, stateWith("park", { calms: { pup: 1 } }))?.restored,
    ).toBe(true);

    // 3. Bay: Bluebird + Lifeguard flare-up
    expect(evaluateAreaRestoration(world, stateWith("bay"))?.restored).toBe(false);
    expect(
      evaluateAreaRestoration(world, stateWith("bay", { calms: { bluebird: 1 } }))?.restored,
    ).toBe(true);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("bay", {
          calms: { bluebird: 1 },
          variables: { lifeguard_back: true },
        }),
      )?.restored,
    ).toBe(false);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("bay", {
          calms: { bluebird: 1 },
          variables: { lifeguard_back: true },
          critters: { lifeguard: "calm" },
        }),
      )?.restored,
    ).toBe(true);

    // 4. Pass: Hiker Hamster + Lodge Keeper flare-up
    expect(evaluateAreaRestoration(world, stateWith("pass"))?.restored).toBe(false);
    expect(
      evaluateAreaRestoration(world, stateWith("pass", { calms: { hamster: 1 } }))?.restored,
    ).toBe(true);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("pass", {
          calms: { hamster: 1 },
          variables: { keeper_back: true },
        }),
      )?.restored,
    ).toBe(false);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("pass", {
          calms: { hamster: 1 },
          variables: { keeper_back: true },
          critters: { "lodge-keeper": "calm" },
        }),
      )?.restored,
    ).toBe(true);

    // 5. Woods: Whispering Owl / clubhouse + Moon Owl flare-up
    expect(evaluateAreaRestoration(world, stateWith("woods"))?.restored).toBe(false);
    expect(
      evaluateAreaRestoration(world, stateWith("woods", { calms: { owl: 1 } }))?.restored,
    ).toBe(true);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("woods", {
          variables: { clubhouse_claimed: true, moon_owl_out: true },
        }),
      )?.restored,
    ).toBe(false);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("woods", {
          variables: { clubhouse_claimed: true, moon_owl_out: true },
          critters: { "moon-owl": "calm" },
        }),
      )?.restored,
    ).toBe(true);

    // 6. School: Principal Mr. Bell
    expect(evaluateAreaRestoration(world, stateWith("school"))?.restored).toBe(false);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("school", { critters: { principal: "calm" } }),
      )?.restored,
    ).toBe(true);

    // 7. Hills: Clover Lamb / Hedgehog + Chef Mateo flare-up
    expect(evaluateAreaRestoration(world, stateWith("hills"))?.restored).toBe(false);
    expect(
      evaluateAreaRestoration(world, stateWith("hills", { calms: { lamb: 1 } }))?.restored,
    ).toBe(true);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("hills", {
          calms: { lamb: 1 },
          variables: { taco_chef_out: true },
        }),
      )?.restored,
    ).toBe(false);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("hills", {
          calms: { lamb: 1 },
          variables: { taco_chef_out: true },
          critters: { "taco-chef": "calm" },
        }),
      )?.restored,
    ).toBe(true);

    // 8. Cavern: Bat + Crystal Mole OR Star Chime rung
    expect(evaluateAreaRestoration(world, stateWith("cavern"))?.restored).toBe(false);
    expect(
      evaluateAreaRestoration(world, stateWith("cavern", { calms: { bat: 1 } }))?.restored,
    ).toBe(false);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("cavern", { calms: { bat: 1, "crystal-mole": 1 } }),
      )?.restored,
    ).toBe(true);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("cavern", { variables: { cavern_chime_rung: true } }),
      )?.restored,
    ).toBe(true);

    // 9. Enchanted Forest: forest_fizzy === false or hooded-kid calm
    expect(evaluateAreaRestoration(world, stateWith("enchanted"))?.restored).toBe(false);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("enchanted", { critters: { "hooded-kid": "calm" } }),
      )?.restored,
    ).toBe(true);
    expect(
      evaluateAreaRestoration(
        world,
        stateWith("enchanted", { variables: { forest_fizzy: false } }),
      )?.restored,
    ).toBe(true);
  });

  it("leaves harness and non-restoration areas cleanly neutral", () => {
    for (const id of ["harness", "bedroom", "kitchen", "cafe", "sanctuary", "trail", "island"]) {
      expect(isRestorationZoneId(id)).toBe(false);
      expect(evaluateAreaRestoration(world, stateWith(id))).toBeNull();
    }
  });

  it("places every decal cleanly inside walkable geometry clear of obstacles and landmarks", () => {
    const seenIds = new Set<string>();
    for (const zoneId of RESTORATION_ZONE_IDS) {
      const spec = RESTORATION_ZONES[zoneId];
      const area = world.areas[zoneId]!;
      expect(area, `missing area ${zoneId}`).toBeDefined();
      expect(spec.decals.length).toBeGreaterThanOrEqual(5);

      const solids = [
        ...area.blockers,
        ...area.npcs.map((npc) => npc.footprint).filter((fp) => fp.length >= 3),
        ...area.props.flatMap((prop) => {
          const def = prop.states[prop.state];
          return def !== undefined && !def.hidden ? def.footprint : [];
        }),
      ];

      for (let i = 0; i < spec.decals.length; i += 1) {
        const decal = spec.decals[i]!;
        expect(seenIds.has(decal.id), `duplicate decal id ${decal.id}`).toBe(false);
        seenIds.add(decal.id);

        const pt = { x: decal.x, y: decal.y };
        expect(decal.x).toBeGreaterThan(80);
        expect(decal.x).toBeLessThan(area.width - 80);
        expect(decal.y).toBeGreaterThan(80);
        expect(decal.y).toBeLessThan(area.height - 60);
        expect(pointInPolygon(pt, area.walkable), `${decal.id} outside walkable`).toBe(true);
        expect(
          distanceToPolygon(pt, area.walkable),
          `${decal.id} too close to walkable edge`,
        ).toBeGreaterThanOrEqual(30);

        for (const poly of solids) {
          expect(pointInPolygon(pt, poly), `${decal.id} inside obstacle`).toBe(false);
          expect(
            distanceToPolygon(pt, poly),
            `${decal.id} overlaps obstacle margin`,
          ).toBeGreaterThanOrEqual(28);
        }

        // Verify decal never draws over any painted prop's visual silhouette.
        for (const prop of area.props) {
          const def = prop.states[prop.state];
          if (def === undefined || def.hidden) continue;
          const sil = def.silhouette;
          let clipsVisual = false;
          for (let c = 0; c < sil.columns.length && !clipsVisual; c += 1) {
            const colX = sil.left + c * sil.step;
            if (Math.abs(colX - decal.x) > 40 + sil.step) continue;
            for (const [top, bottom] of sil.columns[c] ?? []) {
              if (decal.y + 40 >= top && decal.y - 40 <= bottom) {
                clipsVisual = true;
                break;
              }
            }
          }
          expect(clipsVisual, `${decal.id} clips prop silhouette ${prop.id}`).toBe(false);
        }

        for (const npc of area.npcs) {
          const hitsNpcBody =
            Math.abs(decal.x - npc.point.x) < 70 &&
            decal.y > npc.point.y - 132 &&
            decal.y < npc.point.y + 48;
          expect(hitsNpcBody, `${decal.id} crowds NPC ${npc.id}`).toBe(false);
        }

        for (const trigger of area.triggers) {
          expect(
            pointInPolygon(pt, trigger.polygon),
            `${decal.id} inside door trigger`,
          ).toBe(false);
        }

        for (const other of [
          ...Object.values(area.spawns),
          ...area.npcs.map((n) => n.point),
          ...area.critters.map((c) => c.point),
        ]) {
          expect(
            Math.hypot(decal.x - other.x, decal.y - other.y),
            `${decal.id} too close to spawn/entity`,
          ).toBeGreaterThanOrEqual(50);
        }

        for (let j = i + 1; j < spec.decals.length; j += 1) {
          const other = spec.decals[j]!;
          expect(
            Math.hypot(decal.x - other.x, decal.y - other.y),
            `${decal.id} overlaps ${other.id}`,
          ).toBeGreaterThanOrEqual(120);
        }
      }
    }

    // Indoor school hallway uses sunlit dew/sunbeam flourishes rather than outdoor grass tufts.
    for (const decal of RESTORATION_ZONES.school.decals) {
      expect(decal.bloomFrame).toBe("bloom_sunbeam_dew");
      expect(decal.bloomBlend).toBe("add");
    }

    // Meadow Park decals all sit cleanly on open meadow grass (never picnic blanket or paths).
    const parkSurface = world.surfaces.park!;
    for (const decal of RESTORATION_ZONES.park.decals) {
      expect(surfaceAt(parkSurface, { x: decal.x, y: decal.y }), decal.id).toBe("grass");
    }
  });

  it("animates calmPulse 0 -> 1 over 90 frames with radial peel, ring, and petals", () => {
    const plazaStatus = evaluateAreaRestoration(
      world,
      stateWith("plaza", { critters: { "fountain-frog": "calm" } }),
    )!;
    expect(restorationMaxRadius(plazaStatus)).toBeGreaterThan(500);

    // 1. Arrive chaotic in live play.
    let pulse: RestorationPulseState | null = null;
    const arrive = advanceRestorationPulse(pulse, "plaza", false, 100, {
      instant: false,
      overworldVisible: true,
    });
    pulse = arrive.next;
    expect(arrive.calmPulse).toBe(0);
    expect(arrive.wiping).toBe(false);

    // 2. Enter battle while chaotic — holds state until overworld becomes visible again.
    const duringBattle = advanceRestorationPulse(pulse, "plaza", true, 160, {
      instant: false,
      overworldVisible: false,
    });
    pulse = duringBattle.next;
    expect(duringBattle.wiping).toBe(false);
    expect(pulse.wasRestored).toBe(false);

    // 3. Return to overworld calmed -> triggers 90-frame Watercolor Wash-Bloom Wipe!
    const start = advanceRestorationPulse(pulse, "plaza", true, 200, {
      instant: false,
      overworldVisible: true,
    });
    pulse = start.next;
    expect(start.calmPulse).toBe(0);
    expect(start.wiping).toBe(true);

    // 4. Mid-wipe at tick 225 (25/90 frames): near decals peel/unfurl ahead of far decals.
    const early = advanceRestorationPulse(pulse, "plaza", true, 225, {
      instant: false,
      overworldVisible: true,
    });
    pulse = early.next;
    expect(early.wiping).toBe(true);
    expect(early.calmPulse).toBeCloseTo(25 / RESTORATION_PULSE_TICKS, 5);

    const midFrame = evaluateRestorationFrame(
      plazaStatus,
      early.calmPulse,
      early.wiping,
      225,
      false,
    );
    expect(midFrame.ring.visible).toBe(true);
    expect(midFrame.ring.alpha).toBeGreaterThan(0.1);
    expect(midFrame.ring.radius).toBeGreaterThan(100);
    expect(midFrame.petals.length).toBeGreaterThan(0);
    expect(midFrame.petals.length).toBeLessThanOrEqual(RESTORATION_PETAL_COUNT);

    // Check radial ordering: closest decal to anchor peels earlier than farthest decal.
    const byDist = [...plazaStatus.decals].sort(
      (a, b) =>
        Math.hypot(a.x - plazaStatus.anchor.x, a.y - plazaStatus.anchor.y) -
        Math.hypot(b.x - plazaStatus.anchor.x, b.y - plazaStatus.anchor.y),
    );
    const earlyWaveFrame = evaluateRestorationFrame(plazaStatus, 0.12, true, 211, false);
    const nearest = earlyWaveFrame.decals.find((d) => d.id === byDist[0]!.id)!;
    const farthest = earlyWaveFrame.decals.find((d) => d.id === byDist.at(-1)!.id)!;
    expect(nearest.chaosAlpha).toBeLessThan(farthest.chaosAlpha);

    // 5. Complete at tick 200 + 90 = 290: settled, zero ring, zero petals, zero chaos, full bloom.
    const done = advanceRestorationPulse(pulse, "plaza", true, 200 + RESTORATION_PULSE_TICKS, {
      instant: false,
      overworldVisible: true,
    });
    expect(done.calmPulse).toBe(1);
    expect(done.wiping).toBe(false);

    const settledFrame = evaluateRestorationFrame(
      plazaStatus,
      done.calmPulse,
      done.wiping,
      290,
      false,
    );
    expect(settledFrame.ring.visible).toBe(false);
    expect(settledFrame.petals).toEqual([]);
    for (const decal of settledFrame.decals) {
      expect(decal.chaosAlpha).toBe(0);
      expect(decal.bloomAlpha).toBeGreaterThan(0.4);
    }
  });

  it("bypasses calmPulse instantaneously under Reduced Motion or paused harness mode", () => {
    const parkStatus = evaluateAreaRestoration(
      world,
      stateWith("park", { calms: { pup: 1 } }),
    )!;
    const chaotic = advanceRestorationPulse(null, "park", false, 10, {
      instant: true,
      overworldVisible: true,
    });
    const snapped = advanceRestorationPulse(chaotic.next, "park", true, 12, {
      instant: true,
      overworldVisible: true,
    });
    expect(snapped.calmPulse).toBe(1);
    expect(snapped.wiping).toBe(false);

    // Paused / reduced-motion steady visuals stay byte-deterministic across ticks.
    const frameA = evaluateRestorationFrame(parkStatus, 1, false, 12, true);
    const frameB = evaluateRestorationFrame(parkStatus, 1, false, 777, true);
    expect(frameA.ring.visible).toBe(false);
    expect(frameA.petals).toEqual([]);
    expect(frameA.decals).toEqual(frameB.decals);

    // Area switch or tick rewind resets cleanly without triggering a spurious wipe.
    const switched = advanceRestorationPulse(chaotic.next, "plaza", true, 20, {
      instant: false,
      overworldVisible: true,
    });
    expect(switched.wiping).toBe(false);
    expect(switched.calmPulse).toBe(1);

    const rewound = advanceRestorationPulse(chaotic.next, "park", true, 5, {
      instant: false,
      overworldVisible: true,
    });
    expect(rewound.wiping).toBe(false);
    expect(rewound.calmPulse).toBe(1);
  });

  it("ships a valid lean alpha-WebP restoration atlas, recipe, and review sheets", () => {
    const atlasJsonPath = "public/assets/restoration/restoration.json";
    const atlasWebpPath = "public/assets/restoration/restoration.webp";
    const recipePath = "art/recipes/restoration-decals.json";

    expect(existsSync(atlasJsonPath)).toBe(true);
    expect(existsSync(atlasWebpPath)).toBe(true);
    expect(existsSync(recipePath)).toBe(true);
    expect(existsSync("art/review/restoration-decals-cream.jpg")).toBe(true);
    expect(existsSync("art/review/restoration-decals-dark.jpg")).toBe(true);
    expect(statSync(atlasWebpPath).size).toBeLessThan(350 * 1024);

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value);
    const atlas: unknown = JSON.parse(readFileSync(atlasJsonPath, "utf8"));
    expect(isRecord(atlas)).toBe(true);
    if (!isRecord(atlas)) return;
    expect(isRecord(atlas.meta) && atlas.meta.image).toBe("restoration.webp");
    expect(isRecord(atlas.meta) && atlas.meta.size).toEqual({ w: 1024, h: 512 });
    expect(isRecord(atlas.frames)).toBe(true);
    if (!isRecord(atlas.frames)) return;

    for (const zoneId of RESTORATION_ZONE_IDS) {
      for (const decal of RESTORATION_ZONES[zoneId].decals) {
        const chaos = atlas.frames[decal.chaosFrame];
        const bloom = atlas.frames[decal.bloomFrame];
        expect(isRecord(chaos), `missing chaos frame ${decal.chaosFrame}`).toBe(true);
        expect(isRecord(bloom), `missing bloom frame ${decal.bloomFrame}`).toBe(true);
        if (isRecord(chaos)) expect(chaos.anchor).toEqual({ x: 0.5, y: 0.5 });
        if (isRecord(bloom)) expect(bloom.anchor).toEqual({ x: 0.5, y: 0.5 });
      }
    }
  });
});
