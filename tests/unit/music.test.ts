import { describe, expect, it } from "vitest";
import {
  createState,
  type State,
  soundCues,
} from "../../src/core";
import { createInkState, inkVariable, runInk, type InkFacts } from "../../src/core/ink";
import { loadContent, storyTagErrors } from "../../src/content/load";

const content = loadContent();
const world = content.world;
const story = world.story;
const quiet: InkFacts = { calmed: {}, coins: 0 };
const calmBird: InkFacts = { calmed: { "music-bird": true }, coins: 0 };

type Played = { lines: string[]; sounds: string[]; ink: string };
function play(
  ink: string,
  knot: string,
  facts: InkFacts = quiet,
  choices: number[] = [],
): Played {
  const lines: string[] = [];
  const sounds: string[] = [];
  let result = runInk(story, ink, { type: "start", knot }, facts);
  let choice = 0;
  for (let count = 0; count < 60; count += 1) {
    if (result.line !== null) {
      lines.push(result.line.text);
      if (result.line.sound !== undefined) sounds.push(result.line.sound);
    }
    if (result.ended) break;
    result = result.choices.length > 0
      ? runInk(story, result.ink, {
        type: "choose",
        index: choices[choice++] ?? 0,
      }, facts)
      : runInk(story, result.ink, { type: "next" }, facts);
  }
  return { lines, sounds, ink: result.ink };
}

const fresh = createInkState(story, 1);
const variable = (ink: string, name: string): unknown => inkVariable(story, ink, name);

function dialogueState(text: string, sound: "chime-red" | "flute") {
  return {
    knot: "music_bird_calm",
    speaker: "Music Bird",
    text,
    revealed: text.length,
    choices: [],
    selected: 0,
    ended: false,
    sound,
  };
}

describe("music story sound projection", () => {
  it("projects a sound when the line opens, advances, and repeats", () => {
    const base = createState(world, { area: "harness", spawn: "start", seed: 1 });
    const first = {
      ...base,
      dialogue: dialogueState("Red...", "chime-red"),
    };
    const next = {
      ...first,
      ink: "two",
      dialogue: dialogueState("Red...", "chime-red"),
    };
    const repeated = {
      ...next,
      ink: "three",
      dialogue: dialogueState("A flute call.", "flute"),
    };
    expect(soundCues(base, first)).toContain("chime-red");
    expect(soundCues(first, next)).toContain("chime-red");
    expect(soundCues(next, repeated)).toContain("flute");
  });

  it("rejects an unknown story sound", () => {
    expect(storyTagErrors(["sound: kazoo"], {})).toEqual([
      'unknown sound in "sound: kazoo"',
    ]);
  });
});

describe("Ms. Willow", () => {
  it("introduces the room and both choices lead into song_start", () => {
    const intro = play(fresh, "music_teacher", quiet, [0]);
    const question = play(fresh, "music_teacher", quiet, [1]);
    expect(intro.lines).toEqual([
      "Oh! Fae, come in, come in! Welcome to music class!",
      "I'm afraid it's been a terribly dramatic morning.",
      "Someone in a purple hood climbed in through my window and scribbled all over " +
      "our class song!",
      "And then a bluebird flew in after them and snatched my chime mallet!",
      "Oh, would you? You're a dear. Gently, mind. It's only frightened.",
      "Our class song goes red, yellow, blue...",
      "...and then I simply can't remember! The last note is under all those purple squiggles.",
    ]);
    expect(question.lines).toContain(
      "Only a purple hood, scrambling back out the window. Not so much as a hello!");
    expect(question.lines.at(-2)).toBe("Our class song goes red, yellow, blue...");
    expect(variable(intro.ink, "song_start")).toBe(true);
    expect(variable(question.ink, "song_start")).toBe(true);
  });

  it("follows the hunt: the mallet, then the bird's note, then the flute", () => {
    const met = play(fresh, "music_teacher", quiet, [0]).ink;
    expect(play(met, "music_teacher").lines).toEqual([
      "That bluebird still has my mallet. A kind word might calm it down.",
    ]);
    // Calmed in battle, the bird has dropped the mallet; its note comes when Fae listens.
    expect(play(met, "music_teacher", calmBird).lines).toEqual([
      "You've got my mallet! Red, yellow, blue... and then?",
      "That bluebird keeps singing one bright note. Have a listen!",
    ]);
    const heard = play(met, "music_bird_calm", calmBird).ink;
    expect(play(heard, "music_teacher", calmBird).lines).toEqual([
      "You've got my mallet! Red, yellow, blue... and then?",
      "Try it on the xylophone!",
    ]);
    const flute = play(heard, "xylophone", calmBird, [0, 1, 3, 0]).ink;
    expect(play(flute, "music_teacher", calmBird).lines).toEqual([
      "Play that flute whenever you need a friend, Fae!",
    ]);
  });

  it("thanks Fae for the mallet when the bird was calmed before they met", () => {
    const met = play(fresh, "music_teacher", calmBird);
    expect(met.lines).toEqual([
      "Oh! Fae, come in, come in! Welcome to music class!",
      "I'm afraid it's been a terribly dramatic morning.",
      "Someone in a purple hood climbed in through my window and scribbled all over " +
      "our class song!",
      "And you've found my chime mallet! The bluebird had it? Oh, thank you, Fae!",
      "Our class song goes red, yellow, blue...",
      "...and then I simply can't remember! The last note is under all those purple squiggles.",
    ]);
    expect(variable(met.ink, "song_start")).toBe(true);
  });
});

describe("the music bird", () => {
  it("sings the red bar's note when Fae listens, with or without the quest", () => {
    const first = play(fresh, "music_bird_calm", calmBird);
    expect(first.lines).toEqual([
      "Tweet! The bluebird puffs out its chest, very pleased with itself.",
      "It sings one bright, clear note.",
      "That note sounds just like the red bar on the xylophone!",
      "A little wooden mallet. Whose could it be?",
    ]);
    expect(first.sounds).toEqual(["chime-red"]);
    expect(variable(first.ink, "heard_bird")).toBe(true);
    const quest = play(play(fresh, "music_teacher", quiet, [0]).ink,
      "music_bird_calm", calmBird);
    expect(quest.lines.at(-1)).toBe("I've got Ms. Willow's chime mallet back!");
    expect(play(first.ink, "music_bird_calm", calmBird).lines).toEqual([
      "The bluebird hums along to nothing in particular, very softly.",
    ]);
  });
});

describe("the xylophone", () => {
  const knowsAll = play(play(fresh, "music_teacher", calmBird).ink,
    "music_bird_calm", calmBird).ink;

  it("cannot play without the mallet", () => {
    expect(play(fresh, "xylophone").lines).toEqual([
      "The rainbow xylophone! But there's no mallet to play it with.",
    ]);
  });

  it("plays the right song and gives Fae the flute", () => {
    const result = play(knowsAll, "xylophone", calmBird, [0, 1, 3, 0]);
    expect(result.lines).toEqual([
      "Which bar first?",
      "Red...",
      "Red, yellow...",
      "Red, yellow, blue...",
      "Red, yellow, blue, red!",
      "That's it! That's our class song! Bravo, Fae!",
      "You found the note the scribbles hid. Now come here, I have something for you.",
      "This was my very first flute, when I was just about your age.",
      "Ms. Willow gives Fae a little wooden flute, painted with flowers and pastel bands.",
      "Play it, and animal friends will come running to listen.",
      "Fae plays a soft little tune.",
    ]);
    expect(result.sounds).toEqual([
      "chime-red", "chime-yellow", "chime-blue", "chime-red", "flute",
    ]);
    expect(variable(result.ink, "has_flute")).toBe(true);
    expect(variable(result.ink, "music_quest")).toBe(true);
  });

  it("judges a wrong song only after four bars, with a hint for what's missing", () => {
    const wrong = [0, 2, 3, 0];
    const nothing = play(fresh, "xylophone", calmBird, wrong);
    expect(nothing.lines.slice(1)).toEqual([
      "Red...", "Red, green...", "Red, green, blue...", "Red, green, blue, red!",
      "Hmm. That doesn't sound like the class song.",
      "Maybe Ms. Willow knows how it goes.",
    ]);
    expect(variable(nothing.ink, "has_flute")).toBe(false);
    const toldStart = play(fresh, "music_teacher", calmBird).ink;
    expect(play(toldStart, "xylophone", calmBird, wrong).lines.slice(-2)).toEqual([
      "Hmm. That doesn't sound like the class song.",
      "Maybe that bluebird knows the last note.",
    ]);
    expect(play(knowsAll, "xylophone", calmBird, wrong).lines.at(-1))
      .toBe("Hmm. That doesn't sound like the class song.");
  });

  it("can stop partway and starts a fresh attempt at one", () => {
    const stopped = play(knowsAll, "xylophone", calmBird, [0, 4]);
    expect(stopped.lines).toEqual(["Which bar first?", "Red..."]);
    const again = play(stopped.ink, "xylophone", calmBird, [1, 4]);
    expect(again.lines).toEqual(["Which bar first?", "Yellow..."]);
  });

  it("offers free play after the flute, then Stop", () => {
    const reward = play(knowsAll, "xylophone", calmBird, [0, 1, 3, 0]);
    const free = play(reward.ink, "xylophone", calmBird, [1, 0, 4]);
    expect(free.lines).toEqual(["A little tune of my own!", "Yellow!", "Red!"]);
    expect(free.sounds).toEqual(["chime-yellow", "chime-red"]);
  });

  it("rewards the right song before Fae ever talks to Ms. Willow", () => {
    const result = play(fresh, "xylophone", calmBird, [0, 1, 3, 0]);
    expect(variable(result.ink, "has_flute")).toBe(true);
    expect(variable(result.ink, "music_quest")).toBe(true);
    expect(play(result.ink, "music_teacher", calmBird).lines).toEqual([
      "Play that flute whenever you need a friend, Fae!",
    ]);
  });
});

describe("music room looks and journal", () => {
  it("has the locked door, the art room, and the room's look points", () => {
    expect(play(fresh, "music_closed").lines).toEqual([
      "The music room is locked. Music class is after PE.",
    ]);
    expect(play(fresh, "art_room").lines).toEqual([
      "A paint palette on the door. The art room, maybe? It's locked.",
    ]);
    expect(play(fresh, "piano").lines).toEqual([
      "An upright piano, polished till it shines. Ms. Willow plays the class song on it.",
    ]);
    const poster = [
      "Our class song, in big coloured dots... scribbled all over with purple marker!",
      "The same purple as the Star Racer scribbles.",
    ];
    expect(play(fresh, "song_poster").lines).toEqual([
      ...poster, "The last note is completely hidden.",
    ]);
    const flute = play(fresh, "xylophone", calmBird, [0, 1, 3, 0]).ink;
    expect(play(flute, "song_poster").lines).toEqual(poster);
    expect(play(fresh, "music_window").lines).toEqual([
      "The window's wide open. That's how the kid in the purple hood got in, and out again.",
      "A few purple fuzzies are caught on the latch.",
    ]);
    expect(play(fresh, "instrument_shelf").lines).toEqual([
      "Tambourines, maracas, a drum, and a triangle. Everything a band needs!",
    ]);
  });

  it("keeps the journal's music lines newest first at each stage", () => {
    const music = (lines: string[]): string[] => lines.filter((line) =>
      /bluebird|class song|music|flute/i.test(line));
    expect(music(play(fresh, "journal").lines)).toEqual([]);
    const met = play(fresh, "music_teacher", quiet, [0]).ink;
    expect(music(play(met, "journal").lines)).toEqual([
      "A bluebird took Ms. Willow's chime mallet. Maybe a kind word will calm it down.",
      "The class song goes red, yellow, blue... and the last note is under the purple " +
      "scribbles.",
      "The kid in the purple hood climbed in through the music room window and " +
      "scribbled on the class song.",
    ]);
    expect(music(play(met, "journal", calmBird).lines).slice(0, 2)).toEqual([
      "The bluebird gave back Ms. Willow's chime mallet.",
      "The class song goes red, yellow, blue... and the last note is under the purple " +
      "scribbles.",
    ]);
    const heard = play(met, "music_bird_calm", calmBird).ink;
    expect(music(play(heard, "journal", calmBird).lines).slice(0, 2)).toEqual([
      "The bluebird sang a note just like the red bar. Maybe that's the song's last note!",
      "The bluebird gave back Ms. Willow's chime mallet.",
    ]);
    const flute = play(heard, "xylophone", calmBird, [0, 1, 3, 0]).ink;
    expect(music(play(flute, "journal", calmBird).lines)).toEqual([
      "Ms. Willow gave me her very first flute! When I play it, animal friends come running.",
    ]);
  });

  it("never names the kid in the purple hood", () => {
    const knots = [
      "music_teacher", "music_bird_calm", "xylophone", "piano", "song_poster",
      "music_window", "instrument_shelf", "music_closed", "art_room",
    ];
    for (const knot of knots)
      for (const facts of [quiet, calmBird])
        expect(play(fresh, knot, facts).lines.join(" ")).not.toMatch(/named|name is|called [A-Z]/);
  });
});
