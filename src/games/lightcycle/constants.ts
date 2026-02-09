/**
 * TRON Lightcycle Game Constants
 *
 * Configuration values for gameplay, rendering, and physics.
 */

import type { CameraMode, GridDirection, KeyMapping } from './types'

// ============================================
// ARENA CONFIGURATION
// ============================================

/** Arena size in grid units */
export const ARENA_SIZE = 128

/** Half arena size for centering calculations */
export const ARENA_HALF = ARENA_SIZE / 2

/** Height of arena boundary walls */
export const WALL_HEIGHT = 3

/** Grid cell size in world units */
export const CELL_SIZE = 1

// ============================================
// CYCLE CONFIGURATION
// ============================================

/** Base speed in grid cells per second */
export const BASE_SPEED = 12

/** Number of AI opponents */
export const AI_COUNT = 3

/** Total number of cycles (1 player + AI) */
export const TOTAL_CYCLES = 1 + AI_COUNT

/** Height of light trail walls */
export const TRAIL_HEIGHT = 2

/** Width of light trail walls */
export const TRAIL_WIDTH = 0.15

// ============================================
// COLORS (TRON-style palette)
// ============================================

export const CYCLE_COLORS = {
  player: 0xff3333, // Red (player accent color)
  ai1: 0x00ffff, // Cyan (classic TRON protagonist style)
  ai2: 0xff00ff, // Magenta
  ai3: 0x00ff00, // Green
} as const

export const ARENA_COLORS = {
  floor: 0x000a14, // Very dark blue
  gridLine: 0x003344, // Dark teal
  gridLineAccent: 0x006688, // Brighter grid lines
  wall: 0x001122, // Dark wall base
  wallGlow: 0x00aaff, // Wall edge glow
} as const

// ============================================
// CAMERA CONFIGURATION
// ============================================

export const CAMERA_CONFIG = {
  firstPerson: {
    fov: 90,
    offsetY: 1.5, // Height above cycle
    offsetZ: 0, // At cycle position
  },
  thirdPerson: {
    fov: 75,
    offsetY: 4, // Height above cycle
    offsetZ: -8, // Behind cycle
  },
  topDown: {
    fov: 60,
    height: 80,
  },
} as const

export const CAMERA_MODES: CameraMode[] = ['thirdPerson', 'firstPerson', 'topDown']

// ============================================
// PHYSICS / TIMING
// ============================================

/** Fixed physics timestep (60 Hz) */
export const PHYSICS_TIMESTEP = 1000 / 60

/** Maximum delta time to prevent spiral of death */
export const MAX_DELTA = 250

/** Countdown duration in seconds */
export const COUNTDOWN_DURATION = 3

// ============================================
// SPAWN POSITIONS
// ============================================

/** Base spawn configurations (can be randomized) */
const BASE_SPAWN_CONFIGS: Array<{
  position: { x: number; z: number }
  direction: GridDirection
}> = [
  // South side, facing north
  { position: { x: 0, z: ARENA_HALF - 10 }, direction: 'north' },
  // North side, facing south
  { position: { x: 0, z: -ARENA_HALF + 10 }, direction: 'south' },
  // West side, facing east
  { position: { x: -ARENA_HALF + 10, z: 0 }, direction: 'east' },
  // East side, facing west
  { position: { x: ARENA_HALF - 10, z: 0 }, direction: 'west' },
]

/** Generate randomized spawn positions with some variance */
export function generateSpawnPositions(): Array<{
  position: { x: number; z: number }
  direction: GridDirection
}> {
  // Shuffle the base positions
  const shuffled = [...BASE_SPAWN_CONFIGS].sort(() => Math.random() - 0.5)

  // Add some randomness to positions (within ±20 units along the edge)
  return shuffled.map((spawn) => {
    const variance = (Math.random() - 0.5) * 40

    // Add variance perpendicular to facing direction
    let newX = spawn.position.x
    let newZ = spawn.position.z

    if (spawn.direction === 'north' || spawn.direction === 'south') {
      newX += variance
    } else {
      newZ += variance
    }

    // Clamp to arena bounds with margin
    const margin = 15
    newX = Math.max(-ARENA_HALF + margin, Math.min(ARENA_HALF - margin, newX))
    newZ = Math.max(-ARENA_HALF + margin, Math.min(ARENA_HALF - margin, newZ))

    return {
      position: { x: newX, z: newZ },
      direction: spawn.direction,
    }
  })
}

/** Default spawn positions (for backwards compatibility) */
export const SPAWN_POSITIONS = BASE_SPAWN_CONFIGS

// ============================================
// INPUT CONFIGURATION
// ============================================

export const KEY_MAPPINGS: KeyMapping[] = [
  { key: 'KeyA', action: 'turnLeft' },
  { key: 'ArrowLeft', action: 'turnLeft' },
  { key: 'KeyD', action: 'turnRight' },
  { key: 'ArrowRight', action: 'turnRight' },
  { key: 'KeyW', action: 'jump' },
  { key: 'ArrowUp', action: 'jump' },
  { key: 'KeyV', action: 'toggleCamera' },
  { key: 'Escape', action: 'pause' },
  { key: 'Space', action: 'confirm' },
  { key: 'Enter', action: 'confirm' },
]

// ============================================
// AI CONFIGURATION
// ============================================

export const AI_CONFIG = {
  /** How far ahead AI looks for obstacles */
  lookAheadDistance: 25,
  /** Minimum distance before AI considers turning */
  minTurnDistance: 4,
  /** Randomness factor (0-1) for AI decisions */
  randomFactor: 0.15,
  /** How often AI recalculates (ms) */
  decisionInterval: 60,
} as const

// ============================================
// POST-PROCESSING
// ============================================

export const BLOOM_CONFIG = {
  strength: 0.15,
  radius: 0.2,
  threshold: 0.6,
} as const

// ============================================
// JUMP CONFIGURATION
// ============================================

/** Jump height in world units */
export const JUMP_HEIGHT = 4

/** Jump duration in milliseconds (longer for more fun) */
export const JUMP_DURATION = 900

/** Cooldown between jumps in milliseconds */
export const JUMP_COOLDOWN = 800

// ============================================
// TURNING CONFIGURATION
// ============================================

/** Turn speed in radians per second */
export const TURN_SPEED = 4.0

/** Minimum angle difference to consider turn complete */
export const TURN_THRESHOLD = 0.01

// ============================================
// EXPLOSION CONFIGURATION
// ============================================

/** Number of particles in explosion */
export const EXPLOSION_PARTICLE_COUNT = 50

/** Size of explosion particles */
export const EXPLOSION_PARTICLE_SIZE = 0.15

/** Duration of explosion in milliseconds */
export const EXPLOSION_DURATION = 1500

/** Initial explosion velocity */
export const EXPLOSION_VELOCITY = 8

/** Gravity for explosion particles */
export const EXPLOSION_GRAVITY = 15

// ============================================
// DIRECTION UTILITIES
// ============================================

export const DIRECTION_VECTORS: Record<GridDirection, { x: number; z: number }> = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  east: { x: 1, z: 0 },
  west: { x: -1, z: 0 },
}

export const DIRECTION_ROTATIONS: Record<GridDirection, number> = {
  north: 0,
  east: Math.PI / 2,
  south: Math.PI,
  west: -Math.PI / 2,
}

export const TURN_LEFT: Record<GridDirection, GridDirection> = {
  north: 'west',
  west: 'south',
  south: 'east',
  east: 'north',
}

export const TURN_RIGHT: Record<GridDirection, GridDirection> = {
  north: 'east',
  east: 'south',
  south: 'west',
  west: 'north',
}

/** Convert GridDirection to angle in radians */
export const DIRECTION_TO_ANGLE: Record<GridDirection, number> = {
  north: 0,
  east: Math.PI / 2,
  south: Math.PI,
  west: -Math.PI / 2,
}

/** Get nearest GridDirection from angle */
export function angleToDirection(angle: number): GridDirection {
  // Normalize angle to 0-2PI
  let normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

  if (normalized > Math.PI * 1.75 || normalized <= Math.PI * 0.25) return 'north'
  if (normalized > Math.PI * 0.25 && normalized <= Math.PI * 0.75) return 'east'
  if (normalized > Math.PI * 0.75 && normalized <= Math.PI * 1.25) return 'south'
  return 'west'
}

/** Normalize angle to -PI to PI range */
export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2
  while (angle < -Math.PI) angle += Math.PI * 2
  return angle
}
