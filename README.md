# 10,000 FUTURES

10,000 Futures is an interactive visual product inspired by the original [Decision Simulator project](https://github.com/kju4q/ai-weekend-builds/tree/main/vol-3/05-decision-simulator) in AI Weekend Builds.

This is an independent standalone implementation. It compares exactly two options across 10,000 paired simulated futures, then maps every future into a cinematic full-screen Canvas universe. Every point of light is one named, touchable simulated run. It is educational software for exploring assumptions, not a prediction system.

## Local setup

Requires Node.js 20.19 or newer.

```sh
npm install
npm run dev
```

Use `npm run build` for the static production build and `npm run preview` to serve it locally. `npm run check` runs the text guard, TypeScript, ESLint, unit tests, production build, another text scan including `dist`, and Playwright browser tests. Individual commands are also available through `typecheck`, `lint`, `check:text`, `test`, and `test:e2e`.

## Architecture

React owns draft state, validated scenario state, the assumptions ledger, presentation state, persistence, and worker request coordination. One long-lived Web Worker owns validation, seeded sampling, safe expression evaluation, paired simulation, and statistics. Transferable typed arrays carry 10,000 outcomes to the main thread. Canvas 2D renders the full-bleed Future Field without creating particle DOM nodes or React components.

The Future Field places Option A outcomes on the left and Option B outcomes on the right. Horizontal distance reflects signed winning margin. Vertical position reflects the percentile rank of the winning outcome. A faint three-tick dollar axis makes that outcome dimension measurable. The horizontal scale uses the 99th percentile of absolute margin, so rare extremes do not flatten the field. Side labels, an exact-count ledger, and non-canvas finding text keep the outcome understandable without relying on color alone.

The universe is also the camera surface. Scroll or pinch empty space to zoom around the cursor, drag empty space to pan, and double-click to reset the camera. Camera motion is applied immediately as one world transform. After zoom settles, the field rerasterizes at a capped effective resolution based on device pixel ratio and camera scale, so magnification reveals sharper particles without uncontrolled memory growth.

Particle rendering uses three pre-rendered radial-gradient sprites with near-white cores and cyan, coral, or violet falloff. Canvas additive compositing lets dense regions bloom naturally without per-particle `shadowBlur`. A stable visual substream gives each future a slight size variation. Subtle deterministic field breathing and background parallax add depth without changing simulation data. Reduced-motion and capture modes disable them.

Hover a particle or tap it to inspect that future. A fixed spatial grid narrows hit testing to nearby buckets rather than scanning 10,000 points on every pointer move. Related nearby outcomes brighten and connect with hairlines while the surrounding population recedes. Clicking pins a future, with up to three quiet specimen records available at once. Records resample each variable through the exact same stable substreams used by the worker, so the sampled bonus, equity result, success flag, and option outcomes agree with that run. Stories describe only variables the model actually contains. A pinned stable future keeps its ID across assumption changes and visibly travels to its new position with a short luminous trail.

The default editing experience presents assumptions as entries in one compact lab ledger. Drag an entry horizontally, hover and scroll, or use its arrow keys to nudge the value. Click an entry to enter an exact number inline. The success chance remains the emphasized scrub target. The quiet Menu drawer contains reset, import, export, and the classic labeled inputs and sliders for screen readers, keyboard workflows, and detailed editing.

## Scenario schema

Scenario JSON is versioned with `schemaVersion: 1` and contains product copy, locale, output format, target, fixed run count, simulation and visual seeds, variables, exactly two options, and formulas. Supported variable types are `fixed`, `normal`, `uniform`, `triangular`, and `bernoulli`.

Formulas use a small arithmetic parser. It accepts numeric constants, declared variable keys, parentheses, arithmetic operators, exponentiation, unary signs, and the approved functions `min`, `max`, `abs`, `sqrt`, `log`, and `exp`. It does not execute JavaScript.

## Determinism and common random numbers

The simulation never uses `Math.random()`. Each distribution draw comes from a stable substream derived from the simulation seed, stable variable id, future id, and draw slot. Renaming a visible label or reordering variables does not reshape unrelated futures. When an assumption changes, the same underlying quantile is reused for each future. This common-random-numbers approach makes particle movement show the effect of the changed assumption.

The visual seed separately controls deterministic jitter and final particle layout. Reset scenario restores the original scenario, both seeds, exact simulation result, and exact layout.

## Import, export, and local storage

Import and Export operate on scenario configuration only. Imported JSON is validated before it can replace the current scenario. The last valid scenario is saved under `ten-thousand-futures:scenario:v1`. Invalid drafts never overwrite it. Corrupted or unsupported saved data recovers to the default demo with a notice.

All processing and storage remain in the browser. The application makes no runtime network requests and includes no analytics, remote fonts, remote images, remote scripts, or APIs.

## Presentation and capture

Press `P` to toggle presentation mode, `Escape` to exit, and `R` to replay the deterministic reveal. Supported capture URLs include:

```text
?present=1
?present=1&aspect=vertical
?present=1&aspect=vertical&autoplay=1
?present=1&replay=1
?testMode=1
?capture=1&testMode=1
```

Presentation mode removes the menu, disclaimer, and visible diagnostics for filming. Its assumptions ledger opens in a compact state with only the success chance scrubber, and can expand back to the complete ledger in place. The vertical presentation is designed for a 1080 by 1920 capture with conservative interface-safe margins. Capture mode excludes transient hover cards and, with test mode, freezes ambient motion for deterministic image comparison. Reduced-motion users receive the final field without particle trails, ambient drift, reveal pulses, or pointer parallax.

## Performance and browser support

The worker targets a response below 200 milliseconds on a recent laptop. Canvas uses typed position buffers, preprojected world coordinates, cached glow sprites, additive blits, a capped DPR-and-zoom render scale, and precomputed connection pairs. Continuous camera motion stays on the compositor; one debounced reraster sharpens the field after zoom settles. Hover uses a 96 by 64 spatial grid, and pinned markers remain lightweight DOM overlays rather than 10,000 DOM nodes. The current interface supports current stable Chrome, Edge, Safari, and Firefox, with Chromium as the primary automated recording target and WebKit in the browser suite.

Two locally bundled variable fonts are provided through Fontsource: Space Grotesk and Inter. Both use the SIL Open Font License 1.1. The font resources are included in the production build and require no network request.

## Responsible interpretation

Results describe only the supplied assumptions and formulas. They are not real-world probabilities, forecasts, guarantees, or recommendations. The first version intentionally excludes correlated variables, more than two options, editable run counts, sensitivity analysis, accounts, collaboration, and remote data.

An educational simulation of your own assumptions. Not financial advice.
