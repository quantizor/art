import { Link as RouterLink } from '@tanstack/react-router'
import { LightcycleGame } from '~/games/lightcycle/components/LightcycleGame'

export function NotFound() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* The game */}
      <LightcycleGame />

      {/* Top navigation overlay */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pointer-events-none">
        <span className="text-display text-sm text-[var(--color-primary)] bg-black/50 px-3 py-2 border border-[var(--color-border-default)] pointer-events-auto">
          404
        </span>
        <nav className="flex items-center gap-4 pointer-events-auto">
          <button
            onClick={() => window.history.back()}
            className="text-display text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] cursor-pointer bg-black/50 px-3 py-2 border border-[var(--color-border-default)] transition-colors"
          >
            &larr; Go Back
          </button>
          <RouterLink
            to="/"
            className="text-display text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] bg-black/50 px-3 py-2 border border-[var(--color-border-default)] transition-colors"
          >
            Return Home
          </RouterLink>
        </nav>
      </header>

      {/* Bottom message */}
      <div className="absolute bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <p className="text-display text-xs text-[var(--color-primary)] tracking-widest uppercase bg-black/50 px-4 py-2 border border-[var(--color-border-default)]">
          Route not found. Play while you're here.
        </p>
      </div>
    </div>
  )
}
