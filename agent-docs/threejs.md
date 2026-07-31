# Three.js (WebGPU)

Version pin: **0.185.x** (`three@0.185.1`, `@types/three@0.185.0`). Import from `three/webgpu` and documented addons / `three/tsl` only. Prefer the shared factory at `src/utils/gpu/createGpuRenderer.ts`. `bun run policy` enforces the ban list.

## Renderer

```ts
import { WebGPURenderer } from 'three/webgpu'

const renderer = new WebGPURenderer({ canvas, antialias: false })
await renderer.init()

if (renderer.backend.isWebGPUBackend !== true) {
  throw new Error('WebGPU backend required; got WebGL fallback')
}
```

Verified in installed Three (pre-bump **0.182.0**, same API surface):

- `WebGPURenderer` exported from `three/webgpu` (`Three.WebGPU.js`).
- `async init()` on `Renderer` (`Renderer.js`); `.render()` throws if init was skipped.
- `WebGPUBackend.isWebGPUBackend === true` set in constructor (`WebGPUBackend.js` line 63).

Do:

- `await renderer.init()` before the first `render()` / post-processing draw.
- Assert `renderer.backend.isWebGPUBackend === true` after init in app code.
- Set pixel ratio explicitly per project (tension: `GRID_SCALE`, not raw `devicePixelRatio`; see below).

Do not:

- Import `WebGLRenderer`, `ShaderMaterial`, or `EffectComposer`.
- Import bare `three` or `three/addons/.../EffectComposer` in app code.
- Pass `{ forceWebGL: true }` except in a marked negative test.

## Materials and TSL

- Use `NodeMaterial` and TSL nodes from `three/tsl` for custom shading.
- Rect area lights on WebGPU require LTC textures:

```ts
import { RectAreaLightNode } from 'three/webgpu'
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js'

RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())
```

Verified: `RectAreaLightNode.setLTC(ltc)` static at `src/nodes/lighting/RectAreaLightNode.js` line 125.

## Post-processing

Use TSL post stacks, not `EffectComposer`. At r185 prefer `RenderPipeline` (`PostProcessing` extends it and may warn as a deprecated alias).

```ts
import { RenderPipeline, pass } from 'three/webgpu'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

const pipeline = new RenderPipeline(renderer)
const scenePass = pass(scene, camera)
const color = scenePass.getTextureNode('output')
pipeline.outputNode = bloom(color, strength, radius, threshold).add(color)
```

Verified in installed Three 0.185.1:

- `RenderPipeline` and `PostProcessing` exported from `three/webgpu`; `PostProcessing extends RenderPipeline`.
- `bloom(node, strength, radius, threshold)` from `examples/jsm/tsl/display/BloomNode.js`.

Dispose pass and bloom nodes explicitly in scene teardown; the pipeline dispose path does not free every target.

## SceneManager factory

Async construction must accept cancellation:

```ts
static async create(
  canvas: HTMLCanvasElement,
  options?: { signal?: AbortSignal },
): Promise<SceneManager> {
  if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const renderer = new WebGPURenderer({ canvas })
  await renderer.init()
  if (options?.signal?.aborted) {
    renderer.dispose()
    throw new DOMException('Aborted', 'AbortError')
  }
  // ...
}
```

React mounts (including StrictMode double mount in dev) pass `AbortSignal` from the effect cleanup. See `agent-docs/react.md`.

## TrailRenderer (lightcycle)

Current implementation:

- One fixed-capacity `BufferGeometry` allocated at construction.
- Update vertex/index data in place; drive visible count with `geometry.setDrawRange(start, count)`.
- Do **not** replace the geometry during trail updates.

## Project-specific

### tension (`src/projects/tension/`)

- DPR: `renderer.setPixelRatio(GRID_SCALE)` where `GRID_SCALE = devicePixelRatio` (`src/projects/tension/constants.ts`). Grid dimensions scale with `GRID_SCALE`; simulation accounts for `GRID_SCALE²` fill rate.
- Orthographic microscopy-style scene rendered directly with WebGPU.

### id1 (`src/projects/id1/`)

- Perspective WebGPU still-life with HDRI, shadows, and node materials.

### lightcycle (`src/games/lightcycle/`)

- **No dedicated route.** Mounted only from `src/components/NotFound.tsx` as the global 404 experience (`defaultNotFoundComponent` in `src/router.tsx`, root `notFoundComponent`).
- Participates in the SSR graph through the NotFound shell; guard browser-only init.

## Addons import style

```ts
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
```

Use `.js` extension paths as Three's package exports expect. Never `import * as THREE from 'three'` in app code.

## Verification

After GPU changes: run `bun run policy`, render the affected route, and inspect output (dev snapshot endpoint `POST /__snapshot` in `vite.config.ts` writes PNGs to `/tmp/tension-snapshots/` during local dev).
