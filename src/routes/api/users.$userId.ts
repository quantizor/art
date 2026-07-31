import { createFileRoute } from '@tanstack/react-router'
import { debug } from '~/utils/debug'
import { parseUser, userIdSchema } from '~/utils/users'

export const Route = createFileRoute('/api/users/$userId')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        debug(`Fetching user by id=${params.userId}... @`, request.url)

        const userId = userIdSchema.safeParse(params.userId)
        if (!userId.success) {
          return Response.json({ error: 'Invalid user id' }, { status: 400 })
        }

        let res: Response
        try {
          res = await fetch(
            `https://jsonplaceholder.typicode.com/users/${userId.data}`,
          )
        } catch (cause) {
          console.error('Failed to reach upstream users API', cause)
          return Response.json(
            { error: 'Upstream request failed' },
            { status: 502 },
          )
        }

        if (res.status === 404) {
          return Response.json({ error: 'User not found' }, { status: 404 })
        }

        if (!res.ok) {
          console.error(`Upstream users API responded with ${res.status}`)
          return Response.json(
            { error: 'Upstream request failed' },
            { status: 502 },
          )
        }

        let user
        try {
          user = parseUser(await res.json())
        } catch (cause) {
          console.error('Upstream returned malformed user data', cause)
          return Response.json(
            { error: 'Upstream returned invalid data' },
            { status: 502 },
          )
        }

        return Response.json(user)
      },
    },
  },
})
