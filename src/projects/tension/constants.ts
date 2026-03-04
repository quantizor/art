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

/** Base grid width (before DPI scaling) */
export const BASE_GRID_SIZE = 1024

/** Letterbox bar height: 2 × h-20 (5rem = 80px at default 16px base) */
const LETTERBOX_TOTAL_PX = 160

/** Visible canvas aspect ratio (screen minus letterbox bars) */
const screenW = typeof window !== 'undefined' ? window.innerWidth : 1920
const screenH = typeof window !== 'undefined' ? Math.max(window.innerHeight - LETTERBOX_TOTAL_PX, 400) : 920
const CANVAS_ASPECT = screenW / screenH

/** Grid width in cells (DPI-scaled) */
export const GRID_WIDTH = Math.round(BASE_GRID_SIZE * GRID_SCALE)

/** Grid height in cells — matches visible canvas aspect so no pixels are wasted behind letterbox */
export const GRID_HEIGHT = Math.round(GRID_WIDTH / CANVAS_ASPECT)

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
export const MAX_SEED_COUNT = 48

/** Minimum distance between seeds (Poisson disk) — scaled with DPI */
export const SEED_MIN_DISTANCE = Math.round(50 * GRID_SCALE)

/** Default simulation parameters */
export const DEFAULT_SIM_PARAMS: SimulationParams = {
  stepsPerFrame: 7200,
  biasStrength: 0,
  axisCount: 3,
  seedCount: 12,
  stepSize: 1.0,
  walkerCount: DEFAULT_WALKER_COUNT,
  killRadiusMultiplier: 2.5,
  facets: 0,
  aspectRatio: 1.15,
}

/** Default color parameters — neon vivid agate */
export const DEFAULT_COLOR_PARAMS: ColorParams = {
  mode: 'agate',
  growthPattern: 'radial',
  bandWavelength: 14,
  bandAmplitude: 0.35,
  baseLightness: 0.55,
  saturation: 1.0,
  monoHue: 25,
}

// ============================================
// RENDERING
// ============================================

/** Background color (near-black with slight blue tint) */
export const BACKGROUND_COLOR = 0x050508

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
