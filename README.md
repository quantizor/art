# quantizor's studio

Personal creative coding playground. A mix of generative art, GPU experiments, and games — all built on the web stack.

## what's in here

### tension (crystal growth sim)

Real-time crystal growth simulation using diffusion-limited aggregation under polarized light. Three.js powered. `src/projects/tension/`

### brutalist design system

Hand-rolled component library with a dark brutalist cyberpunk vibe. Buttons, cards, inputs, sliders, tooltips, toggle groups — the works. All built on CSS variables and Tailwind v4. There's a live showcase at `/ui`. `src/ui/`

### speed dial homepage

The homepage is a speed dial grid (like an old-school browser new tab page) that links to the various projects. `src/components/SpeedDial/`

## tech

- TanStack Start (file-based routing, SSR)
- React 19
- Three.js for 3D
- TypeGPU for GPU/shader work
- Tailwind CSS v4
- Bun for runtime + tests
- TypeScript (strict, no `any`)

## running it

```sh
bun install
bun dev
```

Tests (mostly for the game engine):

```sh
bun test src/games/
```
