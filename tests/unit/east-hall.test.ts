import { describe, expect, it } from "vitest";
import { loadContent } from "../../src/content/load";
import { areaConnectionErrors } from "../../src/content/area-checks";

const { world } = loadContent();
const hall = world.areas["east-hall"];
const school = world.areas.school;
const gym = world.areas.gym;
const music = world.areas.music;
if (hall === undefined || school === undefined || gym === undefined || music === undefined)
  throw new Error("new M38 areas missing");

describe("east hall and music room", () => {
  it("connects the school, gym, and music doors", () => {
    expect(hall.triggers.find((x) => x.id === "west")?.target)
      .toEqual({ area: "school", spawn: "east-hall" });
    expect(school.triggers.find((x) => x.id === "east-hall")?.target)
      .toEqual({ area: "east-hall", spawn: "west" });
    expect(hall.triggers.find((x) => x.id === "gym-doors")).toMatchObject({
      target: { area: "gym", spawn: "door" },
      requires: { variable: "pe_time", knot: "gym_hall" },
    });
    expect(gym.triggers[0]?.target).toEqual({ area: "east-hall", spawn: "gym-doors" });
    expect(hall.triggers.find((x) => x.id === "music-door")).toMatchObject({
      target: { area: "music", spawn: "door" },
      requires: { variable: "music_time", knot: "music_closed" },
    });
    expect(music.triggers[0]?.target).toEqual({ area: "east-hall", spawn: "music-door" });
    expect(school.triggers.some((x) => x.id === "gym-doors")).toBe(false);
  });

  it("has usable music people, critters, and look points", () => {
    expect(world.characters["music-teacher"]?.atlas)
      .toBe("assets/characters/music-teacher/music-teacher.json");
    expect(music.npcs.map((x) => x.id)).toEqual(["music-teacher"]);
    expect(music.critters.map((x) => x.id)).toEqual(["music-bird"]);
    expect(music.interactables.map((x) => x.id)).toEqual([
      "xylophone", "piano", "song-poster", "music-window", "instrument-shelf",
    ]);
    expect(areaConnectionErrors(world.areas, world.tunables, world.critters, world.party))
      .toEqual([]);
  });
});
