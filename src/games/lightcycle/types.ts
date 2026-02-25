/**
 * TRON Lightcycle Game Types
 *
 * Core type definitions for the lightcycle game engine.
 */

import type * as THREE from 'three'

/**
 * Game phase state machine
 */
export type GamePhase = 'menu' | 'countdown' | 'playing' | 'paused' | 'gameOver'

/**
 * Camera perspective modes
 */
export type CameraMode = 'firstPerson' | 'thirdPerson' | 'topDown'

/**
 * Grid-aligned movement directions (for reference/AI)
 */
export type GridDirection = 'north' | 'east' | 'south' | 'west'

/**
 * Grid position (discrete coordinates)
 */
export interface GridPosition {
  x: number
  z: number
}

/**
 * A single segment of a light trail
 */
export interface TrailSegment {
  start: GridPosition
  end: GridPosition
  direction: GridDirection
  /** Y position at segment start (for height-aware collision) */
  startY: number
  /** Y position at segment end (for height-aware collision) */
  endY: number
  /** Timestamp when this segment was created (for expiry) */
  timestamp: number
}

/**
 * Individual cycle state
 */
export interface CycleState {
  id: string
  gridPosition: GridPosition
  direction: GridDirection
  /** Continuous angle in radians (0 = north, PI/2 = east, PI = south, -PI/2 = west) */
  angle: number
  /** Target angle for smooth turning (-1 = not turning) */
  targetAngle: number
  /** Whether currently turning */
  isTurning: boolean
  color: number // THREE.js hex color
  isAlive: boolean
  trail: TrailSegment[]
  isPlayer: boolean
  /** Speed multiplier (1.0 = normal) */
  speed: number
  /** Whether trail has been activated (after first turn) */
  trailActive: boolean
  /** Jump state */
  isJumping: boolean
  jumpStartTime: number
  lastJumpTime: number
  /** AI configuration profile (undefined for human player) */
  aiProfile?: AIProfile
}

/**
 * Full game state
 */
export interface GameState {
  phase: GamePhase
  cycles: CycleState[]
  cameraMode: CameraMode
  countdown: number // 3, 2, 1, 0 (go)
  winner: string | null
  round: number
  scores: Record<string, number> // id -> score
  /** Whether player is AI-controlled (NPC demo mode) */
  isNPCMode: boolean
  /** Whether to use the fallback geometry model instead of GLB */
  useFallbackModel: boolean
}

/**
 * Game actions for state updates
 */
export interface GameActions {
  // Phase transitions
  startGame: () => void
  pauseGame: () => void
  resumeGame: () => void
  restartGame: () => void
  endGame: (winnerId: string | null) => void

  // Gameplay
  turnCycle: (cycleId: string, direction: 'left' | 'right') => void
  moveCycleForward: (cycleId: string) => void
  killCycle: (cycleId: string) => void
  addTrailSegment: (cycleId: string, segment: TrailSegment) => void

  // Camera
  toggleCameraMode: () => void
  setCameraMode: (mode: CameraMode) => void

  // Countdown
  decrementCountdown: () => void

  // Reset
  resetCycles: () => void
}

/**
 * Complete store type
 */
export type GameStore = GameState & GameActions

/**
 * Input action types
 */
export type InputAction = 'turnLeft' | 'turnRight' | 'jump' | 'toggleCamera' | 'toggleModel' | 'pause' | 'confirm'

/**
 * Keyboard mapping
 */
export interface KeyMapping {
  key: string
  action: InputAction
}

/**
 * Collision result
 */
export interface CollisionResult {
  collided: boolean
  type: 'wall' | 'trail' | 'cycle' | null
  cycleId: string | null
}

/**
 * AI decision state
 */
export interface AIState {
  cycleId: string
  nextTurnTime: number
  dangerLevel: number
}

// ============================================
// AI PROFILE TYPES
// ============================================

/**
 * AI difficulty tiers
 */
export type AIDifficulty = 'easy' | 'medium' | 'hard'

/**
 * AI personality archetypes that drive behavioral variety
 */
export type AIPersonality = 'aggressive' | 'defensive' | 'trapper' | 'erratic'

/**
 * Per-difficulty tuning parameters.
 * These multiply or override the base AI_CONFIG values.
 */
export interface AIDifficultyProfile {
  /** Multiplier on lookAheadDistance (0.6 = shorter vision, 1.5 = further) */
  lookAheadMultiplier: number
  /** Multiplier on the base decision interval (higher = slower reactions) */
  decisionIntervalMultiplier: number
  /** Probability [0-1] of making a random suboptimal move */
  mistakeRate: number
  /** How many escape paths the AI projects forward (1-3 levels deep) */
  planningDepth: number
  /** Whether this difficulty considers opponent positions */
  considersOpponents: boolean
  /** Probability [0-1] of correctly evaluating a jump opportunity */
  jumpAccuracy: number
}

/**
 * Personality-specific scoring weight multipliers.
 * Each field multiplies the base weight for that scoring factor.
 */
export interface AIPersonalityWeights {
  /** Weight multiplier for forward distance scoring */
  forwardDistanceWeight: number
  /** Weight multiplier for escape path scoring */
  escapePathWeight: number
  /** Weight multiplier for self-trail danger scoring */
  selfTrailDangerWeight: number
  /** Weight multiplier for opponent proximity (positive = drawn to, negative = avoids) */
  opponentProximityWeight: number
  /** Weight multiplier for center-of-arena preference */
  centerPreferenceWeight: number
  /** Multiplier on minTurnDistance threshold (higher = turns earlier) */
  proactiveTurnThreshold: number
  /** Multiplier on jump probability when opportunity arises */
  jumpEagerness: number
}

/**
 * Full AI profile combining difficulty and personality.
 * Assigned to each AI cycle at spawn time.
 */
export interface AIProfile {
  difficulty: AIDifficulty
  personality: AIPersonality
  difficultyParams: AIDifficultyProfile
  personalityWeights: AIPersonalityWeights
}

// ============================================
// AI STRATEGY TYPES
// ============================================

/**
 * Named strategies the AI can execute
 */
export type AIStrategyName = 'headOn' | 'cutOff' | 'box' | 'wallRide' | 'survive'

/**
 * Per-cycle strategy state tracked across frames.
 * AI-private — NOT part of CycleState (which is game state).
 */
export interface AIStrategyState {
  /** Current active strategy */
  activeStrategy: AIStrategyName
  /** ID of the targeted opponent (null for survive/wallRide) */
  targetId: string | null
  /** Physics time when this strategy was adopted */
  strategyStartTime: number
  /** Consecutive decision ticks this strategy has been active */
  persistenceTicks: number
  /** Physics time of last decision evaluation */
  lastEvalTime: number
  /** Decision counter (for deterministic mistake cadence) */
  decisionCount: number
  /** Last turn time (for turn cooldown enforcement) */
  lastTurnTime: number
}

/**
 * Per-personality strategy preference weights.
 * Higher weight = more likely to be selected when conditions allow.
 */
export interface AIStrategyPreferences {
  headOnPreference: number
  cutOffPreference: number
  boxPreference: number
  wallRidePreference: number
  survivePreference: number
  /** Min ticks before strategy can be reconsidered */
  minPersistence: number
  /** Max ticks before strategy is forcibly reconsidered */
  maxPersistence: number
}

/**
 * Three.js object references for cleanup
 */
export interface SceneObjects {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  cycleModels: Map<string, THREE.Group>
  trailMeshes: Map<string, THREE.Mesh[]>
  arena: THREE.Group
}
