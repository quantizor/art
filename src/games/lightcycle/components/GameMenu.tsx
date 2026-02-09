/**
 * Game Menu
 *
 * Menu overlays for countdown, pause, and game over states.
 * No start menu - game starts immediately.
 */

import { useGame, GameActions } from '../state/GameContext'

function getCycleName(id: string): string {
  if (id === 'player') return 'YOU'
  return id.toUpperCase().replace('-', ' ')
}

export function GameMenu() {
  const { state, dispatch } = useGame()

  if (state.phase === 'countdown') {
    return <CountdownOverlay count={state.countdown} />
  }

  if (state.phase === 'paused') {
    return (
      <PauseMenu
        onResume={() => dispatch(GameActions.resumeGame())}
        onRestart={() => dispatch(GameActions.restartGame())}
      />
    )
  }

  if (state.phase === 'gameOver') {
    return (
      <GameOverMenu
        winner={state.winner}
        isPlayerWinner={state.winner === 'player'}
        onRestart={() => dispatch(GameActions.restartGame())}
      />
    )
  }

  return null
}

function CountdownOverlay({ count }: { count: number }) {
  const displayText = count > 0 ? count.toString() : 'GO'
  const isGo = count === 0

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className={`text-8xl font-bold text-display uppercase tracking-widest ${
          isGo ? 'text-[var(--color-primary)]' : 'text-white'
        }`}
        style={{
          textShadow: isGo
            ? '0 0 40px var(--color-primary-glow), 0 0 80px var(--color-primary-glow)'
            : '0 0 20px rgba(255,255,255,0.5)',
        }}
      >
        {displayText}
      </div>
    </div>
  )
}

function PauseMenu({
  onResume,
  onRestart,
}: {
  onResume: () => void
  onRestart: () => void
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
      <div className="bg-black/90 p-8 text-center">
        <h2 className="text-3xl font-bold text-display uppercase tracking-widest text-[var(--color-text-primary)] mb-8">
          Paused
        </h2>

        <div className="space-y-3">
          <button
            onClick={onResume}
            className="block w-full bg-[var(--color-primary)] text-black px-6 py-3 text-sm uppercase tracking-widest font-bold hover:brightness-110 transition-all cursor-pointer"
          >
            Resume
          </button>
          <button
            onClick={onRestart}
            className="block w-full bg-[var(--color-gray-800)] text-[var(--color-text-primary)] px-6 py-3 text-sm uppercase tracking-widest font-bold hover:bg-[var(--color-gray-700)] transition-all cursor-pointer"
          >
            Restart
          </button>
        </div>

        <p className="text-xs text-[var(--color-text-tertiary)] mt-6">
          ESC or SPACE to resume
        </p>
      </div>
    </div>
  )
}

function GameOverMenu({
  winner,
  isPlayerWinner,
  onRestart,
}: {
  winner: string | null
  isPlayerWinner: boolean
  onRestart: () => void
}) {
  return (
    <div className="absolute inset-0 flex items-end justify-center pb-24 pointer-events-none">
      <div className="bg-black/70 p-6 text-center min-w-[280px] pointer-events-auto">
        {/* Result */}
        <h2
          className={`text-3xl font-bold text-display uppercase tracking-widest mb-2 ${
            isPlayerWinner ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'
          }`}
        >
          {isPlayerWinner ? 'Victory' : 'Derezzed'}
        </h2>

        <p className="text-[var(--color-text-secondary)] text-sm uppercase tracking-wider mb-6">
          {winner ? `${getCycleName(winner)} win${winner === 'player' ? '' : 's'}` : 'Draw'}
        </p>

        {/* Restart button */}
        <button
          onClick={onRestart}
          className="block w-full bg-[var(--color-primary)] text-black px-6 py-3 text-sm uppercase tracking-widest font-bold hover:brightness-110 transition-all cursor-pointer"
        >
          Play Again
        </button>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-3">
          SPACE to restart
        </p>
      </div>
    </div>
  )
}
