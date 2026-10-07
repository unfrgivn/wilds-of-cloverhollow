#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';
type P = [number, number];
type Thing = { id: string; polygon: P[]; baseline: number };
const area = JSON.parse(readFileSync("content/areas/woods.json", "utf8")) as
  Record<string, unknown>;
const rect = (x: number, y: number, w: number, h: number): P[] =>
  [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const things: Thing[] = [
  { id: "oak-west", polygon: rect(110, 200, 110, 150), baseline: 350 },
  { id: "pine-west", polygon: rect(300, 80, 90, 230), baseline: 310 },
  { id: "oak-east", polygon: rect(1400, 220, 120, 180), baseline: 400 },
  { id: "log-west", polygon: rect(360, 680, 260, 65), baseline: 745 },
  { id: "log-south", polygon: rect(680, 850, 300, 60), baseline: 910 },
  { id: "clubhouse", polygon: rect(610, 110, 600, 380), baseline: 490 },
];
area.walkable = [[80, 80], [1670, 80], [1670, 1020], [80, 1020]];
area.blockers = things.map((thing) => thing.polygon);
area.occluders = things;
writeFileSync("content/areas/woods.json", JSON.stringify(area, null, 2) + "\n");
console.log(`woods: ${things.length} blockers and occluders`);
