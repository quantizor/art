import { createFileRoute, Link as RouterLink } from '@tanstack/react-router'
import { SpeedDial } from '~/components/SpeedDial'
import { getSortedProjects } from '~/data/projects'
import { Link } from '~/ui'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const projects = getSortedProjects({ limit: 1 })

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Header with title and nav */}
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-4xl sm:text-5xl text-[var(--color-text-primary)]">
          quantizor's studio
        </h1>
        <nav className="flex gap-4">
          <RouterLink to="/ui">
            <Link as="span">Design System</Link>
          </RouterLink>
          <Link href="https://quantizor.dev" external>
            quantizor.dev
          </Link>
        </nav>
      </header>

      <SpeedDial projects={projects} />
    </main>
  )
}
