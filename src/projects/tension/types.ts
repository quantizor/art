/** Agate generator profile — tunable parameters for cavity partition + banding. */
export interface CrystalProfile {
  name: string

  // Growth shape (FloodFillSimulation)
  growthNoiseScale: number
  growthOctaves: number
  growthH: number
  growthWarpStrength: number
  maxGrainArea: number

  // Band structure (ColorMapper)
  growthPattern: GrowthPattern
  bandNoiseScale: number
  bandOctaves: number
  bandH: number
  bandWarpStrength: number
  bandCenterFadeMultiplier: number
  bandWidthVariation: [number, number]
  bandThinFrequency: number
  bandThinWidth: number

  // Color strategy
  colorStrategyName: string
  colorVibrancyRange: [number, number]
  colorUniformityRange: [number, number]
  colorBoundaryFrequency: number
  colorFamilySwitchRate: number

  // Optical effects (ColorMapper)
  tiltRange: number
  tiltBrightness: [number, number]
  tiltRetention: [number, number]
  sheen: number
  strainEnabled: boolean

  // Randomization ranges (CrystalGrowthViewer)
  bandWavelengthRange: [number, number]
  bandAmplitudeRange: [number, number]
  baseLightnessRange: [number, number]
  saturationRange: [number, number]
  seedCountRange: [number, number]
  axisCountRange: [number, number]
  aspectRatioRange: [number, number]
}

/** Simulation phase */
export type SimulationPhase = 'idle' | 'dissolving' | 'growing' | 'revealing' | 'paused' | 'complete'

/** A seed point for crystal nucleation */
export interface Seed {
  /** Unique seed ID (1-indexed, 0 = empty in grid) */
  id: number
  /** World X position */
  x: number
  /** World Y position */
  y: number
  /** Preferred growth axes (radians) */
  axes: number[]
  /** Crystal plane tilt — small per-seed angle offset for color variation */
  tilt: number
  /** Per-seed fBM noise offset X — decorrelates warp patterns between seeds */
  noiseOffsetX: number
  /** Per-seed fBM noise offset Y */
  noiseOffsetY: number
  /** Maximum cavity radius in grid cells. Cells beyond this in this seed's
   *  warped distance metric remain unclaimed (host rock between nodules). */
  maxRadius: number
  /** Cavity aspect ratio (>1 = elongated). Multiplies y-axis distance. */
  aspectRatio: number
}

/** Parameters controlling the simulation */
export interface SimulationParams {
  /** Number of preferred crystal axes per seed */
  axisCount: number
  /** Number of seed nucleation points */
  seedCount: number
  /** Number of polygon sides for crystal shape (0 = circle, 3-12 = polygon) */
  facets: number
  /** Aspect ratio for elliptical growth (1.0 = circle, >1.0 = elongated along primary axis) */
  aspectRatio: number
}

/** Growth pattern — determines how color varies within each crystal */
export type GrowthPattern = 'linear' | 'radial'

/** Parameters for band color mapping */
export interface ColorParams {
  /** Growth pattern: 'linear' = gradient across grain, 'radial' = concentric from center */
  growthPattern: GrowthPattern
  /** Band wavelength in grid units */
  bandWavelength: number
  /** Band amplitude (0-1) */
  bandAmplitude: number
  /** Base lightness (0-1) */
  baseLightness: number
  /** Saturation (0-1) */
  saturation: number
  /** Monochrome hue (degrees, used only in monochrome mode) */
  monoHue: number
}

/** RGB color tuple (0-1 range) */
export interface RGBColor {
  r: number
  g: number
  b: number
}

