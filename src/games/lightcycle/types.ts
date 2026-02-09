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
export type InputAction = 'turnLeft' | 'turnRight' | 'jump' | 'toggleCamera' | 'pause' | 'confirm'

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
