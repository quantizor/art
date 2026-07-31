# TypeGPU and WebGPU compute

Version pins: `typegpu` **0.9.x**, `unplugin-typegpu` **0.9.x**, `@webgpu/types` **0.1.x**.

TypeGPU is the authoring layer for **standalone GPU compute** over typed buffers and WGSL. It is installed and wired in Vite; **no application source imports TypeGPU yet**. Do not claim TypeGPU is practiced until a compute shader lands in `src/`.

## Division of labor

| Concern | Owner |
| --- | --- |
| Materials, lights, post-processing graphs | TSL / `NodeMaterial` via `three/webgpu` |
| Scene rendering, bloom, passes | `PostProcessing` / TSL (see `agent-docs/threejs.md`) |
| Standalone compute (simulation buffers, prefix sums, field updates) | TypeGPU |

Do not use TypeGPU for material graphs or screen-space post effects that TSL already expresses.

## Vite plugin

`vite.config.ts` registers the TypeGPU plugin alongside Tailwind and TanStack Start:

```ts
import typegpuPlugin from 'unplugin-typegpu/vite'

plugins: [
  typegpuPlugin({}),
  // ...
]
```

Verified: `unplugin-typegpu@0.9.0` export `./vite`; plugin present in project config.

## Authoring rules (when compute lands)

Do:

- Define buffer layouts and entry points through TypeGPU's typed API (`typegpu`, `typegpu/data`, `typegpu/std` as needed).
- Keep compute kernels in dedicated modules under the owning project (`src/projects/...` or `src/games/...`).
- Read/write GPU memory through TypeGPU abstractions when TypeGPU owns the pipeline.

Do not:

- Drop to raw `GPUDevice.createComputePipeline` / manual bind group layout wiring when TypeGPU covers the use case.
- Mix TypeGPU compute passes with raw WebGPU command encoding in the same feature without a documented boundary.
- Import bare `three` for compute that should stay independent of the render graph.

## Relationship to Three.js WebGPU

The render path uses `WebGPURenderer` from `three/webgpu`. TypeGPU may share the same `GPUDevice` only when the integration is explicitly designed and disposed together. Default assumption: compute modules manage their own device lifecycle or receive a device handle from a single owner documented in the feature.

## Status

- Package present: `typegpu@0.9.0` in dependencies.
- Plugin present: `unplugin-typegpu/vite` in `vite.config.ts`.
- Source usage: **none** under `src/` (verified by search).

New compute work starts with a failing test or harness, then minimal TypeGPU kernel, then wiring into the simulation or game engine.
