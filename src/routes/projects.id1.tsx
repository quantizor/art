/**
 * id1 Route
 *
 * /projects/id1
 */

import { createFileRoute } from '@tanstack/react-router'
import { getProjectById } from '~/data/projects'
import { Id1Viewer } from '~/projects/id1'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/projects/id1')({
  head: () => {
    const project = getProjectById('id1')
    if (!project?.thumbnail) {
      throw new Error('Project registry entry "id1" must define a thumbnail')
    }
    return {
      meta: seo({
        description: project.description,
        image: new URL(project.thumbnail, 'https://quantizor.art').href,
        title: `${project.title}, quantizor's studio`,
      }),
    }
  },
  component: Id1Page,
})

function Id1Page() {
  return <Id1Viewer />
}
