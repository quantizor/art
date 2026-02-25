/**
 * Crystal Growth Simulation Constants
 *
 * Tuning parameters for DLA simulation and rendering.
 */

import type { ColorParams, SimulationParams } from './types'

// ============================================
// DPI SCALING
// ============================================

/** Device pixel ratio, capped at 2 to limit memory (~56 MB at 2×) */
const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1

/** Scale factor from base (1024) grid to actual grid — all grid-space
 *  distances in the color/sim code use base-resolution units, and the
 *  simulation internally scales by GRID_SCALE² for fill rate. */
export const GRID_SCALE = DPR

// ============================================
// GRID CONFIGURATION
// ============================================

/** Base grid size (before DPI scaling) */
export const BASE_GRID_SIZE = 1024

/** Grid width in cells (DPI-scaled) */
export const GRID_WIDTH = Math.round(BASE_GRID_SIZE * GRID_SCALE)

/** Grid height in cells (DPI-scaled) */
export const GRID_HEIGHT = Math.round(BASE_GRID_SIZE * GRID_SCALE)

/** World-to-grid resolution (cells per world unit) */
export const RESOLUTION = 1

// ============================================
// SIMULATION DEFAULTS
// ============================================

/** Maximum aggregate particles before simulation stops (fill entire grid) */
export const MAX_PARTICLES = GRID_WIDTH * GRID_HEIGHT

/** Default walker batch size */
export const DEFAULT_WALKER_COUNT = 2048

/** Maximum seed count for slider range */
export const MAX_SEED_COUNT = 80

/** Minimum distance between seeds (Poisson disk) — scaled with DPI */
export const SEED_MIN_DISTANCE = Math.round(50 * GRID_SCALE)

/** Default simulation parameters */
export const DEFAULT_SIM_PARAMS: SimulationParams = {
  stepsPerFrame: 7200,
  biasStrength: 0,
  axisCount: 3,
  seedCount: 40,
  stepSize: 1.0,
  walkerCount: DEFAULT_WALKER_COUNT,
  killRadiusMultiplier: 2.5,
  facets: 0,
}

/** Default color parameters */
export const DEFAULT_COLOR_PARAMS: ColorParams = {
  mode: 'oilslick',
  bandWavelength: 24,
  bandAmplitude: 0.15,
  baseLightness: 0.58,
  saturation: 0.72,
  monoHue: 200,
}

// ============================================
// RENDERING
// ============================================

/** Background color (near-black with slight blue tint) */
export const BACKGROUND_COLOR = 0x050508

/** Vignette configuration */
export const VIGNETTE_CONFIG = {
  darkness: 0.7,
  offset: 1.2,
} as const

// ============================================
// CAMERA
// ============================================

/** Initial camera zoom (ortho frustum half-size) */
export const INITIAL_ZOOM = 280

/** Min/max zoom bounds */
export const MIN_ZOOM = 20
export const MAX_ZOOM = 400

/** Zoom speed factor */
export const ZOOM_SPEED = 0.1

// ============================================
// TIMING
// ============================================

/** Maximum delta time (ms) to prevent spiral of death */
export const MAX_DELTA = 100

/** Target framerate */
export const TARGET_FPS = 60

/** Initial launch radius around seeds */
export const INITIAL_LAUNCH_RADIUS = 10
