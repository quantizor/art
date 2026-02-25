/**
 * TRON Lightcycle Game Constants
 *
 * Configuration values for gameplay, rendering, and physics.
 */

import type {
  AIDifficulty,
  AIDifficultyProfile,
  AIPersonality,
  AIPersonalityWeights,
  AIStrategyPreferences,
  CameraMode,
  GridDirection,
  KeyMapping,
} from './types'

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

/** Height of light trail walls (matches racer model visual height) */
export const TRAIL_HEIGHT = 0.8

/** Width of light trail walls */
export const TRAIL_WIDTH = 0.4

/** Trail lifetime in ms before fade begins */
export const TRAIL_LIFETIME = 5000

/** Duration of trail fade-out in ms (smooth gradient disappearance) */
export const TRAIL_FADE_DURATION = 2000

/** Ground-level Y for trail bottom when not jumping */
export const TRAIL_BASE_Y = 0

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

/** Generate spawn positions: player always gets slot 0 (south, facing north),
 *  AI slots are shuffled with positional variance */
export function generateSpawnPositions(): Array<{
  position: { x: number; z: number }
  direction: GridDirection
}> {
  // Player always spawns south, facing north (index 0 is stable)
  const playerSpawn = BASE_SPAWN_CONFIGS[0]
  // Shuffle only the AI spawn slots
  const aiSpawns = BASE_SPAWN_CONFIGS.slice(1).sort(() => Math.random() - 0.5)

  const allSpawns = [playerSpawn, ...aiSpawns]

  // Add some randomness to positions (within ±20 units along the edge)
  return allSpawns.map((spawn) => {
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
  { key: 'KeyM', action: 'toggleModel' },
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
  /** Minimum distance before AI considers turning (low = dramatic last-second turns) */
  minTurnDistance: 2.5,
  /** Randomness factor (0-1) for AI decisions */
  randomFactor: 0.15,
  /** How often AI recalculates (ms) */
  decisionInterval: 60,
} as const

// ============================================
// AI DIFFICULTY PROFILES
// ============================================

export const AI_DIFFICULTY_PROFILES: Record<AIDifficulty, AIDifficultyProfile> = {
  easy: {
    lookAheadMultiplier: 0.6,
    decisionIntervalMultiplier: 2.0,
    mistakeRate: 0.25,
    planningDepth: 1,
    considersOpponents: false,
    jumpAccuracy: 0.3,
  },
  medium: {
    lookAheadMultiplier: 1.0,
    decisionIntervalMultiplier: 1.0,
    mistakeRate: 0.08,
    planningDepth: 2,
    considersOpponents: false,
    jumpAccuracy: 0.6,
  },
  hard: {
    lookAheadMultiplier: 1.5,
    decisionIntervalMultiplier: 0.7,
    mistakeRate: 0.02,
    planningDepth: 3,
    considersOpponents: true,
    jumpAccuracy: 0.9,
  },
} as const

// ============================================
// AI PERSONALITY WEIGHTS
// ============================================

export const AI_PERSONALITY_WEIGHTS: Record<AIPersonality, AIPersonalityWeights> = {
  aggressive: {
    forwardDistanceWeight: 1.5,
    escapePathWeight: 0.6,
    selfTrailDangerWeight: 0.8,
    opponentProximityWeight: 2.5,
    centerPreferenceWeight: 0.3,
    proactiveTurnThreshold: 0.7,
    jumpEagerness: 1.8,
  },
  defensive: {
    forwardDistanceWeight: 2.0,
    escapePathWeight: 2.0,
    selfTrailDangerWeight: 1.5,
    opponentProximityWeight: -1.0,
    centerPreferenceWeight: 1.5,
    proactiveTurnThreshold: 1.5,
    jumpEagerness: 0.5,
  },
  trapper: {
    forwardDistanceWeight: 1.2,
    escapePathWeight: 1.5,
    selfTrailDangerWeight: 1.2,
    opponentProximityWeight: 1.5,
    centerPreferenceWeight: 0.8,
    proactiveTurnThreshold: 1.2,
    jumpEagerness: 0.3,
  },
  erratic: {
    forwardDistanceWeight: 1.0,
    escapePathWeight: 1.0,
    selfTrailDangerWeight: 0.5,
    opponentProximityWeight: 0.5,
    centerPreferenceWeight: 0.2,
    proactiveTurnThreshold: 0.8,
    jumpEagerness: 2.0,
  },
} as const

/** Default personality assignments for the 3 AI cycles */
export const DEFAULT_AI_PERSONALITIES: readonly AIPersonality[] = [
  'aggressive',
  'defensive',
  'trapper',
] as const

// ============================================
// AI STRATEGY PREFERENCES
// ============================================

export const AI_STRATEGY_PREFERENCES: Record<AIPersonality, AIStrategyPreferences> = {
  aggressive: {
    headOnPreference: 3.0,
    cutOffPreference: 2.0,
    boxPreference: 0.5,
    wallRidePreference: 0.3,
    survivePreference: 0.5,
    minPersistence: 15,
    maxPersistence: 90,
  },
  defensive: {
    headOnPreference: 0.3,
    cutOffPreference: 0.5,
    boxPreference: 0.8,
    wallRidePreference: 3.0,
    survivePreference: 2.5,
    minPersistence: 30,
    maxPersistence: 120,
  },
  trapper: {
    headOnPreference: 0.5,
    cutOffPreference: 3.0,
    boxPreference: 3.0,
    wallRidePreference: 1.0,
    survivePreference: 0.8,
    minPersistence: 20,
    maxPersistence: 100,
  },
  erratic: {
    headOnPreference: 2.0,
    cutOffPreference: 1.5,
    boxPreference: 1.0,
    wallRidePreference: 0.5,
    survivePreference: 1.0,
    minPersistence: 5,
    maxPersistence: 30,
  },
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
