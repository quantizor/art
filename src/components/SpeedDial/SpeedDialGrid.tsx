/**
 * SpeedDialGrid - Responsive grid layout for speed-dial items
 *
 * Handles responsive breakpoints:
 * - Mobile (< 640px): 1 column
 * - Tablet (640px - 1024px): 2 columns
 * - Desktop (1024px - 1280px): 3 columns
 * - Large (>= 1280px): 4 columns
 */

import type { ReactNode } from 'react';

export interface SpeedDialGridProps {
  children: ReactNode;
}

export function SpeedDialGrid({ children }: SpeedDialGridProps) {
  return (
    <div
      className={[
        'grid gap-4 sm:gap-6',
        'grid-cols-1',
        'sm:grid-cols-2',
        'lg:grid-cols-3',
        'xl:grid-cols-4',
        'max-w-sm', // Constrain card size
      ].join(' ')}
    >
      {children}
    </div>
  );
}
