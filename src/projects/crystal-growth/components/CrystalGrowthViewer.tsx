/**
 * Crystal Growth Viewer
 *
 * Main React component that orchestrates the DLA simulation
 * and Three.js rendering.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { SceneManager } from '../scene/SceneManager'
import { CrystalRenderer } from '../scene/CrystalRenderer'
import { FloodFillSimulation } from '../engine/FloodFillSimulation'
import { generateSeedPositions } from '../engine/SeedPlacer'
import { ControlPanel } from './ControlPanel'
import {
  DEFAULT_SIM_PARAMS,
  DEFAULT_COLOR_PARAMS,
  MAX_DELTA,
  MAX_PARTICLES,
  SEED_MIN_DISTANCE,
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_SCALE,
} from '../constants'
import type { SimulationParams, ColorParams, ColorMode, SimulationPhase } from '../types'

const COLOR_MODES: ColorMode[] = [
  'polarized', 'oilslick', 'birefringence', 'rainbow',
  'monochrome', 'dichroism', 'laue', 'conoscopic',
]

/** Generate a color palette tuned for a specific mode's visual character */
function randomPaletteForMode(mode: ColorMode): ColorParams {
  const base = {
    mode,
    bandWavelength: Math.round(8 + Math.random() * 60),
    bandAmplitude: 0.05 + Math.random() * 0.4,
    baseLightness: 0.3 + Math.random() * 0.4,
    saturation: 0.3 + Math.random() * 0.7,
    monoHue: Math.round(Math.random() * 360),
  }

  switch (mode) {
    case 'polarized':
      // Michel-Lévy chart — moderate bands, high saturation for vivid interference
      return { ...base, bandAmplitude: 0.08 + Math.random() * 0.25, saturation: 0.6 + Math.random() * 0.4 }
    case 'oilslick':
      // Thin-film — tight wavelengths for iridescent shimmer
      return { ...base, bandWavelength: Math.round(10 + Math.random() * 35), bandAmplitude: 0.1 + Math.random() * 0.3 }
    case 'birefringence':
      // Double refraction — wide hue sweep, moderate lightness
      return { ...base, baseLightness: 0.4 + Math.random() * 0.25, saturation: 0.5 + Math.random() * 0.5 }
    case 'rainbow':
      // Full spectrum — high saturation, gentle gradient
      return { ...base, bandAmplitude: 0.05 + Math.random() * 0.2, saturation: 0.7 + Math.random() * 0.3 }
    case 'monochrome':
      // Single hue — wider lightness range, subtle banding
      return { ...base, bandAmplitude: 0.1 + Math.random() * 0.35, baseLightness: 0.25 + Math.random() * 0.45, saturation: 0.4 + Math.random() * 0.6 }
    case 'dichroism':
      // Two-color absorption — moderate amplitude, mid saturation
      return { ...base, bandAmplitude: 0.1 + Math.random() * 0.25, saturation: 0.45 + Math.random() * 0.45 }
    case 'laue':
      // X-ray diffraction — tight spots, wider wavelength spacing
      return { ...base, bandWavelength: Math.round(12 + Math.random() * 50), bandAmplitude: 0.1 + Math.random() * 0.2 }
    case 'conoscopic':
      // Interference rings — moderate wavelength for visible ring spacing
      return { ...base, bandWavelength: Math.round(15 + Math.random() * 40), saturation: 0.5 + Math.random() * 0.5 }
    default:
      return base
  }
}

const SIM_PARAMS_KEY = 'crystal-growth:simParams'
const COLOR_PARAMS_KEY = 'crystal-growth:colorParams'

function loadParams<T>(key: string, defaults: T): T {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaults
    return { ...defaults, ...JSON.parse(raw) } as T
  } catch {
    return defaults
  }
}

export function CrystalGrowthViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<SceneManager | null>(null)
  const rendererRef = useRef<CrystalRenderer | null>(null)
  const simRef = useRef<FloodFillSimulation | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const [phase, setPhase] = useState<SimulationPhase>('idle')
  const [particleCount, setParticleCount] = useState(0)
  const [fps, setFps] = useState(0)
  const fpsFramesRef = useRef(0)
  const fpsTimeRef = useRef(0)
  const [simParams, setSimParams] = useState<SimulationParams>(() =>
    loadParams(SIM_PARAMS_KEY, DEFAULT_SIM_PARAMS)
  )
  const [colorParams, setColorParams] = useState<ColorParams>(() =>
    loadParams(COLOR_PARAMS_KEY, DEFAULT_COLOR_PARAMS)
  )

  // Stable refs for animation loop
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const simParamsRef = useRef(simParams)
  simParamsRef.current = simParams
  const colorParamsRef = useRef(colorParams)
  colorParamsRef.current = colorParams

  // Persist params to localStorage on change
  useEffect(() => {
    localStorage.setItem(SIM_PARAMS_KEY, JSON.stringify(simParams))
  }, [simParams])
  useEffect(() => {
    localStorage.setItem(COLOR_PARAMS_KEY, JSON.stringify(colorParams))
  }, [colorParams])

  const handleStick = useCallback(
    (
      _walkerIndex: number,
      cx: number,
      cy: number,
      seedId: number,
      growthAngle: number,
      distFromSeed: number,
      boundaryPressure: number
    ) => {
      const renderer = rendererRef.current
      const sim = simRef.current
      if (!renderer || !sim) return

      // Look up seed orientation and tilt for color computation
      const seed = sim.getSeed(seedId)
      const seedOrientation = seed ? seed.axes[0] : 0
      const seedTilt = seed ? seed.tilt : 0

      // Normalize distFromSeed to base resolution so color math stays DPI-independent
      renderer.addParticle(
        cx, cy, growthAngle, distFromSeed / GRID_SCALE, seedId,
        colorParamsRef.current, seedOrientation, seedTilt, boundaryPressure
      )
    },
    []
  )

  /** Initialize simulation with Poisson-disk seeds */
  const initSeeds = useCallback((sim: FloodFillSimulation) => {
    const positions = generateSeedPositions(
      simParamsRef.current.seedCount, GRID_WIDTH, GRID_HEIGHT, SEED_MIN_DISTANCE
    )
    sim.seedMany(positions)
  }, [])

  // Mount: create scene, renderer, simulation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new SceneManager(canvas)
    sceneRef.current = scene

    const crystalRenderer = new CrystalRenderer(scene.scene, MAX_PARTICLES)
    rendererRef.current = crystalRenderer

    const sim = new FloodFillSimulation(handleStick)
    simRef.current = sim

    // Initialize with many random seeds
    initSeeds(sim)
    setPhase('growing')

    // Resize handler
    const onResize = () => scene.resize()
    window.addEventListener('resize', onResize)

    // Animation loop
    let frameCount = 0
    let fpsFrameCount = 0
    let fpsLastTime = 0
    let smoothedFrameTime = 0
    const animate = (time: number) => {
      rafRef.current = requestAnimationFrame(animate)

      const dt = lastTimeRef.current ? Math.min(time - lastTimeRef.current, MAX_DELTA) : 16
      lastTimeRef.current = time
      frameCount++

      // FPS — exponential moving average, updates every 15 frames
      fpsFrameCount++
      if (fpsLastTime > 0) {
        const frameMs = time - fpsLastTime
        smoothedFrameTime = smoothedFrameTime === 0
          ? frameMs
          : smoothedFrameTime * 0.85 + frameMs * 0.15
      }
      fpsLastTime = time
      if (fpsFrameCount % 15 === 0) {
        setFps(smoothedFrameTime > 0 ? Math.round(1000 / smoothedFrameTime) : 0)
      }

      if (phaseRef.current === 'growing') {
        sim.update(dt)
        crystalRenderer.flush()

        // Throttle React state updates to every 10 frames
        if (frameCount % 10 === 0) {
          const count = sim.getAggregateCount()
          setParticleCount(count)
          if (sim.isDone()) {
            // Final strain pass for polished result
            crystalRenderer.applyBoundaryStrain(sim.getGrid().data)
            crystalRenderer.flush()
            setPhase('complete')
          }
        }
      }

      scene.render()
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
      crystalRenderer.dispose()
      scene.dispose()
    }
  }, [handleStick, initSeeds])

  // Click-to-seed
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      const scene = sceneRef.current
      const sim = simRef.current
      if (!canvas || !scene || !sim) return

      const rect = canvas.getBoundingClientRect()
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1

      const worldPos = scene.ndcToWorld(ndcX, ndcY)
      sim.addSeed(worldPos.x, worldPos.y)

      if (phaseRef.current === 'idle' || phaseRef.current === 'complete') {
        setPhase('growing')
      }
    },
    []
  )

  // Keyboard: Space to pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setPhase((prev) => {
          if (prev === 'growing') return 'paused'
          if (prev === 'paused') return 'growing'
          return prev
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Apply live params (speed) every frame without resetting
  useEffect(() => {
    const sim = simRef.current
    if (sim) sim.setParams(simParams)
  }, [simParams])

  // Reset only on structural param changes (seed count, axis count, color)
  const prevStructuralRef = useRef({ seedCount: simParams.seedCount, axisCount: simParams.axisCount, colorParams })
  useEffect(() => {
    const prev = prevStructuralRef.current
    const structuralChanged =
      prev.seedCount !== simParams.seedCount ||
      prev.axisCount !== simParams.axisCount ||
      prev.colorParams !== colorParams

    prevStructuralRef.current = { seedCount: simParams.seedCount, axisCount: simParams.axisCount, colorParams }

    if (!structuralChanged) return

    const sim = simRef.current
    const renderer = rendererRef.current
    if (!sim || !renderer) return
    sim.setParams(simParams)
    sim.reset()
    renderer.reset()
    initSeeds(sim)
    setParticleCount(0)
    setPhase('growing')
  }, [simParams, colorParams, initSeeds])

  const handleReset = useCallback(() => {
    const sim = simRef.current
    const renderer = rendererRef.current
    if (!sim || !renderer) return
    sim.reset()
    renderer.reset()
    initSeeds(sim)
    setParticleCount(0)
    setPhase('growing')
  }, [initSeeds])

  const handleRandomize = useCallback(() => {
    const sim = simRef.current
    const renderer = rendererRef.current
    if (!sim || !renderer) return

    // Randomize sim params (preserve speed)
    const newSimParams: SimulationParams = {
      ...simParamsRef.current,
      seedCount: Math.round(5 + Math.random() * 70),
      axisCount: Math.round(2 + Math.random() * 4),
      facets: Math.random() < 0.4 ? 0 : Math.round(3 + Math.random() * 9),
    }
    // Pick a random mode, then generate a palette tuned for it
    const mode = COLOR_MODES[Math.floor(Math.random() * COLOR_MODES.length)]
    const newColorParams: ColorParams = randomPaletteForMode(mode)

    setSimParams(newSimParams)
    setColorParams(newColorParams)

    sim.setParams(newSimParams)
    sim.reset()
    renderer.reset()
    initSeeds(sim)
    setParticleCount(0)
    setPhase('growing')
  }, [initSeeds])

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `tension-${Date.now()}.png`
    link.href = dataUrl
    link.click()
  }, [])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onClick={handleCanvasClick}
      />

      {/* Top letterbox border */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-black z-10 pointer-events-none" />

      {/* Home button — centered in top letterbox */}
      <Link
        to="/"
        className="absolute top-6 left-4 z-20 bg-black/80 border border-[var(--color-border-default)] p-2 px-3 text-white/70 hover:text-white font-mono text-xs tracking-wider pointer-events-auto"
      >
        &larr; HOME
      </Link>

      {/* Bottom letterbox border with title */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-black z-10 pointer-events-none flex items-center justify-between px-8">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-mono tracking-[0.4em] text-white/90 leading-none">
            TENSION
          </span>
          <span className="text-[11px] font-mono tracking-[0.25em] text-white/40 leading-none">
            FEB 2026
          </span>
        </div>
        <span className="text-[11px] font-mono text-white/30 tabular-nums">
          {fps} FPS
        </span>
      </div>

      <ControlPanel
        phase={phase}
        particleCount={particleCount}
        simParams={simParams}
        colorParams={colorParams}
        onSimParamsChange={setSimParams}
        onColorParamsChange={setColorParams}
        onReset={handleReset}
        onSave={handleSave}
        onRandomize={handleRandomize}
      />
    </div>
  )
}
