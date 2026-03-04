/**
 * ProjectShell
 *
 * Reusable letterboxed layout for art projects.
 * Provides top/bottom chrome bars with home navigation,
 * title, subtitle, optional FPS counter, and a controls slot.
 */

import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

export interface ProjectShellProps {
  /** Project display title (uppercase recommended) */
  title: string
  /** Subtitle shown below title (e.g. date) */
  subtitle?: string
  /** Frames-per-second value to display in bottom-right */
  fps?: number
  /** Additional status content rendered in the bottom-right bar, before FPS */
  statusRight?: ReactNode
  /** Controls overlay rendered above the main content */
  controls?: ReactNode
  /** Main content (canvas, scene, etc.) */
  children: ReactNode
}

export function ProjectShell({
  title,
  subtitle,
  fps,
  statusRight,
  controls,
  children,
}: ProjectShellProps) {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black touch-none">
      {/* Canvas area inset from letterbox bars so grid matches visible area */}
      <div className="absolute top-20 bottom-20 left-0 right-0">
        {children}
      </div>

      {/* Top letterbox border */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-black z-10 pointer-events-none" />

      {/* Home button — positioned in top letterbox */}
      <Link
        to="/"
        className="absolute top-6 left-4 z-20 bg-black/80 border border-[var(--color-border-default)] p-2 px-3 text-white/70 hover:text-white font-mono text-xs tracking-wider pointer-events-auto"
      >
        &larr; HOME
      </Link>

      {/* Bottom letterbox border with title */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-black z-10 pointer-events-none flex items-center justify-between px-8">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-mono font-bold tracking-[0.05em] text-white/90 leading-none">
            {title}
          </span>
          {subtitle && (
            <span className="text-[11px] font-mono tracking-[0.25em] text-white/40 leading-none">
              {subtitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 pointer-events-auto select-text cursor-text">
          {statusRight}
          {fps !== undefined && (
            <span className="text-[11px] font-mono text-white/30 tabular-nums">
              {fps} FPS
            </span>
          )}
        </div>
      </div>

      {controls}
    </div>
  )
}
