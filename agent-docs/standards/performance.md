performance

Scope: render loops, build size, prerender, and hot paths in creative scenes.

Evidence
- Validate hot-path claims with a measurement, not recall or training data.
- Keep drift-prone numbers out of docs and comments; name the command or script that prints the live figure.

GPU and canvas
- WebGPU via three/webgpu WebGPURenderer only (see agent-docs/threejs.md).
- Free GPU resources when scenes unmount; verify disposal in dev tools when changing lifecycle.
- Tension DPR uses GRID_SCALE (pixel-stable grid), not raw devicePixelRatio.

Rendering review
- Visual performance judgments require looking at the running scene, not only frame-time logs.
- Prefer container queries for slot-sized layouts over viewport-only breakpoints when components embed in variable slots.

Build and prerender
- bun run build runs typecheck then Vite build. bun run deploy prerenders into docs/ on port 4173 so a running Vite server cannot poison output.
- Do not author performance claims about bundle size without running the build and inspecting output.

Profiling
- Use browser performance tools or project-specific snapshot endpoints (e.g. /__snapshot in vite.config.ts) for deterministic captures.
- Change one variable at a time when tuning shaders or post-processing.

When not to optimize
- Do not add caching layers or memoization without evidence of a measured problem.
- Correctness and clarity come first outside proven hot paths.
