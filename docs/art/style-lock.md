# Style lock (how we prevent "different artist" drift)

The art pipeline must behave like compilation:

Raw generation (AI or kitbash) → Template normalization → Validated output

## Non-negotiables
- Palettes are versioned and enforced
- Toon shading uses a fixed 4-band ramp
- Lighting/camera templates are fixed per output type
- Every asset has a recipe file that reproduces it
