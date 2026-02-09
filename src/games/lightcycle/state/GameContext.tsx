/**
 * Game State Context
 *
 * React Context + useReducer for lightcycle game state management.
 * Keeps all state scoped to the game component tree.
 */

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import {
  CYCLE_COLORS,
  generateSpawnPositions,
  TURN_LEFT,
  TURN_RIGHT,
  DIRECTION_TO_ANGLE,
  normalizeAngle,
} from '../constants'
import type {
  CameraMode,
  CycleState,
  GamePhase,
  GameState,
  GridDirection,
  TrailSegment,
} from '../types'

// ============================================
// ACTION TYPES
// ============================================

type GameAction =
  | { type: 'START_GAME' }
  | { type: 'PAUSE_GAME' }
  | { type: 'RESUME_GAME' }
  | { type: 'RESTART_GAME' }
  | { type: 'END_GAME'; winnerId: string | null }
  | { type: 'TURN_CYCLE'; cycleId: string; direction: 'left' | 'right' }
  | { type: 'START_TURN'; cycleId: string; direction: 'left' | 'right' }
  | { type: 'UPDATE_ANGLE'; cycleId: string; angle: number }
  | { type: 'END_TURN'; cycleId: string }
  | { type: 'MOVE_CYCLE'; cycleId: string }
  | { type: 'KILL_CYCLE'; cycleId: string }
  | { type: 'ADD_TRAIL_SEGMENT'; cycleId: string; segment: TrailSegment }
  | { type: 'ACTIVATE_TRAIL'; cycleId: string }
  | { type: 'TOGGLE_CAMERA' }
  | { type: 'SET_CAMERA'; mode: CameraMode }
  | { type: 'DECREMENT_COUNTDOWN' }
  | { type: 'SET_PHASE'; phase: GamePhase }
  | { type: 'UPDATE_CYCLE_POSITION'; cycleId: string; x: number; z: number }
  | { type: 'START_JUMP'; cycleId: string; time: number }
  | { type: 'END_JUMP'; cycleId: string }
  | { type: 'TAKE_CONTROL' }

// ============================================
// INITIAL STATE FACTORY
// ============================================

function createInitialCycles(): CycleState[] {
  const colors = [CYCLE_COLORS.player, CYCLE_COLORS.ai1, CYCLE_COLORS.ai2, CYCLE_COLORS.ai3]
  // Use randomized spawn positions for variety
  const spawnPositions = generateSpawnPositions()

  return spawnPositions.map((spawn, index) => ({
    id: index === 0 ? 'player' : `ai-${index}`,
    gridPosition: { ...spawn.position },
    direction: spawn.direction,
    angle: DIRECTION_TO_ANGLE[spawn.direction],
    targetAngle: -1,
    isTurning: false,
    color: colors[index],
    isAlive: true,
    trail: [],
    isPlayer: index === 0,
    speed: 1.0,
    trailActive: false, // Trail only starts after first turn
    isJumping: false,
    jumpStartTime: 0,
    lastJumpTime: 0,
  }))
}

function createInitialState(): GameState {
  return {
    phase: 'countdown', // Start directly in countdown, skip menu
    cycles: createInitialCycles(),
    cameraMode: 'thirdPerson',
    countdown: 3,
    winner: null,
    round: 1,
    scores: {
      player: 0,
      'ai-1': 0,
      'ai-2': 0,
      'ai-3': 0,
    },
    isNPCMode: true, // Start in NPC/demo mode until user takes control
  }
}

// ============================================
// REDUCER
// ============================================

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...state,
        phase: 'countdown',
        countdown: 3,
        cycles: createInitialCycles(),
        winner: null,
      }

    case 'PAUSE_GAME':
      return state.phase === 'playing' ? { ...state, phase: 'paused' } : state

    case 'RESUME_GAME':
      return state.phase === 'paused' ? { ...state, phase: 'playing' } : state

    case 'RESTART_GAME':
      return {
        ...createInitialState(),
        scores: state.scores,
        round: state.round,
      }

    case 'END_GAME': {
      const newScores = { ...state.scores }
      if (action.winnerId && newScores[action.winnerId] !== undefined) {
        newScores[action.winnerId]++
      }
      return {
        ...state,
        phase: 'gameOver',
        winner: action.winnerId,
        scores: newScores,
      }
    }

    case 'TURN_CYCLE': {
      return {
        ...state,
        cycles: state.cycles.map((cycle) => {
          if (cycle.id !== action.cycleId || !cycle.isAlive) return cycle

          const newDirection: GridDirection =
            action.direction === 'left'
              ? TURN_LEFT[cycle.direction]
              : TURN_RIGHT[cycle.direction]

          // Activate trail on first turn
          return {
            ...cycle,
            direction: newDirection,
            angle: DIRECTION_TO_ANGLE[newDirection],
            trailActive: true,
          }
        }),
      }
    }

    case 'START_TURN': {
      return {
        ...state,
        cycles: state.cycles.map((cycle) => {
          if (cycle.id !== action.cycleId || !cycle.isAlive || cycle.isTurning) return cycle

          // Calculate target angle (90 degrees in the turn direction)
          const turnAmount = action.direction === 'left' ? -Math.PI / 2 : Math.PI / 2
          const targetAngle = normalizeAngle(cycle.angle + turnAmount)

          return {
            ...cycle,
            isTurning: true,
            targetAngle,
            trailActive: true,
          }
        }),
      }
    }

    case 'UPDATE_ANGLE': {
      return {
        ...state,
        cycles: state.cycles.map((cycle) => {
          if (cycle.id !== action.cycleId) return cycle
          return { ...cycle, angle: action.angle }
        }),
      }
    }

    case 'END_TURN': {
      return {
        ...state,
        cycles: state.cycles.map((cycle) => {
          if (cycle.id !== action.cycleId) return cycle

          const newDirection: GridDirection =
            cycle.targetAngle === 0
              ? 'north'
              : cycle.targetAngle === Math.PI / 2
                ? 'east'
                : cycle.targetAngle === Math.PI || cycle.targetAngle === -Math.PI
                  ? 'south'
                  : 'west'

          return {
            ...cycle,
            isTurning: false,
            targetAngle: -1,
            angle: cycle.targetAngle !== -1 ? cycle.targetAngle : cycle.angle,
            direction: newDirection,
          }
        }),
      }
    }

    case 'ACTIVATE_TRAIL': {
      return {
        ...state,
        cycles: state.cycles.map((cycle) => {
          if (cycle.id !== action.cycleId) return cycle
          return { ...cycle, trailActive: true }
        }),
      }
    }

    case 'MOVE_CYCLE': {
      return {
        ...state,
        cycles: state.cycles.map((cycle) => {
          if (cycle.id !== action.cycleId || !cycle.isAlive) return cycle
          return cycle
        }),
      }
    }

    case 'UPDATE_CYCLE_POSITION': {
      return {
        ...state,
        cycles: state.cycles.map((cycle) => {
          if (cycle.id !== action.cycleId) return cycle
          return {
            ...cycle,
            gridPosition: { x: action.x, z: action.z },
          }
        }),
      }
    }

    case 'START_JUMP': {
      return {
        ...state,
        cycles: state.cycles.map((cycle) => {
          if (cycle.id !== action.cycleId || !cycle.isAlive) return cycle
          return {
            ...cycle,
            isJumping: true,
            jumpStartTime: action.time,
          }
        }),
      }
    }

    case 'END_JUMP': {
      return {
        ...state,
        cycles: state.cycles.map((cycle) => {
          if (cycle.id !== action.cycleId) return cycle
          return {
            ...cycle,
            isJumping: false,
            lastJumpTime: performance.now(),
          }
        }),
      }
    }

    case 'KILL_CYCLE': {
      const updatedCycles = state.cycles.map((cycle) =>
        cycle.id === action.cycleId ? { ...cycle, isAlive: false } : cycle
      )

      const aliveCycles = updatedCycles.filter((c) => c.isAlive)
      const playerAlive = aliveCycles.some((c) => c.isPlayer)
      const aiAlive = aliveCycles.some((c) => !c.isPlayer)

      // Game ends only when there's a clear winner or all are dead
      // If player dies, game continues until AI finish fighting
      if (aliveCycles.length <= 1) {
        const winnerId = aliveCycles.length === 1 ? aliveCycles[0].id : null
        const newScores = { ...state.scores }
        if (winnerId && newScores[winnerId] !== undefined) {
          newScores[winnerId]++
        }
        return {
          ...state,
          cycles: updatedCycles,
          phase: 'gameOver',
          winner: winnerId,
          scores: newScores,
        }
      }

      // If only player died and AI still fighting, continue the game
      // (player watches as spectator)
      return { ...state, cycles: updatedCycles }
    }

    case 'ADD_TRAIL_SEGMENT': {
      return {
        ...state,
        cycles: state.cycles.map((cycle) => {
          if (cycle.id !== action.cycleId) return cycle
          return {
            ...cycle,
            trail: [...cycle.trail, action.segment],
          }
        }),
      }
    }

    case 'TOGGLE_CAMERA': {
      const modes: CameraMode[] = ['thirdPerson', 'firstPerson', 'topDown']
      const currentIndex = modes.indexOf(state.cameraMode)
      const nextIndex = (currentIndex + 1) % modes.length
      return { ...state, cameraMode: modes[nextIndex] }
    }

    case 'SET_CAMERA':
      return { ...state, cameraMode: action.mode }

    case 'DECREMENT_COUNTDOWN': {
      const newCountdown = state.countdown - 1
      if (newCountdown < 0) {
        return { ...state, phase: 'playing', countdown: 0 }
      }
      return { ...state, countdown: newCountdown }
    }

    case 'SET_PHASE':
      return { ...state, phase: action.phase }

    case 'TAKE_CONTROL':
      return { ...state, isNPCMode: false }

    default:
      return state
  }
}

// ============================================
// CONTEXT
// ============================================

interface GameContextValue {
  state: GameState
  dispatch: Dispatch<GameAction>
}

const GameContext = createContext<GameContextValue | null>(null)

// ============================================
// PROVIDER
// ============================================

interface GameProviderProps {
  children: ReactNode
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  )
}

// ============================================
// HOOKS
// ============================================

export function useGameState(): GameState {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGameState must be used within a GameProvider')
  }
  return context.state
}

export function useGameDispatch(): Dispatch<GameAction> {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGameDispatch must be used within a GameProvider')
  }
  return context.dispatch
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGame must be used within a GameProvider')
  }
  return context
}

// ============================================
// ACTION CREATORS (convenience functions)
// ============================================

export const GameActions = {
  startGame: (): GameAction => ({ type: 'START_GAME' }),
  pauseGame: (): GameAction => ({ type: 'PAUSE_GAME' }),
  resumeGame: (): GameAction => ({ type: 'RESUME_GAME' }),
  restartGame: (): GameAction => ({ type: 'RESTART_GAME' }),
  endGame: (winnerId: string | null): GameAction => ({ type: 'END_GAME', winnerId }),
  turnCycle: (cycleId: string, direction: 'left' | 'right'): GameAction => ({
    type: 'TURN_CYCLE',
    cycleId,
    direction,
  }),
  startTurn: (cycleId: string, direction: 'left' | 'right'): GameAction => ({
    type: 'START_TURN',
    cycleId,
    direction,
  }),
  updateAngle: (cycleId: string, angle: number): GameAction => ({
    type: 'UPDATE_ANGLE',
    cycleId,
    angle,
  }),
  endTurn: (cycleId: string): GameAction => ({ type: 'END_TURN', cycleId }),
  activateTrail: (cycleId: string): GameAction => ({ type: 'ACTIVATE_TRAIL', cycleId }),
  moveCycle: (cycleId: string): GameAction => ({ type: 'MOVE_CYCLE', cycleId }),
  killCycle: (cycleId: string): GameAction => ({ type: 'KILL_CYCLE', cycleId }),
  addTrailSegment: (cycleId: string, segment: TrailSegment): GameAction => ({
    type: 'ADD_TRAIL_SEGMENT',
    cycleId,
    segment,
  }),
  toggleCamera: (): GameAction => ({ type: 'TOGGLE_CAMERA' }),
  setCamera: (mode: CameraMode): GameAction => ({ type: 'SET_CAMERA', mode }),
  decrementCountdown: (): GameAction => ({ type: 'DECREMENT_COUNTDOWN' }),
  setPhase: (phase: GamePhase): GameAction => ({ type: 'SET_PHASE', phase }),
  updateCyclePosition: (cycleId: string, x: number, z: number): GameAction => ({
    type: 'UPDATE_CYCLE_POSITION',
    cycleId,
    x,
    z,
  }),
  startJump: (cycleId: string, time: number): GameAction => ({
    type: 'START_JUMP',
    cycleId,
    time,
  }),
  endJump: (cycleId: string): GameAction => ({ type: 'END_JUMP', cycleId }),
  takeControl: (): GameAction => ({ type: 'TAKE_CONTROL' }),
}

export type { GameAction }
