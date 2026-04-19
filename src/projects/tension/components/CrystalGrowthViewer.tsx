/**
 * Tension Viewer
 *
 * Main React component that orchestrates the DLA crystal growth
 * simulation and Three.js rendering.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { ProjectShell } from '~/components/ProjectShell'
import { SceneManager } from '../scene/SceneManager'
import { CrystalRenderer } from '../scene/CrystalRenderer'
import { FloodFillSimulation } from '../engine/FloodFillSimulation'
import { generateSeedPositions } from '../engine/SeedPlacer'
import { precomputeSeedTilt, setActiveProfile } from '../engine/ColorMapper'
import type { SeedTiltData } from '../engine/ColorMapper'
import { ControlPanel } from './ControlPanel'
import { getProfile, DEFAULT_CRYSTAL_TYPE } from '../profiles'
import {
  randomSeedString,
  decodeSeed,
  forkDomain,
  DOMAIN,
  type PRNG,
} from '../engine/SeededRandom'
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
import type { CrystalProfile, CrystalType, SimulationParams, ColorParams, SimulationPhase } from '../types'

/** Generate randomized color params from a crystal profile */
function randomParamsFromProfile(profile: CrystalProfile, rng: PRNG = Math.random): ColorParams {
  const [wlMin, wlMax] = profile.bandWavelengthRange
  const [ampMin, ampMax] = profile.bandAmplitudeRange
  const [lMin, lMax] = profile.baseLightnessRange
  const [sMin, sMax] = profile.saturationRange
  return {
    mode: 'agate',
    growthPattern: profile.growthPattern,
    bandWavelength: Math.round(wlMin + rng() * (wlMax - wlMin)),
    bandAmplitude: ampMin + rng() * (ampMax - ampMin),
    baseLightness: lMin + rng() * (lMax - lMin),
    saturation: sMin + rng() * (sMax - sMin),
    monoHue: Math.round(rng() * 360),
  }
}

/** Generate randomized sim params from a crystal profile */
function randomSimParamsFromProfile(profile: CrystalProfile, rng: PRNG = Math.random): Partial<SimulationParams> {
  const [scMin, scMax] = profile.seedCountRange
  const [axMin, axMax] = profile.axisCountRange
  const [arMin, arMax] = profile.aspectRatioRange
  return {
    seedCount: Math.floor(scMin + rng() * (scMax - scMin + 1)),
    axisCount: Math.round(axMin + rng() * (axMax - axMin)),
    aspectRatio: arMin + rng() * (arMax - arMin),
  }
}


export function CrystalGrowthViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<SceneManager | null>(null)
  const rendererRef = useRef<CrystalRenderer | null>(null)
  const simRef = useRef<FloodFillSimulation | null>(null)
  const rafRef = useRef<number>(0)
  const animateRef = useRef<((time: number) => void) | null>(null)
  const lastTimeRef = useRef<number>(0)

  const [crystalType, setCrystalType] = useState<CrystalType>(DEFAULT_CRYSTAL_TYPE)
  const [phase, setPhase] = useState<SimulationPhase>('idle')
  const [particleCount, setParticleCount] = useState(0)
  const [fps, setFps] = useState(0)
  const fpsFramesRef = useRef(0)
  const fpsTimeRef = useRef(0)

  // Seed-based deterministic PRNG — the seed string fully determines the design
  const [seedString, setSeedString] = useState(() => randomSeedString())
  const seedStringRef = useRef(seedString)
  seedStringRef.current = seedString

  const [simParams, setSimParams] = useState<SimulationParams>(() => {
    const profile = getProfile(DEFAULT_CRYSTAL_TYPE)
    const masterSeed = decodeSeed(seedString)
    const simRng = forkDomain(masterSeed, DOMAIN.SIM_PARAMS)
    return {
      ...DEFAULT_SIM_PARAMS,
      ...randomSimParamsFromProfile(profile, simRng),
    }
  })
  const [colorParams, setColorParams] = useState<ColorParams>(() => {
    const profile = getProfile(DEFAULT_CRYSTAL_TYPE)
    const masterSeed = decodeSeed(seedString)
    const colorRng = forkDomain(masterSeed, DOMAIN.COLOR_PARAMS)
    return randomParamsFromProfile(profile, colorRng)
  })

  // Stable refs for animation loop
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const simParamsRef = useRef(simParams)
  simParamsRef.current = simParams
  const colorParamsRef = useRef(colorParams)
  colorParamsRef.current = colorParams

  // Per-seed tilt data cache: seedId -> precomputed tilt values.
  // Avoids recomputing Math.cos/pow for every cell in the same seed.
  const seedTiltCacheRef = useRef<Map<number, SeedTiltData>>(new Map())

  const handleStick = useCallback(
    (
      _walkerIndex: number,
      cx: number,
      cy: number,
      seedId: number,
      dxFromSeed: number,
      dyFromSeed: number,
      _boundaryPressure: number
    ) => {
      const renderer = rendererRef.current
      const sim = simRef.current
      if (!renderer || !sim) return

      // Look up seed orientation and tilt for color computation
      const seed = sim.getSeed(seedId)
      const seedOrientation = seed ? seed.axes[0] : 0

      // Get or create precomputed tilt + warp-frame data for this seed
      let tiltData = seedTiltCacheRef.current.get(seedId)
      if (!tiltData) {
        tiltData = precomputeSeedTilt(
          seed ?? { tilt: 0, axes: [0], noiseOffsetX: 0, noiseOffsetY: 0 }
        )
        seedTiltCacheRef.current.set(seedId, tiltData)
      }

      // Use the zero-allocation direct-to-buffer path.
      // Pass raw (dx, dy) normalized to base resolution so color math
      // stays DPI-independent (avoids atan2/sqrt in the sim hot loop).
      const invScale = 1 / GRID_SCALE
      renderer.addParticleDirect(
        cx, cy, dxFromSeed * invScale, dyFromSeed * invScale, seedId,
        colorParamsRef.current, seedOrientation, tiltData
      )
    },
    []
  )

  /** Initialize simulation with Poisson-disk seeds */
  const initSeeds = useCallback((sim: FloodFillSimulation) => {
    const masterSeed = decodeSeed(seedStringRef.current)
    sim.setSeed(masterSeed)
    const placementRng = forkDomain(masterSeed, DOMAIN.SEED_PLACEMENT)
    const positions = generateSeedPositions(
      simParamsRef.current.seedCount, GRID_WIDTH, GRID_HEIGHT, SEED_MIN_DISTANCE,
      10, placementRng
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

    // Connect renderer to grid data for incremental boundary detection
    crystalRenderer.setGridData(sim.getGrid().data)

    // Set up the initial profile with seeded PRNGs
    const masterSeed = decodeSeed(seedStringRef.current)
    const strategyRng = forkDomain(masterSeed, DOMAIN.COLOR_STRATEGY)
    const bandRng = forkDomain(masterSeed, DOMAIN.BAND_COLORS)
    setActiveProfile(getProfile(DEFAULT_CRYSTAL_TYPE), strategyRng, bandRng)

    // Initialize with many random seeds
    initSeeds(sim)
    setPhase('growing')

    // Resize handler
    const onResize = () => scene.resize()
    window.addEventListener('resize', onResize)

    // Block pinch-to-zoom (trackpad sends ctrl+wheel, Safari sends gesturestart)
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault() }
    const onGesture = (e: Event) => e.preventDefault()
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('gesturestart', onGesture)
    canvas.addEventListener('gesturechange', onGesture)

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

        // Progressive strain: run boundary blending every ~45 frames
        // so boundary effects feather in gradually as crystals meet.
        // Now only processes incrementally-tracked boundary cells (not full grid).
        if (frameCount % 45 === 0) {
          crystalRenderer.applyBoundaryStrain(sim.getGrid().data)
        }

        crystalRenderer.flush()

        // Throttle React state updates to every 10 frames
        if (frameCount % 10 === 0) {
          const count = sim.getAggregateCount()
          setParticleCount(count)
          if (sim.isDone()) {
            // Final strain pass catches last few cells
            crystalRenderer.applyBoundaryStrain(sim.getGrid().data)
            crystalRenderer.flush()
            setPhase('complete')
            // Final render then stop the loop
            scene.render()
            return
          }
        }

        scene.render()
      }
    }
    animateRef.current = animate

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('gesturestart', onGesture)
      canvas.removeEventListener('gesturechange', onGesture)
      crystalRenderer.dispose()
      scene.dispose()
    }
  }, [handleStick, initSeeds])

  // Restart the rAF loop (e.g. after completion or tab refocus)
  const restartLoop = useCallback(() => {
    if (animateRef.current) {
      cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = 0
      rafRef.current = requestAnimationFrame(animateRef.current)
    }
  }, [])

  // Pause when tab is hidden, resume when visible
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current)
      } else if (phaseRef.current === 'growing') {
        restartLoop()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [restartLoop])

  // Click-to-seed (disabled once scene is fully grown)
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (phaseRef.current === 'complete') return

      const canvas = canvasRef.current
      const scene = sceneRef.current
      const sim = simRef.current
      if (!canvas || !scene || !sim) return

      const rect = canvas.getBoundingClientRect()
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1

      const worldPos = scene.ndcToWorld(ndcX, ndcY)
      sim.addSeed(worldPos.x, worldPos.y)

      if (phaseRef.current === 'idle') {
        setPhase('growing')
        restartLoop()
      }
    },
    [restartLoop]
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
    // Sync ref before initSeeds reads it
    simParamsRef.current = simParams
    sim.setParams(simParams)
    sim.reset()
    renderer.reset()
    seedTiltCacheRef.current.clear()
    initSeeds(sim)
    setParticleCount(0)
    setPhase('growing')
    restartLoop()
  }, [simParams, colorParams, initSeeds, restartLoop])

  const handleReset = useCallback(() => {
    const sim = simRef.current
    const renderer = rendererRef.current
    if (!sim || !renderer) return
    sim.reset()
    renderer.reset()
    seedTiltCacheRef.current.clear()
    initSeeds(sim)
    setParticleCount(0)
    setPhase('growing')
    restartLoop()
  }, [initSeeds, restartLoop])

  const handleRandomize = useCallback(() => {
    const profile = getProfile(crystalType)
    const newSeed = randomSeedString()
    setSeedString(newSeed)
    const masterSeed = decodeSeed(newSeed)

    // Fork domains for independent subsystems
    const simRng = forkDomain(masterSeed, DOMAIN.SIM_PARAMS)
    const colorRng = forkDomain(masterSeed, DOMAIN.COLOR_PARAMS)
    const strategyRng = forkDomain(masterSeed, DOMAIN.COLOR_STRATEGY)
    const bandRng = forkDomain(masterSeed, DOMAIN.BAND_COLORS)

    // Re-sample vibrancy/uniformity from profile ranges with seeded PRNG
    setActiveProfile(profile, strategyRng, bandRng)
    // Just update state — the structural change effect handles reset + re-seed
    setSimParams(prev => ({
      ...prev,
      ...randomSimParamsFromProfile(profile, simRng),
      facets: 0,
    }))
    setColorParams(randomParamsFromProfile(profile, colorRng))
  }, [crystalType])

  const handleCrystalTypeChange = useCallback((type: CrystalType) => {
    const profile = getProfile(type)
    const newSeed = randomSeedString()
    setSeedString(newSeed)
    const masterSeed = decodeSeed(newSeed)

    const simRng = forkDomain(masterSeed, DOMAIN.SIM_PARAMS)
    const colorRng = forkDomain(masterSeed, DOMAIN.COLOR_PARAMS)
    const strategyRng = forkDomain(masterSeed, DOMAIN.COLOR_STRATEGY)
    const bandRng = forkDomain(masterSeed, DOMAIN.BAND_COLORS)

    setCrystalType(type)
    setActiveProfile(profile, strategyRng, bandRng)
    simRef.current?.setProfile(profile)
    // Randomize params for the new type and trigger reset
    setSimParams(prev => ({
      ...prev,
      ...randomSimParamsFromProfile(profile, simRng),
      facets: 0,
    }))
    setColorParams(randomParamsFromProfile(profile, colorRng))
  }, [])

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `tension-${seedStringRef.current}-${Date.now()}.png`
    link.href = dataUrl
    link.click()
  }, [])

  return (
    <ProjectShell
      title="TENSION"
      subtitle="FEB 2026"
      fps={fps}
      controls={
        <ControlPanel
          crystalType={crystalType}
          onCrystalTypeChange={handleCrystalTypeChange}
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
      }
    >
      <canvas
        ref={canvasRef}
        className={`w-full h-full block ${phase === 'complete' ? 'cursor-default' : 'cursor-pointer'}`}
        title={phase === 'complete' ? 'Click the dice to generate a new design.' : undefined}
        onClick={handleCanvasClick}
      />
    </ProjectShell>
  )
}
