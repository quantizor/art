/**
 * SpeedDialItem - Individual project card in the speed-dial grid
 *
 * Displays project thumbnail, title, status, and metadata.
 * Uses the Card component from the design system.
 */

import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardTitle, CardMeta, CardFooter, Badge } from '~/ui';
import type { ArtProject } from '~/types/projects';

export interface SpeedDialItemProps {
  project: ArtProject;
}

const statusColors = {
  active: 'primary',
  wip: 'warning',
  archived: 'ghost',
} as const;

const statusLabels = {
  active: 'Live',
  wip: 'WIP',
  archived: 'Archived',
} as const;

export function SpeedDialItem({ project }: SpeedDialItemProps) {
  const { title, description, thumbnail, route, status, category, date } = project;

  return (
    <Link to={route} className="block group focus:outline-none aspect-square">
      <Card
        interactive
        className="h-full relative !bg-transparent !p-0"
      >
        {/* Background */}
        <div className="absolute inset-0 bg-[var(--color-surface-elevated)] overflow-hidden">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={`${title} preview`}
              className="w-full h-full object-cover transition-transform duration-150 ease-out group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-brutal text-[var(--color-text-tertiary)] text-sm">
                {category.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Status badge overlay */}
        <div className="absolute top-2 right-3 z-10">
          <Badge variant={statusColors[status]} size="sm" className="notch-xs">
            {statusLabels[status]}
          </Badge>
        </div>

        {/* Content overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-8">
          <CardTitle>{title}</CardTitle>
          <CardMeta>{description}</CardMeta>
          <span className="text-code text-[var(--color-text-tertiary)] text-xs mt-2 block">
            {formatDate(date)}
          </span>
        </div>
      </Card>
    </Link>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
}
