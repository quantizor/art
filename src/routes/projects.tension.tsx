/**
 * Tension Route
 *
 * /projects/tension — Real-time crystal growth simulation
 */

import { createFileRoute } from '@tanstack/react-router'
import { CrystalGrowthViewer } from '~/projects/tension'
import { seo } from '~/utils/seo'

export const Route = createFileRoute('/projects/tension')({
  head: () => ({
    meta: seo({
      title: 'Tension — quantizor\'s studio',
      description:
        'Real-time crystal growth simulation using DLA under polarized light.',
      image: 'https://quantizor.art/thumbnails/tension.png',
    }),
  }),
  component: TensionPage,
})

function TensionPage() {
  return <CrystalGrowthViewer />
}
