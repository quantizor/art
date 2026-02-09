/**
 * Game HUD
 *
 * Minimal heads-up display with controls in bottom-left.
 */

import { useState, useEffect, useRef } from 'react'
import { useGameState } from '../state/GameContext'

function getCycleName(id: string): string {
  if (id === 'player') return 'PLAYER'
  return id.toUpperCase().replace('-', ' ')
}

export function GameHUD() {
  const state = useGameState()
  const aliveCycles = state.cycles.filter((c) => c.isAlive)
  const [eliminationMessage, setEliminationMessage] = useState<string | null>(null)
  const [winnerMessage, setWinnerMessage] = useState<string | null>(null)
  const prevAliveRef = useRef<Set<string>>(new Set())
  const prevPhaseRef = useRef(state.phase)

  // Track eliminations
  useEffect(() => {
    const currentAlive = new Set(aliveCycles.map((c) => c.id))
    const prevAlive = prevAliveRef.current

    // Find who was eliminated
    for (const id of prevAlive) {
      if (!currentAlive.has(id) && id !== 'player') {
        // Someone else was eliminated
        setEliminationMessage(`${getCycleName(id)} DEREZZED`)

        // Clear after 3 seconds
        const timer = setTimeout(() => {
          setEliminationMessage(null)
        }, 3000)

        return () => clearTimeout(timer)
      }
    }

    prevAliveRef.current = currentAlive
  }, [aliveCycles])

  // Show winner message in NPC mode
  useEffect(() => {
    if (state.phase === 'gameOver' && state.isNPCMode && prevPhaseRef.current !== 'gameOver') {
      const winner = state.winner
      if (winner) {
        setWinnerMessage(`${getCycleName(winner)} WINS`)
      } else {
        setWinnerMessage('DRAW')
      }

      // Clear after 1.5 seconds
      const timer = setTimeout(() => {
        setWinnerMessage(null)
      }, 1500)

      return () => clearTimeout(timer)
    }
    prevPhaseRef.current = state.phase
  }, [state.phase, state.winner, state.isNPCMode])

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Winner message in NPC mode - center screen */}
      {winnerMessage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="text-4xl font-bold text-display uppercase tracking-widest text-[var(--color-primary)]"
            style={{
              textShadow: '0 0 30px var(--color-primary), 0 0 60px var(--color-primary)',
              animation: 'pulse 0.5s ease-in-out infinite',
            }}
          >
            {winnerMessage}
          </div>
        </div>
      )}

      {/* Elimination notification - top 20% */}
      {eliminationMessage && !winnerMessage && (
        <div className="absolute inset-x-0 top-0 h-[20%] flex items-center justify-center">
          <div
            className="text-2xl font-bold text-display uppercase tracking-widest text-[var(--color-danger)] animate-pulse"
            style={{
              textShadow: '0 0 20px var(--color-danger), 0 0 40px var(--color-danger)',
            }}
          >
            {eliminationMessage}
          </div>
        </div>
      )}

      {/* Demo mode indicator */}
      {state.isNPCMode && state.phase !== 'gameOver' && (
        <div className="absolute top-4 left-4">
          <div className="bg-black/70 px-3 py-2 text-sm">
            <span className="text-[var(--color-warning)] uppercase tracking-wide">DEMO MODE</span>
            <span className="text-[var(--color-text-secondary)] ml-2">— Press A/D to play</span>
          </div>
        </div>
      )}

      {/* Bottom left - Controls */}
      <div className="absolute bottom-4 left-4">
        <div className="bg-black/60 p-3 text-xs space-y-1">
          <div className="flex gap-4 text-[var(--color-text-secondary)]">
            <span><kbd className="text-[var(--color-primary)]">A/D</kbd> turn</span>
            <span><kbd className="text-[var(--color-primary)]">W</kbd> jump</span>
            <span><kbd className="text-[var(--color-primary)]">V</kbd> camera</span>
          </div>
        </div>
      </div>

      {/* Top right - minimal cycle count */}
      <div className="absolute top-4 right-4">
        <div className="bg-black/60 px-3 py-2 text-sm">
          <span className="text-[var(--color-text-secondary)]">alive: </span>
          <span className="text-[var(--color-primary)] font-bold">{aliveCycles.length}</span>
        </div>
      </div>
    </div>
  )
}
