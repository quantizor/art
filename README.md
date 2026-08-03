# quantizor's studio

Personal creative coding playground. Generative art, GPU experiments, and games on the web stack.

## what's in here

### tension

Procedural agate cross-sections. SDF cavity partition plus a wall-distance transform produce concentric fortification bands; an OKLCH mineral palette paints each band. Three.js WebGPU. `src/projects/tension/`

### id1

Glass torus on a walnut table. Photorealistic still-life with PBR materials and transmission glass. `src/projects/id1/`

### brutalist design system

Hand-rolled component library with a dark brutalist cyberpunk vibe. Live showcase at `/ui`. `src/ui/`

### speed dial homepage

Homepage speed-dial grid linking to projects. `src/components/SpeedDial/`

### lightcycle

Lightcycle game mounted as the 404 page via `NotFound`. No dedicated route. `src/games/lightcycle/`

## tech

- TanStack Start (file-based routing, SSR)
- React 19
- Three.js WebGPU (`three/webgpu`) with TSL materials
- TypeGPU for standalone GPU compute (when used)
- Tailwind CSS v4
- Bun for runtime and tests
- TypeScript strict, no `any`

## running it

```sh
bun install
bun dev
```

The app listens on http://art.localhost:3011/ when managed with `devctl`.

Verification:

```sh
bun run verify
```

Or individually:

```sh
bun run typecheck
bun test
bun run build
```

Agent-facing rules live in `AGENTS.md` and `agent-docs/`. Research notes live in `research/`. The `docs/` tree is generated GitHub Pages output only.
