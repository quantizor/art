# Project Documentation

## Agent Instructions

When working on this codebase, follow these directives:

### 0. Never Run Dev Server

Never run `bun dev`, `bun start`, `bun run preview`, or any command that starts a long-running dev/preview server. The user runs the dev server themselves. Only use `npx tsc --noEmit` or `bun run build` for verification.

### 1. Planning Requirements

When creating implementation plans, always include:
- Do's and Don'ts specific to the task
- Code samples demonstrating the expected patterns
- Reference relevant sections of this document

### 2. TypeScript Strictness

- Never use `any` type - always define proper types or use `unknown` with type guards
- Enable and respect all strict TypeScript options
- Prefer explicit return types on exported functions
- Use Zod schemas for runtime validation that infers TypeScript types

### 3. Design System Updates

When making visual changes to the design system (`src/ui/`), always update the `/ui` route (`src/routes/ui.tsx`) to reflect those changes. This includes:

- Adding new components -> Add a showcase section
- Adding new tokens (colors, spacing, etc.) -> Update the relevant section
- Modifying component APIs -> Update the examples
- Removing features -> Remove from showcase

The `/ui` route serves as the living documentation for the design system.

### 4. Test-Driven Development (TDD)

Practice TDD where possible:
1. Write the test first - define expected behavior before implementation
2. Red - verify the test fails
3. Green - implement minimal code to pass
4. Refactor - clean up while keeping tests green

For TanStack Start, test:
- Server functions in isolation
- Route loaders with mocked server functions
- Components with mocked loader data

```tsx
// Example: Test server function first
describe('fetchPost', () => {
  it('returns post data for valid id', async () => {
    const post = await fetchPost({ data: '1' })
    expect(post).toHaveProperty('title')
  })

  it('throws notFound for invalid id', async () => {
    await expect(fetchPost({ data: 'invalid' }))
      .rejects.toThrow()
  })
})
```

### 4.1 Games and Features Testing

All games and interactive features MUST be tested. Each subsystem should be verifiable independently, without requiring the full environment (Three.js scene, React components, etc.).

#### Testing Guidelines for Games

1. Isolate subsystems - Game logic (physics, collision, AI) should be testable without rendering
2. Pure functions preferred - Movement calculations, collision detection, and state transitions should be pure
3. Mock external dependencies - Three.js objects, DOM, and React context should be mocked when testing logic
4. Use `bun test` - All tests run with Bun's built-in test runner

#### What to Test

| System | Test Cases |
|--------|------------|
| Movement/Grid | Direction calculations, boundary clamping, angle conversions |
| Collision | Wall detection, trail intersection, cycle-to-cycle collision |
| AI | Decision making, obstacle avoidance, path finding |
| State | Reducer actions, state transitions, score tracking |
| Physics | Velocity, gravity, jump arcs, interpolation |

#### Test File Organization

```
src/games/lightcycle/
├── engine/
│   ├── GridSystem.ts
│   ├── GridSystem.test.ts       # Co-located tests
│   ├── CollisionSystem.ts
│   ├── CollisionSystem.test.ts
│   └── AIController.test.ts
├── state/
│   └── GameContext.test.ts
```

Run tests: `bun test src/games/`

### 5. GPU Shaders

Always use TypeGPU for all GPU/shader work. Never use raw WebGPU APIs directly. See [docs/typegpu.md](docs/typegpu.md) for the full API reference.

---

## Overview
This is a full-stack React application built with TanStack Start - a type-safe, full-stack React framework powered by TanStack Router and Nitro.

## Tech Stack
- Framework: TanStack Start v1.159+
- Runtime: Bun
- Server: Nitro (same as Nuxt)
- Styling: Tailwind CSS v4
- Language: TypeScript
- React: v19
- GPU Computing: TypeGPU v0.9+
- 3D Graphics: Three.js v0.182+

---

## Project Structure

```
src/
├── routes/                    # File-based routes
│   ├── __root.tsx            # Root layout (HTML shell)
│   ├── index.tsx             # Home page (/)
│   ├── posts.tsx             # /posts layout
│   ├── posts.index.tsx       # /posts index
│   ├── posts.$postId.tsx     # /posts/:postId
│   ├── api/                  # API routes
│   │   └── users.ts          # /api/users
│   └── _pathlessLayout/      # Pathless layout group
├── components/               # Shared components
├── utils/                    # Server functions, helpers
├── styles/                   # CSS files
├── router.tsx               # Router configuration
└── routeTree.gen.ts         # Auto-generated route tree
```

---

## Commands

```bash
bun dev        # Start dev server (port 3000)
bun run build  # Build for production
bun run preview # Preview production build
bun start      # Run production server
```

---

## TanStack Start

File-based routing, server functions, middleware, and common patterns for TanStack Start. Covers `createServerFn`, `createFileRoute`, `createMiddleware`, navigation utilities, deferred data, auth middleware, form mutations, search params, API routes, and router configuration.

See [docs/tanstack-start.md](docs/tanstack-start.md) for the full reference.

### Do's and Don'ts

#### Route Loaders

| DO | DON'T |
|----|-------|
| Use `createServerFn` for server-only operations (DB, secrets) | Put secrets/env vars directly in loaders (they're exposed to client) |
| Return only serializable data from loaders | Return functions, classes, or non-serializable objects |
| Use `loaderDeps` to specify which search params trigger reloads | Return entire `search` object in `loaderDeps` (causes unnecessary reloads) |
| Use TanStack Query in loaders for caching | Fetch without caching (causes duplicate requests on navigation) |
| Call server functions from loaders for server-only code | Assume loaders only run on the server (they're isomorphic) |

#### Server Functions

| DO | DON'T |
|----|-------|
| Use `inputValidator` with Zod for runtime type safety | Trust client input without validation |
| Keep server functions focused (single responsibility) | Bundle unrelated operations in one function |
| Use `{ method: 'POST' }` for mutations | Use GET for operations with side effects |
| Throw `notFound()` for missing resources | Return null/undefined for 404 cases |
| Access env vars and DB connections inside server functions | Import server-only modules at file top-level in shared files |

#### Middleware

| DO | DON'T |
|----|-------|
| Use `sendContext` to pass data between client and server | Access browser APIs (`localStorage`, `window`) in client middleware during SSR |
| Chain middleware with `.middleware([parent])` for composition | Duplicate logic across multiple middleware |
| Use `AsyncLocalStorage` for trace context across nested calls | Pass trace IDs manually through every function |
| Modify `result.response.headers` in server middleware | Mutate request headers directly |

#### beforeLoad vs loader

| DO | DON'T |
|----|-------|
| Use `beforeLoad` for auth checks and redirects | Fetch data in `beforeLoad` (use `loader` instead) |
| Throw `redirect()` from `beforeLoad` for auth guards | Throw `notFound()` from `beforeLoad` (always triggers root 404) |
| Pass context from `beforeLoad` to `loader` via return value | Duplicate auth logic in both hooks |

#### Components

| DO | DON'T |
|----|-------|
| Use `Route.useLoaderData()` for type-safe data access | Use `useLoaderData` hook without route context |
| Wrap deferred data with `<Suspense>` and `<Await>` | Await deferred promises in component body |
| Use `<Link>` with `params` and `search` props | Build URLs manually with string concatenation |
| Define `errorComponent` per-route for granular errors | Rely only on root error boundary |

---

## TypeGPU

Type-safe WebGPU toolkit for writing GPU shaders in TypeScript. Covers roots, data schemas, buffers, GPU functions, compute/render pipelines, textures, vertex layouts, and the standard library.

See [docs/typegpu.md](docs/typegpu.md) for the full reference.

---

## Three.js

3D graphics library covering scene setup, cameras, geometries, materials, lights, textures, scene graph hierarchy, OrbitControls, GLTF loading, shadows, resource cleanup, and on-demand rendering.

See [docs/threejs.md](docs/threejs.md) for the full reference.

---

## Modern CSS (2024-2026)

Cutting-edge CSS features including scroll-driven animations, container queries, `:has()`, nesting, `@scope`, `@starting-style`, `@layer`, modern color functions, anchor positioning, `@property`, typed `attr()`, `sibling-index()`/`sibling-count()`, subgrid, and view transitions. Includes browser support tables and feature detection patterns.

See [docs/modern-css.md](docs/modern-css.md) for the full reference.

---

## Modern HTML (2024-2026)

Native HTML features including customizable `<select>`, Popover API, dialog enhancements, invoker commands, details/summary improvements, and interest invokers for tooltips.

See [docs/modern-html.md](docs/modern-html.md) for the full reference.
