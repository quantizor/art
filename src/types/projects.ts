/**
 * Art Project Types
 *
 * Type definitions for the speed-dial project registry.
 */

export type ProjectStatus = 'active' | 'wip' | 'archived';

export type ProjectCategory =
  | 'generative'
  | 'interactive'
  | 'visualization'
  | 'shader'
  | 'physics'
  | 'audio';

export interface ArtProject {
  /**
   * Unique identifier for the project (used in URLs)
   */
  id: string;

  /**
   * Display title
   */
  title: string;

  /**
   * Short description (1-2 sentences)
   */
  description: string;

  /**
   * Path to thumbnail image (relative to public/)
   */
  thumbnail?: string;

  /**
   * Route path for the project
   */
  route: string;

  /**
   * Project status
   */
  status: ProjectStatus;

  /**
   * Primary category
   */
  category: ProjectCategory;

  /**
   * Additional tags for filtering
   */
  tags: string[];

  /**
   * Date added or last updated (ISO string)
   */
  date: string;

  /**
   * Optional external link (e.g., GitHub)
   */
  externalUrl?: string;

  /**
   * Whether this project is featured (shown first)
   */
  featured?: boolean;
}
