/**
 * Tourmaline Crystal Profile
 *
 * Wider bands, fewer octaves, gentler warp — produces elongated
 * prismatic cross-sections with broad color zones instead of
 * fine agate-like banding.
 */

import type { CrystalProfile } from '../types'

export const tourmalineProfile: CrystalProfile = {
  type: 'tourmaline',
  name: 'Tourmaline',

  // Growth shape — lower noise frequency for smoother silhouettes
  growthNoiseScale: 0.02,
  growthOctaves: 2,
  growthH: 0.8,
  growthWarpStrength: 0.6,
  maxGrainArea: 0.40,

  // Band structure — wide bands with gentle warp
  growthPattern: 'radial',
  bandNoiseScale: 0.02,
  bandOctaves: 2,
  bandH: 0.8,
  bandWarpStrength: 0.6,
  bandCenterFadeMultiplier: 4,
  bandRampBands: 6,
  bandRampStart: 0.3,
  bandRampExponent: 1.0,
  bandWidthVariation: [0.5, 1.5],
  bandRhythmStrength: 0,
  bandRhythmFrequency: 0.1,
  bandThinFrequency: 0,
  bandThinWidth: 0.2,

  // Color strategy
  colorStrategyName: 'agate-experimental',
  colorVibrancyRange: [0.35, 0.70],
  colorUniformityRange: [0.70, 0.95],
  colorBoundaryFrequency: 0.08,
  colorFamilySwitchRate: 0.04,

  // Optical effects — subtler tilt, less sheen
  tiltRange: 0.5,
  tiltBrightness: [0.75, 0.25],
  tiltRetention: [0.85, 0.15],
  sheen: 0.04,
  strainEnabled: true,

  // Randomization ranges — wider wavelengths, elongated shapes
  bandWavelengthRange: [18, 40],
  bandAmplitudeRange: [0.20, 0.50],
  baseLightnessRange: [0.40, 0.65],
  saturationRange: [0.85, 1.00],
  seedCountRange: [1, 8],
  axisCountRange: [3, 6],
  aspectRatioRange: [1.2, 2.0],
}
