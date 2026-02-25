/**
 * Crystal Growth Route
 *
 * /projects/crystal-growth — Real-time testosterone crystal simulation
 */

import { createFileRoute } from '@tanstack/react-router'
import { CrystalGrowthViewer } from '~/projects/crystal-growth'

export const Route = createFileRoute('/projects/crystal-growth')({
  component: CrystalGrowthPage,
})

function CrystalGrowthPage() {
  return <CrystalGrowthViewer />
}
