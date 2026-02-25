/**
 * Crystal Growth Simulation Types
 *
 * Type definitions for the DLA-based crystal growth simulation.
 */

/** Color mode for crystal rendering */
export type ColorMode = 'birefringence' | 'rainbow' | 'monochrome' | 'oilslick' | 'polarized' | 'dichroism' | 'laue' | 'conoscopic'

/** Simulation phase */
export type SimulationPhase = 'idle' | 'growing' | 'paused' | 'complete'

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
}

/** Parameters controlling the simulation */
export interface SimulationParams {
  /** Number of random walk steps per frame per walker */
  stepsPerFrame: number
  /** Directional bias strength (0 = isotropic, 1 = strongly anisotropic) */
  biasStrength: number
  /** Number of preferred crystal axes per seed */
  axisCount: number
  /** Number of seed nucleation points */
  seedCount: number
  /** Step size for walker movement */
  stepSize: number
  /** Number of active walkers */
  walkerCount: number
  /** Kill radius multiplier (relative to launch radius) */
  killRadiusMultiplier: number
  /** Number of polygon sides for crystal shape (0 = circle, 3-12 = polygon) */
  facets: number
}

/** Parameters for birefringence color mapping */
export interface ColorParams {
  /** Color mode */
  mode: ColorMode
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

/** Callback when a walker sticks to the aggregate */
export type OnStickCallback = (
  walkerIndex: number,
  cx: number,
  cy: number,
  seedId: number,
  growthAngle: number,
  distFromSeed: number,
  boundaryPressure: number
) => void

/** Compiled step function signature */
export type StepFunction = (
  walkerX: Float32Array,
  walkerY: Float32Array,
  walkerActive: Uint8Array,
  walkerSeedId: Uint16Array,
  grid: Uint16Array,
  count: number,
  stepSize: number,
  biasX: Float32Array,
  biasY: Float32Array,
  onStick: (walkerIndex: number, cx: number, cy: number, seedId: number) => void
) => void
