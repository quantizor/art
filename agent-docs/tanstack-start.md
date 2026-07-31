# TanStack Start

Version pins: `@tanstack/react-start` / `@tanstack/react-router` **1.159.4**, Zod **3.25.x**, Nitro **3.0.1-alpha.2**.

File-based routes under `src/routes/`. Router factory: `src/router.tsx`. Generated tree: `src/routeTree.gen.ts` (do not hand-edit).

## Server functions

Import `createServerFn` from `@tanstack/react-start`.

```ts
import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'

const postIdSchema = z.string().min(1)

export const fetchPost = createServerFn({ method: 'POST' })
  .inputValidator(postIdSchema)
  .handler(async ({ data: postId }) => {
    // ...
  })
```

Rules:

- Use `.inputValidator` with a Zod schema (or a validator that throws on bad input). Do **not** use `.validator` (not present on `createServerFn` in 1.159.4).
- Do **not** use identity validators like `.inputValidator((d) => d)`.
- Default HTTP method is `GET` when omitted. Use `{ method: 'POST' }` for mutations and anything that changes server-side state.
- Chain `.middleware([...])` before `.handler` when shared client/server context is needed. See `src/routes/api/users.ts` for a client/server middleware chain.
- Call server functions from loaders and components the same way: `await myServerFn({ data: input })`.

Verified in `@tanstack/start-client-core@1.159.4` (`createServerFn.ts`): `.inputValidator()` at line 92; default `method: 'GET'` at line 64.

## Loaders

Loaders are isomorphic: the same call site runs during SSR/prerender and on the client.

```ts
export const Route = createFileRoute('/posts/$postId')({
  loader: ({ params: { postId } }) => fetchPost({ data: postId }),
  component: PostComponent,
})
```

Do:

- Keep loaders thin: fetch/validate, return serializable data or a server-fn promise for deferred UI.
- Validate path params at the boundary (Zod in the loader or inside the server function).
- Return promises from loaders when using `<Await>` / `<Suspense>` (see `src/routes/deferred.tsx`).
- Throw `notFound()` from `@tanstack/react-router` when a resource is missing (see `src/utils/posts.tsx`).

Do not:

- Put browser-only APIs (`window`, `localStorage`, WebGPU) in loaders without guarding `typeof window`.
- Perform mutations inside loaders. Mutations belong in server functions with `POST` (or event handlers that call them).
- Assume loader data is trusted on the server without re-validation in the server function.

## `beforeLoad`, middleware, and redirects

`beforeLoad` runs before the route loads. Use it for auth gates, param parsing, and redirects.

```ts
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/redirect')({
  beforeLoad: () => {
    throw redirect({ to: '/posts' })
  },
})
```

Do:

- Throw `redirect()` from `beforeLoad` for navigation side effects.
- Register route-level `notFoundComponent` and `errorComponent` when the default shell is not enough.

Do not:

- Fetch heavy data in `beforeLoad` when a loader can own it.
- Throw bare `Error` for expected missing resources; use `notFound()`.

## `notFound()`

Import from `@tanstack/react-router`. Throw inside server function handlers or loaders when a resource does not exist.

Global 404 UI: `defaultNotFoundComponent` in `src/router.tsx` and `notFoundComponent` on `src/routes/__root.tsx` both render `~/components/NotFound` (hosts lightcycle; see `agent-docs/threejs.md`).

## CSRF

Searched `@tanstack/*@1.159.4` for `csrf`, `CSRF`, `xsrf`, and `XSRF`: **no matches**. TanStack Start 1.159.4 does not ship built-in CSRF tokens or middleware in this install.

Same-origin server functions invoked through the Start RPC layer inherit the browser's same-origin cookie policy. Do not roll custom CSRF unless a future Start release documents it or the app adds cross-site form posts.

## Static deploy

Prerender output lands in `docs/` via `scripts/deploy.sh`. Prerender uses port **4173** so a running Vite server cannot poison the static tree.
