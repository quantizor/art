/**
 * Project Registry
 *
 * Central registry of all art projects displayed on the speed-dial.
 */

import type { ArtProject, ProjectCategory, ProjectStatus } from '~/types/projects';

/**
 * All registered projects
 */
export const projects: ArtProject[] = [
  {
    id: 'tension',
    title: 'Tension',
    description: 'Real-time crystal growth simulation using DLA under polarized light.',
    thumbnail: '/thumbnails/tension.png',
    route: '/projects/tension',
    status: 'active',
    category: 'generative',
    tags: ['threejs', 'simulation', 'dla'],
    date: '2026-02-25',
    featured: true,
  },
  {
    id: 'id1',
    title: 'id1',
    description: 'Glass torus hovering on a fishing line above a walnut table. Photorealistic still-life with PBR materials and transmission glass.',
    route: '/projects/id1',
    status: 'wip',
    category: 'visualization',
    tags: ['threejs', 'pbr', 'glass'],
    date: '2026-02-25',
    featured: true,
  },
];

/**
 * Get projects sorted by date (newest first), with featured projects at top
 */
export function getSortedProjects(options?: {
  status?: ProjectStatus;
  category?: ProjectCategory;
  limit?: number;
}): ArtProject[] {
  let filtered = [...projects];

  // Apply filters
  if (options?.status) {
    filtered = filtered.filter((p) => p.status === options.status);
  }
  if (options?.category) {
    filtered = filtered.filter((p) => p.category === options.category);
  }

  // Sort: featured first, then by date (newest first)
  filtered.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Apply limit
  if (options?.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Get a single project by ID
 */
export function getProjectById(id: string): ArtProject | undefined {
  return projects.find((p) => p.id === id);
}

/**
 * Get all unique categories from registered projects
 */
export function getCategories(): ProjectCategory[] {
  const categories = new Set(projects.map((p) => p.category));
  return Array.from(categories);
}

/**
 * Get all unique tags from registered projects
 */
export function getTags(): string[] {
  const tags = new Set(projects.flatMap((p) => p.tags));
  return Array.from(tags).sort();
}
