import { rootRouteId, useMatch, useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { Button } from '~/ui/Button'

const CELL = 16
const TICK_MS = 60
const RADIUS = 2
const NEIGHBORHOOD = RADIUS * 2 + 1
const PATTERNS = 1 << NEIGHBORHOOD

function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function CAFlow() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const seed = Date.now()
    const rand = mulberry32(seed)
    const rule = new Uint8Array(PATTERNS)
    for (let i = 0; i < PATTERNS; i++) rule[i] = rand() < 0.5 ? 1 : 0
    rule[0] = 0
    rule[PATTERNS - 1] = 0

    let row = new Uint8Array(0)
    let cols = 0
    let rowCount = 0
    let currentRow = 0
    let timer = 0

    const drawRow = () => {
      ctx.fillStyle = '#fff'
      const y = currentRow * CELL
      for (let i = 0; i < cols; i++) {
        if (row[i]) ctx.fillRect(i * CELL, y, CELL, CELL)
      }
    }

    const reset = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      cols = Math.max(1, Math.ceil(rect.width / CELL))
      rowCount = Math.max(1, Math.ceil(rect.height / CELL))
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, rect.width, rect.height)

      row = new Uint8Array(cols)
      for (let i = 0; i < cols; i++) row[i] = rand() < 0.5 ? 1 : 0
      currentRow = 0
      drawRow()
    }

    const step = () => {
      if (currentRow >= rowCount - 1) return false
      const next = new Uint8Array(cols)
      for (let i = 0; i < cols; i++) {
        let idx = 0
        for (let k = -RADIUS; k <= RADIUS; k++) {
          idx = (idx << 1) | row[(i + k + cols) % cols]
        }
        next[i] = rule[idx]
      }
      row = next
      currentRow++
      drawRow()
      return true
    }

    const start = () => {
      reset()
      if (timer) clearInterval(timer)
      timer = window.setInterval(() => {
        if (!step()) {
          clearInterval(timer)
          timer = 0
        }
      }, TICK_MS)
    }

    start()

    let resizeTimer = 0
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(start, 150)
    }
    window.addEventListener('resize', onResize)

    return () => {
      if (timer) clearInterval(timer)
      window.removeEventListener('resize', onResize)
      clearTimeout(resizeTimer)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full bg-black"
    />
  )
}

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })

  console.error('DefaultCatchBoundary Error:', error)

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <CAFlow />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="bg-black p-6 flex flex-col items-center gap-6 max-w-xl">
          <div className="flex flex-col items-center gap-2">
            <strong className="text-lg">Something went wrong!</strong>
            <pre className="text-sm whitespace-pre-wrap break-words text-center">
              {error instanceof Error ? error.message : String(error)}
            </pre>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Button
              variant="primary"
              onClick={() => {
                router.invalidate()
              }}
            >
              Try Again
            </Button>
            {isRoot ? (
              <Button
                variant="secondary"
                onClick={() => {
                  router.navigate({ to: '/' })
                }}
              >
                Home
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  window.history.back()
                }}
              >
                Go Back
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
