#!/usr/bin/env bun
// Records the Hills recurrence contract: a meadow critter is calm only for
// this visit, then a fresh arrival rolls the den again. Every calm pays coins,
// while the kind's sticker is awarded only once.
import { createState, rollWild, step, blankInput } from "../../src/core";
import { loadContent } from "../../src/content/load";

const { world, fixtures } = loadContent();
const fixture = fixtures.hills;
if (fixture === undefined) throw new Error("hills fixture missing");
const area = world.areas.hills;
if (area === undefined) throw new Error("hills area missing");
const arrived = step(world, createState(world, fixture), blankInput()).state;
const first = arrived.wild;
if (!first.some((critter) => critter.kind === "lamb")) throw new Error("no lamb on first arrival");
const fresh = rollWild(world, { ...arrived, wild: [] }, area).wild;
if (fresh.length === 0 || fresh.every((critter) => critter.mood !== "chaos"))
  throw new Error("the hills did not roll fresh chaos critters");
if (fresh === first) throw new Error("the hills reused the previous visit");
console.error(`hills recurring: first ${first.length}, fresh ${fresh.length}`);
