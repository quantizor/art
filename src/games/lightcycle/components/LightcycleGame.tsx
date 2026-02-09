/**
 * Lightcycle Game Component
 *
 * Main component that orchestrates the Three.js game and React UI.
 */

import { useEffect, useRef, useCallback } from 'react'
import { GameProvider, useGame, useGameState, useGameDispatch, GameActions } from '../state/GameContext'
import { GameLoop } from '../engine/GameLoop'
import { GameHUD } from './GameHUD'
import { GameMenu } from './GameMenu'

/**
 * Inner component that has access to game context
 */
function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<GameLoop | null>(null)
  const { state, dispatch } = useGame()

  // Stable reference to state for game loop
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const getState = useCallback(() => stateRef.current, [])

  // Initialize game loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Create game loop
    const gameLoop = new GameLoop(canvas, dispatch, getState)
    gameLoopRef.current = gameLoop

    // Initialize cycles from state
    gameLoop.initializeCycles(state.cycles)

    // Start the loop
    gameLoop.start()

    return () => {
      gameLoop.dispose()
      gameLoopRef.current = null
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-initialize cycles when game restarts
  useEffect(() => {
    if (state.phase === 'countdown' && gameLoopRef.current) {
      gameLoopRef.current.initializeCycles(state.cycles)
    }
  }, [state.phase, state.cycles])

  // Reset game loop on restart
  useEffect(() => {
    if (state.phase === 'menu' && gameLoopRef.current) {
      gameLoopRef.current.reset()
    }
  }, [state.phase])

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />

      {/* UI Overlays */}
      {state.phase === 'playing' && <GameHUD />}
      <GameMenu />
    </div>
  )
}

/**
 * Main exported component with provider
 */
export function LightcycleGame() {
  return (
    <GameProvider>
      <GameCanvas />
    </GameProvider>
  )
}
