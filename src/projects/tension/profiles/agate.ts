/**
 * Agate Crystal Profile
 *
 * Extracts all hardcoded agate parameters from ColorMapper and
 * FloodFillSimulation into a single data record. Values match
 * the original implementation exactly so output is identical.
 */

import type { CrystalProfile } from '../types'

export const agateProfile: CrystalProfile = {
  name: 'Agate',

  // Growth shape (FloodFillSimulation)
  growthNoiseScale: 0.035,
  growthOctaves: 3,
  growthH: 0.7,
  growthWarpStrength: 1.2,
  maxGrainArea: 0.35,

  // Band structure (ColorMapper)
  bandNoiseScale: 0.035,
  bandOctaves: 3,
  bandH: 0.7,
  bandWarpStrength: 1.2,
  bandCenterFadeMultiplier: 3,
  bandWidthVariation: [0.3, 2.0],
  bandThinFrequency: 0.15,
  bandThinWidth: 0.12,

  // Color strategy — tuned to observed real agate palettes. Lower
  // uniformity + higher boundary frequency gives the crisp alternating
  // fortification rings you see in Brazilian/Uruguayan specimens.
  colorStrategyName: 'agate-experimental',
  colorVibrancyRange: [0.40, 0.90],
  colorUniformityRange: [0.55, 0.82],
  colorBoundaryFrequency: 0.14,
  colorFamilySwitchRate: 0.02,

  // Optical effects (ColorMapper)
  tiltRange: 0.8,
  tiltBrightness: [0.7, 0.3],
  tiltRetention: [0.8, 0.2],
  sheen: 0.06,
  strainEnabled: true,

  // Randomization ranges (CrystalGrowthViewer)
  bandWavelengthRange: [4, 9],
  bandAmplitudeRange: [0.25, 0.65],
  baseLightnessRange: [0.45, 0.70],
  saturationRange: [0.55, 0.85],
  seedCountRange: [1, 3],
  axisCountRange: [2, 6],
  aspectRatioRange: [1.0, 1.3],
}
