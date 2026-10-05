# AGENTS.md

This repo is built by autonomous agents. Read `spec.md` first; it is the single
source of truth. Work comes from `docs/plan.md`.

## Rules
1. `spec.md` wins. A change to behavior, interfaces, file formats, or decisions
   updates `spec.md` in the same commit.
2. Work one milestone at a time. One commit per milestone:
   `feat: <Title> (Milestone <N>)`. Push to `main` after the gates pass. If an
   HTTPS push cannot find credentials, push with
   `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main`.
3. Do not stop to ask about implementation details. Make reasonable
   assumptions and record them in the milestone notes. These need the owner:
   a dependency not listed in spec section 2, paid generation beyond the
   milestone's needs, store or account actions, and deleting owner content
   (`NOTES.md`, `docs/art/concepts/`).
4. Keep diffs small. Build nothing from spec section 13 ("Out of scope").
5. Functional core, imperative shell: `src/core` stays pure (no DOM, Pixi,
   timers, `Date`, `Math.random`, or I/O).
6. TypeScript is `strict`. No `any`. Avoid `as` casts; model real shapes and
   narrow with type guards.
7. No mock-based tests. Use core unit tests, headless sim scripts, and
   Playwright e2e tests against the real game.
8. No breadcrumbs. Delete moved or dead code outright.

## Evidence for every gameplay milestone
- A core unit test for new rules.
- A headless sim script when state changes over time.
- A Playwright e2e test that uses real key presses.
- A screenshot the agent has actually viewed. Update visual baselines only
  after viewing the new image.

## Gates (run and report actual output)
- `just check`: typecheck, unit tests, headless sim.
- `just e2e`: Playwright end-to-end tests.
- `just build`: production build; fails if the dev hook leaks into it.
- `just ios-sim`: from Milestone 4, for milestones touching iOS.

## Agent tooling
- Chrome DevTools MCP (project `opencode.json`) opens an isolated Chrome at
  1280x720. Drive the game with real key presses and the `window.__cloverhollow`
  hook (spec section 11); take screenshots to see it.
- MobileBuildMCP builds, runs, taps, and screenshots the iOS Simulator.
- Xcode MCP (`xcrun mcpbridge`) only works while Xcode has the iOS project
  open; it is disabled in `opencode.json` until needed.

## Art
- Style source: `docs/art/concepts/`. Rules: spec section 12 and
  `docs/art/style-bible.md`.
- Every kept generated asset has a recipe in `art/recipes/`. Runtime assets go
  in `public/assets/`. Scratch output goes in `art/scratch/` (gitignored).
- Never overwrite owner-approved art without a new recipe.
