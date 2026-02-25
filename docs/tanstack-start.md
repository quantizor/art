# TanStack Start Reference

## File-Based Routing

Routes are defined in `src/routes/`. The file path maps to the URL structure.

### Route File Naming Conventions

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

### Special Files
- `__root.tsx` - Root layout containing `<html>`, `<head>`, `<body>`, wraps all routes

---

## API Reference

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
  // Lifecycle (execution order: 1 -> 2 -> 3)
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

### API Routes

```tsx
// src/routes/api/users.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/users')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ request }) => {
        const data = await fetchUsers()
        return Response.json(data)
      },
      POST: async ({ request }) => {
        const body = await request.json()
        return Response.json({ success: true })
      },
    },
  },
})

// Dynamic API route: /api/users/$userId.ts
export const Route = createFileRoute('/api/users/$userId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        return Response.json({ id: params.userId })
      },
    },
  },
})
```

### Root Layout (`__root.tsx`)

```tsx
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

### Router Configuration

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: ErrorBoundary,
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  })
}
```
