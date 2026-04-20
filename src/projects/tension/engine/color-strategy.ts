/**
 * Color Strategy Interface
 *
 * Pluggable per-band color determination. Each strategy maps a
 * band index to an OKLCH color. The band structure (fBM warp,
 * variable widths, binary search) is handled by ColorMapper —
 * the strategy only decides what color a given band should be.
 */

/** OKLCH color for a single band */
export interface BandColor {
  /** Hue in degrees (0-360) */
  H: number
  /** Perceptual lightness (0-1) */
  L: number
  /** Chroma (0 to ~0.37) */
  C: number
}

/** A pluggable band color strategy */
export interface BandColorStrategy {
  name: string

  /**
   * Return the OKLCH color for a given band index.
   * `hueKey` identifies the specimen (layout decisions share this key);
   * `seedId` distinguishes seeds within the specimen so each seed rolls
   * its own shell + regime + family sequence independently.
   */
  getBandColor(
    bandIdx: number,
    hueKey: number,
    seedId: number,
    baseLightness: number,
    saturation: number
  ): BandColor

  /** Reset any cached state (called on palette change / reset) */
  reset(): void
}

// ─── Strategy Registry ──────────────────────────────────────────

import { agateBase } from './agate-base'
import { agateExperimental } from './agate-experimental'

const strategyRegistry: Record<string, BandColorStrategy> = {
  'agate-base': agateBase,
  'agate-experimental': agateExperimental,
}

/** Look up a color strategy by name */
export function getStrategy(name: string): BandColorStrategy {
  const strategy = strategyRegistry[name]
  if (!strategy) {
    throw new Error(`Unknown color strategy: ${name}`)
  }
  return strategy
}

/** The currently active color strategy (default) */
export const activeStrategy: BandColorStrategy = agateExperimental
