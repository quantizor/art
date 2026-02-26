/**
 * id1 Route
 *
 * /projects/id1
 */

import { createFileRoute } from '@tanstack/react-router'
import { Id1Viewer } from '~/projects/id1'

export const Route = createFileRoute('/projects/id1')({
  component: Id1Page,
})

function Id1Page() {
  return <Id1Viewer />
}
