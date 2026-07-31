import { createFileRoute } from '@tanstack/react-router'
import { createMiddleware } from '@tanstack/react-start'
import { debug } from '~/utils/debug'
import { parseUsers } from '~/utils/users'

const userLoggerMiddleware = createMiddleware().server(async ({ next }) => {
  debug('In: /users')
  const result = await next()
  result.response.headers.set('x-users', 'true')
  debug('Out: /users')
  return result
})

const testParentMiddleware = createMiddleware().server(async ({ next }) => {
  debug('In: testParentMiddleware')
  const result = await next()
  result.response.headers.set('x-test-parent', 'true')
  debug('Out: testParentMiddleware')
  return result
})

const testMiddleware = createMiddleware()
  .middleware([testParentMiddleware])
  .server(async ({ next }) => {
    debug('In: testMiddleware')
    const result = await next()
    result.response.headers.set('x-test', 'true')

    // if (Math.random() > 0.5) {
    //   throw new Response(null, {
    //     status: 302,
    //     headers: { Location: 'https://www.google.com' },
    //   })
    // }

    debug('Out: testMiddleware')
    return result
  })

export const Route = createFileRoute('/api/users')({
  server: {
    middleware: [testMiddleware, userLoggerMiddleware],
    handlers: {
      GET: async ({ request }) => {
        debug('GET /api/users @', request.url)
        const res = await fetch('https://jsonplaceholder.typicode.com/users')
        if (!res.ok) {
          throw new Error('Failed to fetch users')
        }

        let users
        try {
          const raw: unknown = await res.json()
          users = parseUsers(Array.isArray(raw) ? raw.slice(0, 10) : raw)
        } catch (cause) {
          console.error('Upstream returned malformed users data', cause)
          return Response.json(
            { error: 'Upstream returned invalid data' },
            { status: 502 },
          )
        }

        return Response.json(users)
      },
    },
  },
})
