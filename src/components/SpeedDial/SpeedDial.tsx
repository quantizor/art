/**
 * SpeedDial - Main container for the project speed-dial interface
 *
 * Displays a grid of art projects with optional header and filtering.
 */

import type { ArtProject } from '~/types/projects';
import { SpeedDialGrid } from './SpeedDialGrid';
import { SpeedDialItem } from './SpeedDialItem';

export interface SpeedDialProps {
  /**
   * Projects to display
   */
  projects: ArtProject[];

  /**
   * Optional title for the section
   */
  title?: string;

  /**
   * Optional subtitle/description
   */
  subtitle?: string;
}

export function SpeedDial({ projects, title, subtitle }: SpeedDialProps) {
  return (
    <section className="w-full">
      {/* Header */}
      {(title || subtitle) && (
        <header className="mb-6 sm:mb-8">
          {title && (
            <h1 className="text-brutal text-2xl sm:text-3xl text-[var(--color-text-primary)] mb-2">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-display text-sm sm:text-base text-[var(--color-text-secondary)] max-w-2xl">
              {subtitle}
            </p>
          )}
        </header>
      )}

      {/* Grid */}
      {projects.length > 0 ? (
        <SpeedDialGrid>
          {projects.map((project) => (
            <SpeedDialItem key={project.id} project={project} />
          ))}
        </SpeedDialGrid>
      ) : (
        <div className="flex items-center justify-center py-16 border border-dashed border-[var(--color-border-default)]">
          <p className="text-brutal text-[var(--color-text-tertiary)]">
            No projects found
          </p>
        </div>
      )}
    </section>
  );
}
