import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/!')({
  loader: () => {
    throw new Error('Preview the error screen')
  },
  component: () => null,
})
