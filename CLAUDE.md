# Project Documentation

## Agent Instructions

When working on this codebase, follow these directives:

### 1. Planning Requirements

When creating implementation plans, always include:
- **Do's and Don'ts** specific to the task
- **Code samples** demonstrating the expected patterns
- Reference relevant sections of this document

Example plan structure:
```markdown
## Task: Add user profile page

### Approach
Create `/users/$userId` route with server function for data fetching.

### Do's
- Use `createServerFn` for fetching user data
- Validate `userId` param with Zod
- Define `notFoundComponent` for missing users

### Don'ts
- Don't fetch user data directly in loader (use server function)
- Don't expose sensitive user fields to client

### Code Sample
```tsx
const fetchUser = createServerFn({ method: 'GET' })
  .inputValidator(z.string().uuid())
  .handler(async ({ data: userId }) => {
    const user = await db.users.findUnique({ where: { id: userId } })
    if (!user) throw notFound()
    return { id: user.id, name: user.name }  // Exclude sensitive fields
  })
```
```

### 2. TypeScript Strictness

- **Never use `any` type** - always define proper types or use `unknown` with type guards
- Enable and respect all strict TypeScript options
- Prefer explicit return types on exported functions
- Use Zod schemas for runtime validation that infers TypeScript types

```tsx
// ✅ Good
const fetchPost = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => id)
  .handler(async ({ data }): Promise<Post> => {
    return db.posts.findUnique({ where: { id: data } })
  })

// ❌ Bad
const fetchPost = createServerFn()
  .handler(async ({ data }: any) => {  // Never use `any`
    return data
  })
```

### 3. Design System Updates

When making visual changes to the design system (`src/ui/`), **always update the `/ui` route** (`src/routes/ui.tsx`) to reflect those changes. This includes:

- Adding new components → Add a showcase section
- Adding new tokens (colors, spacing, etc.) → Update the relevant section
- Modifying component APIs → Update the examples
- Removing features → Remove from showcase

The `/ui` route serves as the living documentation for the design system.

### 4. Test-Driven Development (TDD)

Practice TDD where possible:
1. **Write the test first** - define expected behavior before implementation
2. **Red** - verify the test fails
3. **Green** - implement minimal code to pass
4. **Refactor** - clean up while keeping tests green

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

---

## Overview
This is a full-stack React application built with **TanStack Start** - a type-safe, full-stack React framework powered by TanStack Router and Nitro.

## Tech Stack
- **Framework**: TanStack Start v1.159+
- **Runtime**: Bun
- **Server**: Nitro (same as Nuxt)
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript
- **React**: v19
- **GPU Computing**: TypeGPU v0.9+
- **3D Graphics**: Three.js v0.182+

---

## TanStack Start Architecture

### File-Based Routing

Routes are defined in `src/routes/`. The file path maps to the URL structure.

#### Route File Naming Conventions

| File Pattern | URL | Description |
|-------------|-----|-------------|
| `index.tsx` | `/` | Index route |
| `posts.tsx` | `/posts` | Static route with layout |
| `posts.index.tsx` | `/posts` | Index of nested route |
| `posts.$postId.tsx` | `/posts/:postId` | Dynamic segment |
| `posts_.$postId.deep.tsx` | `/posts/:postId/deep` | Pathless layout escape (`_` prefix) |
| `_pathlessLayout.tsx` | (no URL segment) | Pathless layout wrapper |
| `_pathlessLayout/_nested-layout.tsx` | (no URL segment) | Nested pathless layout |
| `api/users.ts` | `/api/users` | API route (server only) |
| `customScript[.]js.ts` | `/customScript.js` | Escape special chars with `[.]` |

#### Special Files
- `__root.tsx` - Root layout containing `<html>`, `<head>`, `<body>`, wraps all routes

### Creating Routes

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  // Data loading (runs on server during SSR)
  loader: ({ params }) => fetchPost(params.postId),

  // Components
  component: PostComponent,
  errorComponent: PostErrorComponent,
  notFoundComponent: () => <NotFound />,

  // Lifecycle hooks
  beforeLoad: async ({ params, context }) => {
    // Runs before loader, good for auth checks
  },
})

function PostComponent() {
  const post = Route.useLoaderData()  // Type-safe loader data
  return <div>{post.title}</div>
}
```

### Server Functions (`createServerFn`)

Server functions are RPC-style functions that run on the server but can be called from the client.

```tsx
import { createServerFn } from '@tanstack/react-start'

// Basic server function
export const fetchPosts = createServerFn().handler(async () => {
  const res = await fetch('https://api.example.com/posts')
  return res.json()
})

// With input validation
export const fetchPost = createServerFn({ method: 'POST' })
  .inputValidator((id: string) => id)  // Validates input
  .handler(async ({ data }) => {
    // `data` is the validated input
    const res = await fetch(`https://api.example.com/posts/${data}`)
    if (!res.ok) {
      if (res.status === 404) throw notFound()
      throw new Error('Failed to fetch')
    }
    return res.json()
  })

// Usage in loader
loader: ({ params }) => fetchPost({ data: params.postId })

// Usage in component (client-side call)
const post = await fetchPost({ data: '123' })
```

### API Routes

API routes use the same file-based routing but define HTTP handlers instead of components.

```tsx
// src/routes/api/users.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/users')({
  server: {
    middleware: [authMiddleware],  // Optional middleware
    handlers: {
      GET: async ({ request }) => {
        const data = await fetchUsers()
        return Response.json(data)
      },
      POST: async ({ request }) => {
        const body = await request.json()
        // Handle POST
        return Response.json({ success: true })
      },
    },
  },
})

// Dynamic API route: /api/users/$userId.ts
export const Route = createFileRoute('/api/users/$userId')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        // params.userId is available
        return Response.json({ id: params.userId })
      },
    },
  },
})
```

### Middleware

Middleware can run on client, server, or both. Use for logging, auth, headers, etc.

```tsx
import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

// Server-only middleware
const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders()
  console.info('Request Headers:', headers)

  const result = await next()

  // Modify response headers
  result.response.headers.set('x-custom-header', 'value')
  return result
})

// Client + Server middleware with context passing
const loggingMiddleware = createMiddleware({ type: 'function' })
  .client(async (ctx) => {
    const clientTime = new Date()
    return ctx.next({
      context: { clientTime },        // Available in this middleware
      sendContext: { clientTime },    // Sent to server
    })
  })
  .server(async (ctx) => {
    const serverTime = new Date()
    return ctx.next({
      sendContext: {
        serverTime,
        durationToServer: serverTime.getTime() - ctx.context.clientTime.getTime(),
      },
    })
  })

// Composing middleware
const composedMiddleware = createMiddleware()
  .middleware([parentMiddleware])  // Run parent first
  .server(async ({ next }) => {
    // This runs after parent
    return next()
  })
```

### Deferred Data & Streaming

Return promises without awaiting to stream data to the client.

```tsx
import { Await, createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

export const Route = createFileRoute('/dashboard')({
  loader: async () => ({
    // Awaited - blocks render
    user: await fetchUser(),

    // Deferred - streams after initial render
    notifications: fetchNotifications(),  // No await!
    analytics: slowAnalyticsQuery(),
  }),
  component: Dashboard,
})

function Dashboard() {
  const { user, notifications, analytics } = Route.useLoaderData()

  return (
    <div>
      {/* Immediately available */}
      <h1>Welcome {user.name}</h1>

      {/* Streams in when ready */}
      <Suspense fallback={<Spinner />}>
        <Await promise={notifications}>
          {(data) => <NotificationList items={data} />}
        </Await>
      </Suspense>
    </div>
  )
}
```

### Redirects

```tsx
import { redirect, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/old-path')({
  beforeLoad: () => {
    throw redirect({ to: '/new-path' })
  },
})

// Conditional redirect (e.g., auth)
beforeLoad: async ({ context }) => {
  if (!context.user) {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
}
```

### Navigation

```tsx
import { Link, useNavigate } from '@tanstack/react-router'

// Declarative navigation
<Link
  to="/posts/$postId"
  params={{ postId: '123' }}
  search={{ sort: 'date' }}
  activeProps={{ className: 'font-bold' }}
  activeOptions={{ exact: true }}
>
  View Post
</Link>

// Programmatic navigation
const navigate = useNavigate()
navigate({ to: '/posts', search: { page: 2 } })
```

### Root Layout (`__root.tsx`)

The root layout defines the HTML shell and global providers.

```tsx
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
    ],
    scripts: [
      { src: '/analytics.js', type: 'text/javascript' },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: NotFound,
  shellComponent: RootDocument,  // The HTML shell
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />  {/* Injects head() content */}
      </head>
      <body>
        {children}
        <Scripts />  {/* Required for hydration */}
      </body>
    </html>
  )
}
```

### Router Configuration

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'  // Auto-generated

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',       // Preload on hover/focus
    defaultErrorComponent: ErrorBoundary,
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,        // Restore scroll position
  })
}
```

### Vite Configuration

```ts
// vite.config.ts
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({ srcDirectory: 'src' }),
    viteReact(),
    nitro(),
  ],
})
```

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

## Best Practices

### Data Fetching
1. Use `createServerFn` for data that needs server-side execution
2. Prefer `loader` over `useEffect` for initial data
3. Use deferred data (no `await`) for non-critical data to improve TTFB
4. Use `inputValidator` for type-safe server function inputs

### Error Handling
1. Define `errorComponent` on routes for granular error boundaries
2. Use `notFoundComponent` for 404 states within routes
3. Throw `notFound()` from server functions for 404 responses
4. Throw `redirect()` from `beforeLoad` for auth redirects

### Layouts
1. Use pathless layouts (`_prefix`) for shared UI without URL segments
2. Use `<Outlet />` to render child routes
3. Define common data fetching in parent route loaders

### Performance
1. Enable `defaultPreload: 'intent'` for instant navigation
2. Use deferred data streaming for slow queries
3. Keep server functions focused and minimal

---

## Do's and Don'ts

### Route Loaders

| DO | DON'T |
|----|-------|
| Use `createServerFn` for server-only operations (DB, secrets) | Put secrets/env vars directly in loaders (they're exposed to client) |
| Return only serializable data from loaders | Return functions, classes, or non-serializable objects |
| Use `loaderDeps` to specify which search params trigger reloads | Return entire `search` object in `loaderDeps` (causes unnecessary reloads) |
| Use TanStack Query in loaders for caching | Fetch without caching (causes duplicate requests on navigation) |
| Call server functions from loaders for server-only code | Assume loaders only run on the server (they're isomorphic) |

### Server Functions

| DO | DON'T |
|----|-------|
| Use `inputValidator` with Zod for runtime type safety | Trust client input without validation |
| Keep server functions focused (single responsibility) | Bundle unrelated operations in one function |
| Use `{ method: 'POST' }` for mutations | Use GET for operations with side effects |
| Throw `notFound()` for missing resources | Return null/undefined for 404 cases |
| Access env vars and DB connections inside server functions | Import server-only modules at file top-level in shared files |

### Middleware

| DO | DON'T |
|----|-------|
| Use `sendContext` to pass data between client and server | Access browser APIs (`localStorage`, `window`) in client middleware during SSR |
| Chain middleware with `.middleware([parent])` for composition | Duplicate logic across multiple middleware |
| Use `AsyncLocalStorage` for trace context across nested calls | Pass trace IDs manually through every function |
| Modify `result.response.headers` in server middleware | Mutate request headers directly |

### beforeLoad vs loader

| DO | DON'T |
|----|-------|
| Use `beforeLoad` for auth checks and redirects | Fetch data in `beforeLoad` (use `loader` instead) |
| Throw `redirect()` from `beforeLoad` for auth guards | Throw `notFound()` from `beforeLoad` (always triggers root 404) |
| Pass context from `beforeLoad` to `loader` via return value | Duplicate auth logic in both hooks |

### Components

| DO | DON'T |
|----|-------|
| Use `Route.useLoaderData()` for type-safe data access | Use `useLoaderData` hook without route context |
| Wrap deferred data with `<Suspense>` and `<Await>` | Await deferred promises in component body |
| Use `<Link>` with `params` and `search` props | Build URLs manually with string concatenation |
| Define `errorComponent` per-route for granular errors | Rely only on root error boundary |

---

## API Quick Reference

### createServerFn

```tsx
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// Full API
const myServerFn = createServerFn({ method: 'GET' | 'POST' })
  .middleware([middleware1, middleware2])     // Optional: attach middleware
  .inputValidator(zodSchema)                   // Optional: validate input
  .handler(async ({ data, context }) => {     // Required: the handler
    // data = validated input
    // context = middleware context
    return result  // Must be serializable
  })

// Calling
const result = await myServerFn({ data: input })
```

### createFileRoute

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/path/$param')({
  // Lifecycle (execution order: 1 → 2 → 3)
  beforeLoad: async ({ params, search, context, location }) => {
    // 1. Runs first, good for auth/redirects
    // Return value merges into context for loader
    return { user: await getUser() }
  },

  loaderDeps: ({ search }) => ({ page: search.page }),  // 2. Declare search param dependencies

  loader: async ({ params, context, deps }) => {
    // 3. Fetch data, has access to beforeLoad context
    return fetchData(params.id, deps.page)
  },

  // Components
  component: MyComponent,
  pendingComponent: () => <Loading />,
  errorComponent: ({ error, reset }) => <Error error={error} onRetry={reset} />,
  notFoundComponent: () => <NotFound />,

  // Head management
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData.title }],
  }),

  // SSR options
  ssr: true | false,  // Enable/disable SSR for this route
})
```

### createMiddleware

```tsx
import { createMiddleware } from '@tanstack/react-start'

const middleware = createMiddleware({ type: 'function' | 'route' })
  .middleware([parentMiddleware])  // Optional: compose with parent

  .client(async ({ next, context, sendContext }) => {
    // Runs on client before server call
    const result = await next({
      context: { localData },        // Available in this middleware only
      sendContext: { toServer },     // Sent to server
    })
    // result.context has server's sendContext
    return result
  })

  .server(async ({ next, context, sendContext }) => {
    // Runs on server
    const result = await next({
      sendContext: { toClient },     // Sent back to client
    })
    result.response.headers.set('x-header', 'value')
    return result
  })
```

### Navigation Utilities

```tsx
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
  useLoaderData,
  redirect,
  notFound,
} from '@tanstack/react-router'

// Redirect (throw in beforeLoad/loader)
throw redirect({
  to: '/path',
  search: { returnUrl: location.href },
  replace: true,  // Replace history entry
})

// Not found (throw in loader/server function)
throw notFound()

// Programmatic navigation
const navigate = useNavigate()
await navigate({
  to: '/path/$id',
  params: { id: '123' },
  search: { tab: 'details' },
  replace: false,
})
```

### Deferred Data

```tsx
import { Await } from '@tanstack/react-router'
import { Suspense } from 'react'

// In loader: return promise without await
loader: () => ({
  critical: await fetchCritical(),  // Blocks render
  deferred: fetchSlow(),            // Streams later (no await)
})

// In component
<Suspense fallback={<Skeleton />}>
  <Await promise={loaderData.deferred}>
    {(data) => <Content data={data} />}
  </Await>
</Suspense>
```

---

## Common Patterns

### Protected Routes with Auth Middleware

```tsx
// utils/authMiddleware.ts
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await getSession()
  if (!session) {
    throw redirect({ to: '/login' })
  }
  return next({ context: { user: session.user } })
})

// routes/dashboard.tsx
export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ context }) => {
    // context.user available from middleware
  },
})
```

### Form Mutations with Server Functions

```tsx
const createPost = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ title: z.string(), body: z.string() }))
  .handler(async ({ data }) => {
    const post = await db.posts.create(data)
    return post
  })

// In component
async function handleSubmit(formData: FormData) {
  const result = await createPost({
    data: {
      title: formData.get('title') as string,
      body: formData.get('body') as string,
    },
  })
  navigate({ to: '/posts/$postId', params: { postId: result.id } })
}
```

### Search Params with Type Safety

```tsx
import { z } from 'zod'

const searchSchema = z.object({
  page: z.number().default(1),
  sort: z.enum(['date', 'title']).default('date'),
})

export const Route = createFileRoute('/posts')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ deps }) => fetchPosts(deps.page),
  component: () => {
    const { page, sort } = Route.useSearch()  // Type-safe
  },
})
```

---

## TypeGPU

TypeGPU is a type-safe WebGPU toolkit that enables writing GPU shaders in TypeScript with full type inference.

### Setup

TypeGPU is configured in this project with:
- `typegpu` - Core library
- `@webgpu/types` - TypeScript WebGPU type definitions
- `unplugin-typegpu` - Build plugin for shader transpilation

### Core Concepts

#### Roots

Roots are typed wrappers around WebGPU devices that manage resource allocation and lifecycle.

```typescript
import tgpu from 'typegpu'

// Initialize with default device
const root = await tgpu.init()

// From existing device
const root = tgpu.initFromDevice({ device })

// Access underlying device
const device = root.device

// Cleanup
root.destroy()
```

#### Data Schemas

TypeGPU provides schemas for type-safe GPU data representation.

```typescript
import * as d from 'typegpu/data'

// Primitives
d.f32    // 32-bit float
d.f16    // 16-bit float
d.u32    // unsigned 32-bit int
d.i32    // signed 32-bit int
d.bool   // boolean

// Vectors (2, 3, 4 components)
d.vec2f, d.vec3f, d.vec4f  // float vectors
d.vec2i, d.vec3i, d.vec4i  // int vectors
d.vec2u, d.vec3u, d.vec4u  // unsigned int vectors
d.vec2h, d.vec3h, d.vec4h  // half-precision vectors

// Matrices
d.mat2x2f, d.mat3x3f, d.mat4x4f  // square float matrices

// Structs
const Particle = d.struct({
  position: d.vec3f,
  velocity: d.vec3f,
  lifetime: d.f32,
})

// Arrays
d.arrayOf(d.vec3f, 100)  // fixed-size array
d.disarrayOf(d.vec3f)    // dynamic array (for vertex layouts)

// Constructors
d.vec3f(1, 2, 3)         // create vector
d.vec3f(1)               // broadcast: (1, 1, 1)
Particle({ position: d.vec3f(0, 0, 0), velocity: d.vec3f(1, 0, 0), lifetime: 5.0 })
```

#### Buffers

Buffers allocate GPU memory with automatic size calculation and type-safe operations.

```typescript
// Create buffer with schema and optional initial value
const positionBuffer = root.createBuffer(d.vec3f, d.vec3f(0, 0, 0))

// Array buffer
const particlesBuffer = root.createBuffer(
  d.arrayOf(Particle, 1000),
  initialParticles
)

// Declare usage flags (required before shader binding)
positionBuffer.$usage('uniform')
particlesBuffer.$usage('storage')

// Available flags: 'uniform', 'storage', 'vertex'

// Write data
positionBuffer.write(d.vec3f(1, 2, 3))

// Read data (async)
const position = await positionBuffer.read()

// Wrap existing GPUBuffer
const typedBuffer = root.createBuffer(d.u32, existingGPUBuffer)
```

#### GPU Functions

Functions marked with `'use gpu'` are transpiled to WGSL by the build plugin.

```typescript
import * as std from 'typegpu/std'

// Basic function
const lerp = (a: number, b: number, t: number) => {
  'use gpu'
  return a + (b - a) * t
}

// Vector math (use std namespace)
const normalize = (v: d.Vec3f) => {
  'use gpu'
  return std.normalize(v)
}

// Type inference from call site
const addVectors = (a: d.Vec3f, b: d.Vec3f) => {
  'use gpu'
  return std.add(a, b)  // Inferred as Vec3f
}

// Numeric literals
// - Integers default to i32
// - Decimals default to f32
// - Explicit cast: d.u32(1), d.f16(3.14)
```

#### Function Shells (Explicit Signatures)

Define explicit type signatures for functions:

```typescript
const clampedLerp = tgpu.fn(
  [d.f32, d.f32, d.f32],  // argument types
  d.f32                    // return type
)((a, b, t) => {
  'use gpu'
  return std.clamp(a + (b - a) * t, 0, 1)
})
```

#### WGSL Direct Implementation

Write WGSL directly when needed:

```typescript
const customFn = tgpu.fn([d.f32, d.f32], d.f32)`
  (a: f32, b: f32) -> f32 {
    return a * b + 0.5;
  }
`
```

#### Compute Pipelines

```typescript
// Simple compute pipeline with bounds checking
const pipeline = root['~unstable'].createGuardedComputePipeline((x) => {
  'use gpu'
  // x = global invocation ID
  const value = particlesBuffer[x].position
  outputBuffer[x] = std.length(value)
})

// Execute with exact thread count
pipeline.dispatchThreads(1000)

// With bind groups
pipeline
  .with(bindGroup)
  .dispatchThreads(1000)

// Standard compute pipeline
const computePipeline = root['~unstable']
  .withCompute(computeShader)
  .createPipeline()

computePipeline.dispatchWorkgroups(10, 10, 1)
```

#### Render Pipelines

```typescript
const renderPipeline = root['~unstable']
  .withVertex(vertexShader, { position: positionLayout })
  .withFragment(fragmentShader, { format: 'rgba8unorm' })
  .withPrimitive({ topology: 'triangle-list' })
  .createPipeline()

renderPipeline
  .withColorAttachment({
    view: textureView,
    loadOp: 'clear',
    storeOp: 'store',
  })
  .with(vertexLayout, vertexBuffer)
  .draw(3)
```

#### Textures

```typescript
const texture = root['~unstable'].createTexture({
  size: [256, 256],
  format: 'rgba8unorm',
  mipLevelCount: 4,
})
  .$usage('sampled', 'render')

// Write from image
const imageBitmap = await createImageBitmap(blob)
texture.write(imageBitmap)

// Generate mipmaps (requires 'sampled' + 'render' usage)
texture.generateMipmaps()

// Create view for shader binding
const view = texture.createView(d.texture2d(d.f32))

// Samplers
const sampler = root['~unstable'].createSampler({
  magFilter: 'linear',
  minFilter: 'linear',
  mipmapFilter: 'linear',
})
```

#### Vertex Layouts

```typescript
const VertexData = d.struct({
  position: d.location(0, d.vec3f),
  normal: d.location(1, d.vec3f),
  uv: d.location(2, d.vec2f),
})

const vertexLayout = tgpu.vertexLayout(
  d.arrayOf(VertexData),
  'vertex'  // or 'instance'
)

// Loose layouts (bypass alignment, use vertex formats)
const LooseVertex = d.unstruct({
  position: d.location(0, d.vec3f),
  color: d.location(1, d.unorm8x4),  // 8-bit normalized
})

const looseLayout = tgpu.vertexLayout(d.disarrayOf(LooseVertex))
```

#### Standard Library (`typegpu/std`)

```typescript
import * as std from 'typegpu/std'

// Math
std.abs, std.sin, std.cos, std.sqrt, std.pow
std.min, std.max, std.clamp, std.mix, std.step

// Vector
std.dot, std.cross, std.normalize, std.length, std.distance
std.reflect, std.refract

// Matrix
std.transpose, std.determinant, std.mul
std.identity2, std.identity3, std.identity4

// Arithmetic (for vectors/matrices)
std.add, std.sub, std.mul, std.div, std.neg

// Comparison
std.eq, std.ne, std.lt, std.le, std.gt, std.ge

// Texture
std.textureSample, std.textureLoad, std.textureStore

// Atomic
std.atomicAdd, std.atomicLoad, std.atomicStore, std.atomicMax

// Barriers
std.workgroupBarrier, std.storageBarrier
```

#### Debugging

```typescript
const debugFn = () => {
  'use gpu'
  console.log('Debug from GPU')  // Outputs with [GPU] prefix
}
```

---

### TypeGPU Do's and Don'ts

| DO | DON'T |
|----|-------|
| Use `'use gpu'` directive for GPU functions | Forget the directive (function won't be transpiled) |
| Use `std.*` functions for vector/matrix math | Use `+`, `-`, `*` operators on vectors (not supported) |
| Use `d.u32()`, `d.f32()` for explicit numeric types | Assume numeric type inference matches your intent |
| Declare `.$usage()` before binding buffers | Bind buffers without usage flags |
| Use `createGuardedComputePipeline` for simple tasks | Create complex pipeline setups for basic computations |
| Use `d.location()` for vertex attributes | Forget location markers (shader won't compile) |
| Use `d.struct()` for aligned data (uniforms/storage) | Use `d.struct()` for vertex buffers (use `d.unstruct()`) |
| Access outer scope values as compile-time constants | Expect outer scope mutations to affect shader |
| Use `AsyncLocalStorage` patterns for context | Pass context manually through deeply nested calls |

### TypeGPU API Quick Reference

```typescript
import tgpu from 'typegpu'
import * as d from 'typegpu/data'
import * as std from 'typegpu/std'

// Initialize
const root = await tgpu.init()

// Buffer
const buf = root.createBuffer(schema, initialValue?)
buf.$usage('uniform' | 'storage' | 'vertex')
buf.write(data)
const data = await buf.read()

// Function
const fn = (args) => { 'use gpu'; return result }
const fn = tgpu.fn([argTypes], returnType)((args) => { 'use gpu'; ... })
const fn = tgpu.fn([argTypes], returnType)`wgsl code`

// Compute
const pipeline = root['~unstable'].createGuardedComputePipeline(fn)
pipeline.dispatchThreads(count)

// Texture
const tex = root['~unstable'].createTexture({ size, format })
tex.$usage('sampled' | 'storage' | 'render')
tex.write(imageSource)
tex.generateMipmaps()
const view = tex.createView(d.texture2d(d.f32))

// Sampler
const sampler = root['~unstable'].createSampler({ magFilter, minFilter })

// Vertex Layout
const layout = tgpu.vertexLayout(d.arrayOf(VertexStruct), stepMode?)

// Unwrap to WebGPU
const gpuBuffer = root.unwrap(typedBuffer)
const gpuLayout = root.unwrap(bindGroupLayout)
```

---

## Three.js

Three.js is a 3D graphics library that abstracts WebGL, providing scene graphs, materials, lights, cameras, and more.

### Core Architecture

```
┌─────────────┐
│  Renderer   │ ─── Draws scene to canvas
└──────┬──────┘
       │
┌──────┴──────┐
│    Scene    │ ─── Root of scene graph
└──────┬──────┘
       │
┌──────┴──────────────────────────────┐
│                                      │
▼                                      ▼
┌─────────┐                    ┌───────────┐
│  Mesh   │                    │   Light   │
├─────────┤                    └───────────┘
│Geometry │ ─ Shape (vertices)
│Material │ ─ Appearance (color, texture)
└─────────┘
```

### Basic Setup

```typescript
import * as THREE from 'three'

// Renderer
const canvas = document.querySelector('#canvas') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas })

// Scene
const scene = new THREE.Scene()

// Camera
const fov = 75                    // Field of view (degrees, vertical)
const aspect = canvas.clientWidth / canvas.clientHeight
const near = 0.1                  // Near clipping plane
const far = 1000                  // Far clipping plane
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
camera.position.z = 5

// Mesh = Geometry + Material
const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshPhongMaterial({ color: 0x44aa88 })
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

// Light (required for MeshPhongMaterial)
const light = new THREE.DirectionalLight(0xffffff, 3)
light.position.set(-1, 2, 4)
scene.add(light)

// Animation loop
function animate(time: number) {
  time *= 0.001  // Convert to seconds
  cube.rotation.x = time
  cube.rotation.y = time
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
requestAnimationFrame(animate)
```

### Responsive Canvas

```typescript
function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer): boolean {
  const canvas = renderer.domElement
  const pixelRatio = window.devicePixelRatio
  const width = Math.floor(canvas.clientWidth * pixelRatio)
  const height = Math.floor(canvas.clientHeight * pixelRatio)
  const needResize = canvas.width !== width || canvas.height !== height
  if (needResize) {
    renderer.setSize(width, height, false)  // false = don't set CSS
  }
  return needResize
}

function animate(time: number) {
  if (resizeRendererToDisplaySize(renderer)) {
    camera.aspect = canvas.clientWidth / canvas.clientHeight
    camera.updateProjectionMatrix()
  }
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
```

### Camera Types

```typescript
// Perspective (3D depth)
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)

// Orthographic (2D/isometric)
const camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far)
camera.zoom = 1
camera.updateProjectionMatrix()  // Required after changing properties
```

### Common Geometries

```typescript
new THREE.BoxGeometry(width, height, depth)
new THREE.SphereGeometry(radius, widthSegments, heightSegments)
new THREE.PlaneGeometry(width, height)
new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
new THREE.ConeGeometry(radius, height, radialSegments)
new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments)
new THREE.CircleGeometry(radius, segments)
new THREE.RingGeometry(innerRadius, outerRadius, segments)
```

### Materials

```typescript
// Performance: Basic > Lambert > Phong > Standard > Physical

// Not affected by lights
new THREE.MeshBasicMaterial({ color: 0xff0000 })

// Light at vertices only (fast)
new THREE.MeshLambertMaterial({ color: 0xff0000 })

// Light per pixel, specular highlights
new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 30 })

// PBR material
new THREE.MeshStandardMaterial({
  color: 0xff0000,
  roughness: 0.5,  // 0 = mirror, 1 = diffuse
  metalness: 0.5,  // 0 = plastic, 1 = metal
})

// PBR with clearcoat
new THREE.MeshPhysicalMaterial({
  color: 0xff0000,
  roughness: 0.5,
  metalness: 0.5,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
})

// Common options
material.side = THREE.DoubleSide  // Render both sides
material.flatShading = true       // Faceted appearance
material.transparent = true
material.opacity = 0.5
```

### Setting Colors

```typescript
material.color.set(0x00ffff)              // Hex
material.color.set('purple')              // CSS name
material.color.set('rgb(255, 127, 64)')   // RGB
material.color.set('hsl(180, 50%, 25%)')  // HSL
material.color.setHSL(0.5, 1, 0.5)        // HSL (0-1 range)
```

### Light Types

```typescript
// Ambient - even lighting everywhere
new THREE.AmbientLight(color, intensity)

// Hemisphere - sky/ground gradient
new THREE.HemisphereLight(skyColor, groundColor, intensity)

// Directional - parallel rays (sun)
const light = new THREE.DirectionalLight(color, intensity)
light.position.set(x, y, z)
light.target.position.set(x, y, z)
scene.add(light.target)  // Must add target to scene

// Point - radiates from point (bulb)
const light = new THREE.PointLight(color, intensity)
light.position.set(x, y, z)
light.distance = 0  // 0 = infinite

// Spot - cone of light
const light = new THREE.SpotLight(color, intensity)
light.angle = Math.PI / 4        // Cone angle (radians)
light.penumbra = 0.5             // Edge softness (0-1)
scene.add(light.target)

// RectArea - rectangular panel (requires RectAreaLightUniformsLib)
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
RectAreaLightUniformsLib.init()
new THREE.RectAreaLight(color, intensity, width, height)
```

### Textures

```typescript
const loader = new THREE.TextureLoader()

// Basic loading
const texture = loader.load('path/to/texture.jpg')
texture.colorSpace = THREE.SRGBColorSpace  // For color textures
const material = new THREE.MeshBasicMaterial({ map: texture })

// With loading manager (for multiple textures)
const loadManager = new THREE.LoadingManager()
const loader = new THREE.TextureLoader(loadManager)

loadManager.onLoad = () => {
  // All textures loaded
}
loadManager.onProgress = (url, loaded, total) => {
  console.log(`${loaded}/${total} loaded`)
}

// Texture properties
texture.wrapS = THREE.RepeatWrapping
texture.wrapT = THREE.RepeatWrapping
texture.repeat.set(4, 2)           // Repeat 4x horizontal, 2x vertical
texture.offset.set(0.5, 0.25)      // Offset by half/quarter
texture.center.set(0.5, 0.5)       // Rotation center
texture.rotation = Math.PI / 4     // Rotate 45 degrees

// Filtering
texture.magFilter = THREE.LinearFilter    // When enlarged (smooth)
texture.minFilter = THREE.LinearMipmapLinearFilter  // When shrunk (best quality)
```

### Scene Graph & Hierarchy

```typescript
// Object3D for grouping (no geometry/material)
const group = new THREE.Object3D()
scene.add(group)

group.add(mesh1)
group.add(mesh2)

// Children inherit parent transforms
group.position.set(5, 0, 0)  // Both meshes move
group.rotation.y = Math.PI   // Both meshes rotate

// Access children
group.children.forEach(child => { ... })
const found = group.getObjectByName('myMesh')

// World position (after all parent transforms)
const worldPos = new THREE.Vector3()
mesh.getWorldPosition(worldPos)
```

### OrbitControls

```typescript
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0, 0)  // Look-at point
controls.enableDamping = true  // Smooth motion
controls.dampingFactor = 0.05
controls.update()  // Required after manual camera changes

// In animation loop (if damping enabled)
function animate() {
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
```

### Loading GLTF Models

```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const loader = new GLTFLoader()

loader.load('model.gltf', (gltf) => {
  const model = gltf.scene
  scene.add(model)

  // Enable shadows on all meshes
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
})

// Find objects by name
const part = model.getObjectByName('PartName')
```

### Shadows

```typescript
// Enable on renderer
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

// Light must cast shadows
const light = new THREE.DirectionalLight(0xffffff, 1)
light.castShadow = true
light.shadow.mapSize.width = 2048
light.shadow.mapSize.height = 2048
light.shadow.camera.near = 0.5
light.shadow.camera.far = 500

// Objects cast/receive shadows
mesh.castShadow = true
floor.receiveShadow = true
```

### Resource Cleanup

```typescript
// Dispose individual resources
geometry.dispose()
material.dispose()
texture.dispose()

// Remove from scene
scene.remove(mesh)

// ResourceTracker pattern for complex scenes
class ResourceTracker {
  resources = new Set<THREE.Object3D | { dispose(): void }>()

  track<T>(resource: T): T {
    if (resource instanceof THREE.Object3D) {
      this.resources.add(resource)
      this.track((resource as THREE.Mesh).geometry)
      this.track((resource as THREE.Mesh).material)
    } else if (resource && typeof (resource as { dispose?: () => void }).dispose === 'function') {
      this.resources.add(resource as { dispose(): void })
    }
    return resource
  }

  dispose() {
    for (const resource of this.resources) {
      if (resource instanceof THREE.Object3D && resource.parent) {
        resource.parent.remove(resource)
      }
      if ('dispose' in resource) {
        resource.dispose()
      }
    }
    this.resources.clear()
  }
}
```

### On-Demand Rendering

```typescript
let renderRequested = false

function render() {
  renderRequested = false
  controls.update()
  renderer.render(scene, camera)
}

function requestRender() {
  if (!renderRequested) {
    renderRequested = true
    requestAnimationFrame(render)
  }
}

// Render on changes only
controls.addEventListener('change', requestRender)
window.addEventListener('resize', requestRender)
render()  // Initial render
```

---

### Three.js Do's and Don'ts

| DO | DON'T |
|----|-------|
| Call `camera.updateProjectionMatrix()` after changing camera params | Forget to update projection matrix (changes won't apply) |
| Use `MeshStandardMaterial` for realistic PBR rendering | Use `MeshPhongMaterial` for PBR scenes (wrong lighting model) |
| Dispose geometries, materials, textures when done | Let resources accumulate (causes memory leaks) |
| Use `texture.colorSpace = THREE.SRGBColorSpace` for color textures | Leave color space default (washed out colors) |
| Set `material.side = THREE.DoubleSide` for 2D planes | Render single-sided planes that disappear from behind |
| Add `light.target` to scene for directional/spot lights | Forget to add target (light direction won't update) |
| Use `controls.update()` in loop when `enableDamping` is true | Skip update (damping animation won't work) |
| Check `resizeRendererToDisplaySize` each frame | Ignore canvas resize (distorted aspect ratio) |
| Use `Object3D` for grouping transforms | Apply complex math instead of using hierarchy |
| Set `near`/`far` as tight as possible | Use extreme values like 0.0001 and 1000000 (z-fighting) |

### Three.js API Quick Reference

```typescript
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// Setup
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas })
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)

// Mesh
const geometry = new THREE.BoxGeometry(w, h, d)
const material = new THREE.MeshStandardMaterial({ color, roughness, metalness })
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)

// Transform
mesh.position.set(x, y, z)
mesh.rotation.set(x, y, z)  // Radians
mesh.scale.set(x, y, z)
mesh.lookAt(target)

// Lights
scene.add(new THREE.AmbientLight(color, intensity))
scene.add(new THREE.DirectionalLight(color, intensity))

// Textures
const texture = new THREE.TextureLoader().load(url)
texture.colorSpace = THREE.SRGBColorSpace

// Controls
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

// Models
new GLTFLoader().load(url, (gltf) => scene.add(gltf.scene))

// Animation
function animate(time: number) {
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}
requestAnimationFrame(animate)

// Cleanup
geometry.dispose()
material.dispose()
texture.dispose()
scene.remove(mesh)
```

---

## Modern CSS (2024-2026)

This section documents cutting-edge CSS features. Use progressive enhancement and feature queries for production.

### Scroll-Driven Animations

Animate elements based on scroll position instead of time. No JavaScript required.

```css
/* Named scroll timeline on a scroll container */
.scroll-container {
  scroll-timeline: --main-timeline block;
}

/* Animate element based on container's scroll */
.animated-element {
  animation: slide-in linear;
  animation-timeline: --main-timeline;
}

/* Anonymous scroll timeline (self or nearest scroller) */
.self-scroll {
  animation: fade-in linear;
  animation-timeline: scroll(block);  /* or scroll(inline) */
}
```

#### View Timeline (element visibility in viewport)

```css
/* Create timeline based on element entering/leaving scrollport */
section {
  view-timeline: --section-timeline block;
}

section h2 {
  animation: rise 1s ease-out forwards;
  animation-timeline: --section-timeline;
  animation-range: entry 0% cover 30%;  /* when to animate */
}

@keyframes rise {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

#### Animation Range Values
- `entry` - Element entering scrollport
- `cover` - Element fully covering scrollport
- `contain` - Element fully contained in scrollport
- `exit` - Element leaving scrollport

```css
animation-range: entry 0% cover 50%;
animation-range-start: entry 25%;
animation-range-end: exit 75%;
```

### Container Queries

Style elements based on their container's size, not the viewport.

```css
/* Establish a size query container */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* Query the container */
@container card (min-width: 400px) {
  .card-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

/* Shorthand */
.container {
  container: sidebar / inline-size;
}
```

### Scroll-State Container Queries (Chrome 133+)

Query sticky/snapped/scrolled states natively.

```css
/* Establish scroll-state container */
.sticky-header {
  position: sticky;
  top: 0;
  container-type: scroll-state;
}

/* Style when stuck */
@container scroll-state(stuck: top) {
  .sticky-header {
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border-bottom: 2px solid var(--accent);
  }
}

/* Snap container queries */
@container scroll-state(snapped: x) {
  .carousel-item { opacity: 1; }
}
```

### The :has() Selector (Parent Selector)

Select parent elements based on their children.

```css
/* Style card that contains an image */
.card:has(img) {
  padding: 0;
}

/* Style form with invalid inputs */
form:has(:invalid) {
  border-color: red;
}

/* Style label when adjacent input is focused */
label:has(+ input:focus) {
  color: var(--accent);
}

/* Conditional layout based on content */
.grid:has(> :nth-child(4)) {
  grid-template-columns: repeat(2, 1fr);
}
```

### CSS Nesting

Native CSS nesting without preprocessors.

```css
.card {
  background: white;

  & .title {
    font-size: 1.5rem;
  }

  &:hover {
    background: #f5f5f5;
  }

  @media (width >= 768px) {
    padding: 2rem;
  }
}
```

### @scope

Scope styles to a DOM subtree without specificity issues.

```css
@scope (.card) to (.card__footer) {
  /* Only applies between .card and .card__footer */
  :scope {
    padding: 1rem;
  }

  .button {
    font-weight: 600;
  }
}
```

### @starting-style

Define initial styles for enter transitions (fixes the "flash" problem).

```css
.toast {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 200ms, transform 200ms;
}

@starting-style {
  .toast {
    opacity: 0;
    transform: translateY(12px);
  }
}
```

### @layer

Control cascade order explicitly.

```css
@layer reset, base, components, utilities;

@layer reset {
  * { margin: 0; box-sizing: border-box; }
}

@layer components {
  .button { /* component styles */ }
}

@layer utilities {
  .hidden { display: none !important; }
}
```

### Modern Color Functions

```css
:root {
  /* OKLCH - perceptually uniform color space */
  --brand: oklch(0.62 0.16 35);

  /* Derive colors with relative syntax */
  --brand-light: oklch(from var(--brand) calc(l + 0.2) c h);
  --brand-dark: oklch(from var(--brand) calc(l - 0.1) c h);

  /* Mix colors */
  --brand-soft: color-mix(in oklch, var(--brand), white 65%);

  /* Light/dark mode in one declaration */
  --surface: light-dark(#ffffff, #0a0a0a);
  --text: light-dark(#171717, #fafafa);
}

/* Enable light-dark() */
:root { color-scheme: light dark; }
```

### Anchor Positioning

Position elements relative to an "anchor" element without JavaScript.

```css
/* Define an anchor */
.trigger {
  anchor-name: --tooltip-anchor;
}

/* Position relative to anchor */
.tooltip {
  position: fixed;
  position-anchor: --tooltip-anchor;

  /* Position using anchor() function */
  top: anchor(bottom);
  left: anchor(center);
  translate: -50% 8px;

  /* Or use position-area for common patterns */
  position-area: bottom center;
}
```

### @property (Typed Custom Properties)

Define custom properties with types for animation.

```css
@property --hue {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.element {
  --hue: 0deg;
  background: hsl(var(--hue), 80%, 50%);
  transition: --hue 500ms;
}

.element:hover {
  --hue: 180deg;  /* Now animatable! */
}
```

### Typed attr()

Use HTML attributes as typed CSS values.

```css
/* Use data-* attributes with type casting */
.badge {
  --hue: attr(data-hue type(<number>));
  background: oklch(0.72 0.18 calc(var(--hue) * 1deg));
}

.progress {
  width: attr(data-percent type(<percentage>), 0%);
}
```

### sibling-index() and sibling-count()

Create staggered animations without extra classes.

```css
.list-item {
  /* Auto-stagger based on DOM position */
  transition-delay: calc((sibling-index() - 1) * 40ms);
  animation-delay: calc(sibling-index() * 50ms);
}

/* Use total count */
.grid-item {
  flex-basis: calc(100% / sibling-count());
}
```

### Typography

```css
/* Prevent orphans in headings */
h1, h2, h3 {
  text-wrap: balance;
}

/* Better paragraph wrapping */
p {
  text-wrap: pretty;
}

/* Initial letter drop cap */
p::first-letter {
  initial-letter: 3;  /* Spans 3 lines */
}
```

### Subgrid

Child grids inherit parent grid tracks.

```css
.parent {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.child {
  display: grid;
  grid-column: span 3;
  grid-template-columns: subgrid;  /* Inherits parent columns */
}
```

### View Transitions

Smooth transitions between page states or navigations.

```css
/* Enable view transitions */
@view-transition {
  navigation: auto;
}

/* Name elements for cross-page transitions */
.hero-image {
  view-transition-name: hero;
}

/* Customize transition animation */
::view-transition-old(hero) {
  animation: fade-out 200ms;
}

::view-transition-new(hero) {
  animation: fade-in 200ms;
}
```

---

## Modern HTML (2024-2026)

### Customizable Select (Chrome 135+)

Native, styleable select dropdowns. Opt in with CSS.

```css
/* Enable customizable select */
select,
::picker(select) {
  appearance: base-select;
}
```

#### HTML Structure

```html
<select>
  <!-- Custom button (optional) -->
  <button>
    <selectedcontent></selectedcontent>
  </button>

  <!-- Rich option content -->
  <option value="html">
    <span class="icon">📄</span>
    <span>HTML</span>
  </option>
  <option value="css">
    <span class="icon">🎨</span>
    <span>CSS</span>
  </option>
</select>
```

#### CSS Pseudo-Elements

```css
/* The dropdown picker */
::picker(select) {
  border: 2px solid var(--border);
  padding: 0.5rem;
}

/* Dropdown arrow icon */
select::picker-icon {
  transition: rotate 200ms;
}

select:open::picker-icon {
  rotate: 180deg;
}

/* Checkmark on selected option */
option::checkmark {
  content: "✓";
  margin-left: auto;
}

/* Style selected option */
option:checked {
  font-weight: bold;
}
```

### Popover API

Native popovers with light dismiss, no JavaScript required.

```html
<button popovertarget="menu">Open Menu</button>

<div id="menu" popover>
  <p>Popover content</p>
</div>
```

#### Popover Types

```html
<!-- Auto: light dismiss (click outside or Escape) -->
<div popover="auto">...</div>

<!-- Manual: must be closed explicitly -->
<div popover="manual">...</div>

<!-- Hint: for tooltips, auto-closes -->
<div popover="hint">...</div>
```

#### Popover CSS

```css
[popover] {
  /* Default styles when hidden */
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity 150ms, transform 150ms, display 150ms allow-discrete;
}

[popover]:popover-open {
  opacity: 1;
  transform: translateY(0);
}

/* Backdrop */
[popover]::backdrop {
  background: rgba(0, 0, 0, 0.3);
}

/* Starting style for enter transition */
@starting-style {
  [popover]:popover-open {
    opacity: 0;
    transform: translateY(-8px);
  }
}
```

### Dialog Enhancements

```html
<!-- Modal with light dismiss -->
<dialog closedby="any">
  <form method="dialog">
    <button>Close</button>
  </form>
</dialog>
```

```css
dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}
```

### Invoker Commands

Declarative element interactions without JavaScript.

```html
<!-- Open/close popover -->
<button popovertarget="popover" popovertargetaction="toggle">
  Toggle
</button>

<!-- Open dialog -->
<button commandfor="dialog" command="showModal">
  Open Modal
</button>

<!-- Custom commands -->
<button commandfor="video" command="play">Play</button>
<button commandfor="video" command="pause">Pause</button>
```

### Details/Summary Improvements

```css
/* Style the marker */
summary::marker {
  content: "▶ ";
}

details[open] summary::marker {
  content: "▼ ";
}

/* Animate open/close */
details {
  transition: height 200ms;
}
```

### Interest Invokers (Tooltips)

```html
<button interesttarget="tooltip">Hover me</button>
<div id="tooltip" popover="hint">Tooltip content</div>
```

---

## CSS Quick Reference Tables

### Modern Feature Support

| Feature | Chrome | Firefox | Safari |
|---------|--------|---------|--------|
| Nesting | ✅ 120+ | ✅ 117+ | ✅ 17.2+ |
| :has() | ✅ 105+ | ✅ 121+ | ✅ 15.4+ |
| Container Queries | ✅ 105+ | ✅ 110+ | ✅ 16+ |
| Scroll-driven Animations | ✅ 115+ | 🚧 | 🚧 |
| @scope | ✅ 118+ | 🚧 | ✅ 17.4+ |
| @layer | ✅ 99+ | ✅ 97+ | ✅ 15.4+ |
| @starting-style | ✅ 117+ | 🚧 | ✅ 17.5+ |
| Anchor Positioning | ✅ 125+ | 🚧 | 🚧 |
| View Transitions | ✅ 111+ | 🚧 | ✅ 18+ |
| Popover API | ✅ 114+ | ✅ 125+ | ✅ 17+ |
| Customizable Select | ✅ 135+ | 🚧 | 🚧 |

### Feature Detection

```css
/* Scroll-driven animations */
@supports (animation-timeline: scroll()) {
  /* Use scroll-driven animations */
}

/* Container queries */
@supports (container-type: inline-size) {
  /* Use container queries */
}

/* :has() selector */
@supports selector(:has(*)) {
  /* Use :has() */
}
```

### Do's and Don'ts

| DO | DON'T |
|----|-------|
| Use `@layer` to manage cascade order | Fight specificity with !important |
| Use `:has()` for parent-based styling | Use JavaScript for parent selectors |
| Use `@starting-style` for enter animations | Accept the "flash" on element creation |
| Use `scroll-timeline` for scroll-linked animations | Use IntersectionObserver for simple scroll effects |
| Use `color-mix()` for derived colors | Manually calculate color variations |
| Use `appearance: base-select` for styled selects | Build custom select components from scratch |
| Feature-detect before using cutting-edge CSS | Assume browser support |
| Use `view-timeline` for reveal animations | Use JavaScript scroll listeners |
