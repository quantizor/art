/**
 * Agate Base Color Strategy
 *
 * Neon-vivid per-band color selection via spatial hashing.
 * Each band gets a deterministic hue (cellHash) and character
 * category (near-black / near-white / dark vivid / bright vivid).
 * Fully deterministic — same bandIdx + hueKey always produces
 * the same color.
 */

import { cellHash } from './ColorMapper'
import type { BandColor, BandColorStrategy } from './color-strategy'

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const agateBase: BandColorStrategy = {
  name: 'agate-base',

  getBandColor(
    bandIdx: number,
    hueKey: number,
    _seedId: number,
    baseLightness: number,
    saturation: number
  ): BandColor {
    // Per-band wild hue — completely different color each layer
    const H = cellHash(bandIdx, hueKey) * 360

    // Per-band character — four categories for maximum variety:
    //   ~15% near-black (dark matrix)
    //   ~20% near-white (translucent chalcedony)
    //   ~20% dark vivid (deep jewel tones)
    //   ~45% bright vivid (neon)
    const cHash = cellHash(bandIdx + 100, hueKey)
    let L: number, C: number

    if (cHash < 0.15) {
      L = clamp01(0.08 + baseLightness * 0.06)
      C = saturation * 0.08
    } else if (cHash < 0.35) {
      L = clamp01(0.75 + baseLightness * 0.20)
      C = saturation * 0.04
    } else if (cHash < 0.55) {
      L = clamp01(0.20 + baseLightness * 0.15)
      C = saturation * 0.30
    } else {
      L = clamp01(0.45 + baseLightness * 0.25)
      C = saturation * 0.35
    }

    return { H, L, C }
  },

  reset() {
    // Stateless — nothing to reset
  },
}
