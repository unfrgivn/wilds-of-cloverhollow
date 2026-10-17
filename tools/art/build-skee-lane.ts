#!/usr/bin/env bun
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
mkdirSync('public/assets/arcade', { recursive: true });
const barrier = spawnSync('magick', [
  'art/source/arcade/skee-lane-raw.png', '-alpha', 'on', '-fill', 'black',
  // The outer rail outlines form a flood-fill barrier. The lane reaches the
  // bottom edge, so corner flood-fill must never enter this quadrilateral.
  '-draw', 'polygon 900,870 1500,870 2000,1791 400,1791',
  '-fuzz', '10%', '-fill', 'none',
  '-fill', 'none', '-draw', 'color 0,0 floodfill',
  '-draw', 'color 2399,0 floodfill', '-draw', 'color 0,1791 floodfill',
  '-draw', 'color 2399,1791 floodfill', 'art/scratch/skee-lane-barrier.png',
], { stdio: 'inherit' });
if (barrier.status !== 0) process.exit(barrier.status ?? 1);
const result = spawnSync('magick', [
  'art/source/arcade/skee-lane-raw.png', 'art/scratch/skee-lane-barrier.png',
  '-compose', 'CopyOpacity', '-composite', '-define', 'webp:lossless=false',
  '-quality', '88', 'art/scratch/skee-lane-pre.webp',
], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const alpha = spawnSync('magick', [
  '-size', '2400x1792', 'xc:black', '-fill', 'white',
  '-draw', 'polygon 900,870 1500,870 2000,1791 400,1791',
  'art/scratch/skee-lane-protect.png',
], { stdio: 'inherit' });
if (alpha.status !== 0) process.exit(alpha.status ?? 1);
const finish = spawnSync('magick', [
  'art/scratch/skee-lane-pre.webp', '-alpha', 'extract',
  'art/scratch/skee-lane-protect.png', '-compose', 'lighten', '-composite',
  'art/scratch/skee-lane-final-alpha.png',
], { stdio: 'inherit' });
if (finish.status !== 0) process.exit(finish.status ?? 1);
const forced = spawnSync('magick', [
  'art/scratch/skee-lane-final-alpha.png', '-fill', 'white',
  '-draw', 'polygon 900,870 1500,870 2000,1791 400,1791',
  'art/scratch/skee-lane-forced-alpha.png',
], { stdio: 'inherit' });
if (forced.status !== 0) process.exit(forced.status ?? 1);
const output = spawnSync('magick', [
  'art/scratch/skee-lane-pre.webp', 'art/scratch/skee-lane-forced-alpha.png',
  '-compose', 'CopyOpacity', '-composite', '-quality', '88',
  'public/assets/arcade/skee-lane.webp',
], { stdio: 'inherit' });
if (output.status !== 0) process.exit(output.status ?? 1);
