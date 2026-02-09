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
    id: 'particle-flow',
    title: 'Particle Flow',
    description: 'GPU-accelerated particle system with fluid dynamics.',
    route: '/projects/particle-flow',
    status: 'wip',
    category: 'physics',
    tags: ['webgpu', 'typegpu', 'particles'],
    date: '2024-01-15',
    featured: true,
  },
  {
    id: 'noise-terrain',
    title: 'Noise Terrain',
    description: 'Procedural terrain generation using layered noise functions.',
    route: '/projects/noise-terrain',
    status: 'wip',
    category: 'generative',
    tags: ['webgpu', 'threejs', 'procedural'],
    date: '2024-01-10',
  },
  {
    id: 'shader-art',
    title: 'Shader Experiments',
    description: 'Collection of fragment shader visual experiments.',
    route: '/projects/shader-art',
    status: 'wip',
    category: 'shader',
    tags: ['glsl', 'webgpu', 'visual'],
    date: '2024-01-05',
  },
  {
    id: 'audio-visualizer',
    title: 'Audio Visualizer',
    description: 'Real-time audio reactive visualizations.',
    route: '/projects/audio-visualizer',
    status: 'wip',
    category: 'audio',
    tags: ['webaudio', 'threejs', 'reactive'],
    date: '2024-01-01',
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
