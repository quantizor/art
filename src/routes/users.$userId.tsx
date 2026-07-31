import { createFileRoute, notFound } from '@tanstack/react-router'
import { NotFound } from 'src/components/NotFound'
import { UserErrorComponent } from 'src/components/UserError'
import { parseUser } from '../utils/users'

export const Route = createFileRoute('/users/$userId')({
  loader: async ({ params: { userId } }) => {
    let res: Response
    try {
      res = await fetch('/api/users/' + userId)
    } catch (cause) {
      throw new Error('Failed to reach the users API', { cause })
    }

    if (res.status === 404) {
      throw notFound()
    }

    if (!res.ok) {
      throw new Error(`Unexpected status code ${res.status}`)
    }

    try {
      return parseUser(await res.json())
    } catch (cause) {
      throw new Error('Received malformed user data', { cause })
    }
  },
  errorComponent: UserErrorComponent,
  component: UserComponent,
  notFoundComponent: () => {
    return <NotFound />
  },
})

function UserComponent() {
  const user = Route.useLoaderData()

  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{user.name}</h4>
      <div className="text-sm">{user.email}</div>
      <div>
        <a
          href={`/api/users/${user.id}`}
          className="text-blue-800 hover:text-blue-600 underline"
        >
          View as JSON
        </a>
      </div>
    </div>
  )
}
