# 0001 — Pivot to pixel art (2D)

Date: 2026-01-25

## Decision
Switch the overworld and core art pipeline from 2.5D (3D world + sprites) to **2D pixel art**.

## Why
The 3D object rendering was not reaching acceptable quality after iteration. Pixel art with reusable tiles/sprites is lower risk and scales better with consistent results.

## Consequences
- Overworld uses TileMap and reusable sprite props.
- Remove 3D materials/toon shading pipeline.
- Update milestones, docs, and pipeline tooling accordingly.
