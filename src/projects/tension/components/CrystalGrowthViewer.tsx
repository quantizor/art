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
import { runPartition } from '../engine/partitionService'
import { setActiveProfile, setVariantOverride, VARIANT_PRESETS, type VariantPreset } from '../engine/ColorMapper'
import { ControlPanel } from './ControlPanel'
import { profile as agateProfile } from '../profiles'
import {
  randomSeedString,
  decodeSeed,
  forkDomain,
  DOMAIN,
  type PRNG,
} from '../engine/SeededRandom'
import {
  DEFAULT_SIM_PARAMS,
  MAX_DELTA,
  MAX_PARTICLES,
  SEED_MIN_DISTANCE,
  GRID_WIDTH,
  GRID_HEIGHT,
} from '../constants'
import type { CrystalProfile, SimulationParams, ColorParams, SimulationPhase } from '../types'

// Dev-only imperative handles so an external driver (preview_eval, a
// remote agent iterating on shading code) can run generations and poll
// for completion without a human in the loop. See the effect below.
declare global {
  interface Window {
    __tensionRandomize?: () => void
    __tensionSetSeed?: (s: string) => void
    __tensionSeed?: string
    __tensionLastRevealAt?: number | null
    __tensionPumpToComplete?: (
      maxFrames?: number,
      fps?: number
    ) => Promise<{ done: boolean; frames?: number; phase?: SimulationPhase }>
  }
}

const STORAGE_KEYS = {
  seedCount: 'tension:seedCount',
  variant: 'tension:variant',
} as const

/** Read a persisted integer setting within [min, max], falling back to default. */
function loadIntPref(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return fallback
    const n = Number(raw)
    if (!Number.isFinite(n)) return fallback
    const rounded = Math.round(n)
    return rounded < min ? min : rounded > max ? max : rounded
  } catch {
    return fallback
  }
}

function loadPref<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(key)
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}

function savePref(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // localStorage blocked or full — silently no-op, preference just won't persist
  }
}

/** Generate randomized color params from a crystal profile */
function randomParamsFromProfile(profile: CrystalProfile, rng: PRNG = Math.random): ColorParams {
  const [wlMin, wlMax] = profile.bandWavelengthRange
  const [ampMin, ampMax] = profile.bandAmplitudeRange
  const [lMin, lMax] = profile.baseLightnessRange
  const [sMin, sMax] = profile.saturationRange
  return {
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

  const [phase, setPhase] = useState<SimulationPhase>('idle')
  const [particleCount, setParticleCount] = useState(0)
  const [fps, setFps] = useState(0)

  // Seed-based deterministic PRNG — the seed string fully determines the design.
  // Dev honors `?seed=xyz` in the URL so a code change can be replayed against
  // the exact same generation for visual comparison.
  const [seedString, setSeedString] = useState(() => {
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('seed')
      if (q) return q
    }
    return randomSeedString()
  })
  const seedStringRef = useRef(seedString)
  seedStringRef.current = seedString

  const [simParams, setSimParams] = useState<SimulationParams>(() => {
    const masterSeed = decodeSeed(seedString)
    const simRng = forkDomain(masterSeed, DOMAIN.SIM_PARAMS)
    const derived = { ...DEFAULT_SIM_PARAMS, ...randomSimParamsFromProfile(agateProfile, simRng) }
    // User's seedCount choice overrides the seed-derived default so the
    // slider position survives page reloads.
    const [scMin, scMax] = agateProfile.seedCountRange
    return { ...derived, seedCount: loadIntPref(STORAGE_KEYS.seedCount, derived.seedCount, scMin, scMax) }
  })
  const [colorParams, setColorParams] = useState<ColorParams>(() => {
    const masterSeed = decodeSeed(seedString)
    const colorRng = forkDomain(masterSeed, DOMAIN.COLOR_PARAMS)
    return randomParamsFromProfile(agateProfile, colorRng)
  })
  const [variant, setVariant] = useState<VariantPreset>(
    () => loadPref<VariantPreset>(STORAGE_KEYS.variant, 'random', VARIANT_PRESETS)
  )
  useEffect(() => { savePref(STORAGE_KEYS.variant, variant) }, [variant])
  useEffect(() => { savePref(STORAGE_KEYS.seedCount, String(simParams.seedCount)) }, [simParams.seedCount])

  // Stable refs for animation loop
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const simParamsRef = useRef(simParams)
  simParamsRef.current = simParams
  const colorParamsRef = useRef(colorParams)
  colorParamsRef.current = colorParams
  // Read by the scene-setup effect, which runs once at mount. A later variant
  // change is applied by the structural-reset effect below, which does depend
  // on variant, so the setup effect must not re-run for it.
  const variantRef = useRef(variant)
  variantRef.current = variant


  /**
   * Deterministically build the cavity partition for the current seed
   * string, compute the wall-distance field, and hand it to the renderer
   * so the inward reveal can animate. This is the "boundaries first"
   * step — synchronous, no animation.
   */
  const initSeeds = useCallback(async (sim: FloodFillSimulation): Promise<void> => {
    const masterSeed = decodeSeed(seedStringRef.current)
    sim.setSeed(masterSeed)
    const placementRng = forkDomain(masterSeed, DOMAIN.SEED_PLACEMENT)
    const positions = generateSeedPositions(
      simParamsRef.current.seedCount, GRID_WIDTH, GRID_HEIGHT, SEED_MIN_DISTANCE,
      10, placementRng
    )
    sim.seedMany(positions)

    const renderer = rendererRef.current
    if (!renderer) return

    // Orb centres are known as soon as seeds are placed — long before
    // partition/wallDist finish. Plant them now.
    const seeds = sim.getSeeds()
    renderer.setOrbCenters(seeds.map((s) => ({ x: s.x, y: s.y })))

    // Partition + wallDist run off the main thread so the dissolve
    // animation stays smooth through the handoff.
    const { gridData, wallDist } = await runPartition(
      seeds.slice(),
      GRID_WIDTH,
      GRID_HEIGHT,
      agateProfile.growthNoiseScale * 0.045,
      0.065
    )
    sim.getGrid().data.set(gridData)
    const seedMap = new Map(seeds.map((s) => [s.id, s]))
    renderer.prepareReveal(sim.getGrid().data, wallDist, seedMap, colorParamsRef.current)
  }, [])

  // Mount: create scene, renderer, simulation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const controller = new AbortController()
    let cleanupScene: (() => void) | null = null

    SceneManager.create(canvas, controller.signal).then((scene) => {
      sceneRef.current = scene

      const crystalRenderer = new CrystalRenderer(scene.scene, MAX_PARTICLES)
      rendererRef.current = crystalRenderer

      const sim = new FloodFillSimulation()
      simRef.current = sim

      // Connect renderer to grid data for incremental boundary detection
      crystalRenderer.setGridData(sim.getGrid().data)

      // Set up the initial profile with seeded PRNGs
      const masterSeed = decodeSeed(seedStringRef.current)
      const strategyRng = forkDomain(masterSeed, DOMAIN.COLOR_STRATEGY)
      const bandRng = forkDomain(masterSeed, DOMAIN.BAND_COLORS)
      setActiveProfile(agateProfile, strategyRng, bandRng)
      setVariantOverride(variantRef.current)

      // Initialize: partition runs async in a worker; kick it off and
      // move into growing phase. The animate loop will show the loading
      // orb at seed centres (known synchronously) until the worker
      // returns and prepareReveal wires the cell set in.
      setPhase('growing')
      initSeeds(sim)

      // Resize handler
      const onResize = () => scene.resize()
      window.addEventListener('resize', onResize, { signal: controller.signal })

      // Pinch-to-zoom enabled, viewport gestures pass through to the browser.

      // Animation loop
      let frameCount = 0
      let fpsFrameCount = 0
      let fpsLastTime = 0
      let smoothedFrameTime = 0
      const animate = (time: number) => {
        if (phaseRef.current === 'complete') {
          rafRef.current = 0
          return
        }
        rafRef.current = requestAnimationFrame(animate)

        const dt = lastTimeRef.current ? Math.min(time - lastTimeRef.current, MAX_DELTA) : 16
        lastTimeRef.current = time
        frameCount++

        // FPS: exponential moving average, updates every 15 frames
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

        if (phaseRef.current === 'dissolving') {
          const startAt = dissolvePhaseStartRef.current || time
          if (!dissolvePhaseStartRef.current) dissolvePhaseStartRef.current = time
          const elapsed = time - startAt
          const DURATION = 1000
          const progress = Math.min(1, elapsed / DURATION)
          const pulse = 0.5 + 0.5 * Math.sin(time * 0.006)
          // Sparkle count scales with converted-region size.
          const sparkleCount = 150 + ((progress * 900) | 0)
          crystalRenderer.drawParticleDissolve(progress, sparkleCount, pulse)
          if (elapsed >= DURATION) {
            dissolvePhaseStartRef.current = 0
            // Preserve the old revealOrder before reset so the growing
            // phase can cross-fade sparkles from old to new cavity cells.
            crystalRenderer.capturePreviousRevealOrder()
            dissolveCompleteCbRef.current?.()
            dissolveCompleteCbRef.current = null
            // Composite the first crossfade frame immediately so there's
            // no pure-black frame between dissolve end and growing start.
            crystalRenderer.drawCrossfadeSparkles(7000, pulse, 0)
            // Synchronously switch the phase ref so the NEXT rAF enters
            // the growing branch. Without this, React's async phase
            // update lets rAFs re-enter the dissolving branch with
            // dissolvePhaseStartRef reset to 0, which restarts the
            // dissolve from progress=0 and re-reveals the old design:
            // the "stutter of blackness" the user reported was actually
            // the design flashing back in before the state settled.
            phaseRef.current = 'growing'
          }
          crystalRenderer.flush()
          scene.render()
          return
        }

        if (phaseRef.current === 'growing') {
          crystalRenderer.precomputeChunk(180_000)
          const startAt = growPhaseStartRef.current || time
          if (!growPhaseStartRef.current) growPhaseStartRef.current = time
          const elapsed = time - startAt
          const pulse = 0.5 + 0.5 * Math.sin(time * 0.006)
          // Cross-fade sparkles from the previous nodule's cell set to
          // the new one over the first 500ms. Paint area and shape shift
          // smoothly while the sparkle primitive stays identical.
          const CROSSFADE_MS = 500
          if (crystalRenderer.hasPreviousRevealOrder()) {
            const w = Math.min(1, elapsed / CROSSFADE_MS)
            crystalRenderer.drawCrossfadeSparkles(7000, pulse, w)
            if (w >= 1) crystalRenderer.clearPreviousRevealOrder()
          } else {
            crystalRenderer.drawGrowthOrb(7000, 1, pulse)
          }
          crystalRenderer.flush()
          // Advance to revealing once the minimum grow duration has
          // elapsed AND the colour precompute has caught up.
          if (elapsed >= 1200 && crystalRenderer.isPrecomputeDone()) {
            growPhaseStartRef.current = 0
            setPhase('revealing')
          }
          scene.render()
          return
        }

        if (phaseRef.current === 'revealing') {
          const CHUNK = 30_000
          crystalRenderer.advanceReveal(CHUNK)
          const remaining = crystalRenderer.revealRemaining()
          const sparkleCount = Math.min(5000, Math.floor(remaining * 0.004) + 400)
          const pulse = 0.5 + 0.5 * Math.sin(time * 0.006)
          crystalRenderer.drawSparkle(sparkleCount, pulse)
          crystalRenderer.flush()
          if (frameCount % 6 === 0) {
            setParticleCount(crystalRenderer.getCount())
          }
          if (crystalRenderer.revealRemaining() === 0) {
            // Restore any leftover sparkle cells to their underlying band
            // colour before the strain pass runs, so no shimmer ghosts
            // persist into the completed state.
            crystalRenderer.restoreSparklesFromBase()
            crystalRenderer.applyBoundaryStrain(sim.getGrid().data)
            crystalRenderer.flush()
            setPhase('complete')
            scene.render()
            window.dispatchEvent(new CustomEvent('tension:reveal-complete'))
            return
          }
          scene.render()
          return
        }

        // Silence unused `dt` in active paths.
        void dt
      }
      animateRef.current = animate

      rafRef.current = requestAnimationFrame(animate)

      cleanupScene = () => {
        cancelAnimationFrame(rafRef.current)
        animateRef.current = null
        crystalRenderer.dispose()
        scene.dispose()
      }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        console.error('Tension WebGPU initialization failed', error)
      }
    })

    return () => {
      controller.abort()
      cleanupScene?.()
      cancelAnimationFrame(rafRef.current)
    }
  }, [initSeeds])

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
      } else if (phaseRef.current === 'growing' || phaseRef.current === 'complete') {
        // Idle sparkle runs during 'complete' too — restart the rAF
        // loop on refocus so twinkles resume instead of freezing.
        restartLoop()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [restartLoop])

  // Keyboard: Space to pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setPhase((prev) => {
          if (prev === 'revealing') return 'paused'
          if (prev === 'paused') return 'revealing'
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

  const growPhaseStartRef = useRef(0)
  const dissolvePhaseStartRef = useRef(0)
  const dissolveCompleteCbRef = useRef<(() => void) | null>(null)

  // Reset only on structural param changes (seed count, axis count, color, variant)
  const prevStructuralRef = useRef({ seedCount: simParams.seedCount, axisCount: simParams.axisCount, colorParams, variant })
  useEffect(() => {
    const prev = prevStructuralRef.current
    const structuralChanged =
      prev.seedCount !== simParams.seedCount ||
      prev.axisCount !== simParams.axisCount ||
      prev.colorParams !== colorParams ||
      prev.variant !== variant

    prevStructuralRef.current = { seedCount: simParams.seedCount, axisCount: simParams.axisCount, colorParams, variant }

    if (!structuralChanged) return

    const sim = simRef.current
    const renderer = rendererRef.current
    if (!sim || !renderer) return

    // Dissolve (design fades → dreamy sparkles on black) → grow → reveal.
    // Dissolve runs on the current design texture; once complete, we
    // run the partition and hand off to the growing phase seamlessly —
    // canvas never fades to 0 since sparkles bridge the gap.
    renderer.captureForDissolve()
    // Set phase synchronously so the rAF early-exit (which reads
    // phaseRef before React flushes) doesn't kill the freshly
    // restarted loop on the next tick.
    phaseRef.current = 'dissolving'
    setPhase('dissolving')
    dissolveCompleteCbRef.current = () => {
      simParamsRef.current = simParams
      setVariantOverride(variant)
      sim.setParams(simParams)
      sim.reset()
      renderer.reset()
      initSeeds(sim)
      setParticleCount(0)
      setPhase('growing')
      restartLoop()
    }
    restartLoop()
    return () => {
      dissolveCompleteCbRef.current = null
    }
  }, [simParams, colorParams, variant, initSeeds, restartLoop])

  const handleReset = useCallback(() => {
    const sim = simRef.current
    const renderer = rendererRef.current
    if (!sim || !renderer) return
    sim.reset()
    renderer.reset()
    initSeeds(sim)
    setParticleCount(0)
    phaseRef.current = 'revealing'
    setPhase('revealing')
    restartLoop()
  }, [initSeeds, restartLoop])

  const regenerateWithSeed = useCallback((newSeed: string) => {
    setSeedString(newSeed)
    const masterSeed = decodeSeed(newSeed)

    const simRng = forkDomain(masterSeed, DOMAIN.SIM_PARAMS)
    const colorRng = forkDomain(masterSeed, DOMAIN.COLOR_PARAMS)
    const strategyRng = forkDomain(masterSeed, DOMAIN.COLOR_STRATEGY)
    const bandRng = forkDomain(masterSeed, DOMAIN.BAND_COLORS)

    setActiveProfile(agateProfile, strategyRng, bandRng)
    setSimParams(prev => ({
      ...prev,
      ...randomSimParamsFromProfile(agateProfile, simRng),
      // Preserve the user's chosen seedCount across randomize —
      // persistence rule: user-modifiable settings stick through any
      // reload or seed change.
      seedCount: prev.seedCount,
      facets: 0,
    }))
    setColorParams(randomParamsFromProfile(agateProfile, colorRng))
  }, [])

  const handleRandomize = useCallback(() => {
    regenerateWithSeed(randomSeedString())
  }, [regenerateWithSeed])

  // Dev-only imperative handles so an external driver (preview_eval, a
  // remote agent iterating on shading code) can run generations and
  // poll for completion without a human in the loop.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window
    w.__tensionRandomize = () => handleRandomize()
    w.__tensionSetSeed = (s: string) => regenerateWithSeed(s)
    w.__tensionSeed = seedStringRef.current
    w.__tensionLastRevealAt = null
    // Manual frame pump — used when the tab is backgrounded (hidden
    // iframe, automation) and RAF is throttled. Cancels any RAF the
    // animate fn re-schedules so we're the sole driver.
    w.__tensionPumpToComplete = async (maxFrames = 8000, fps = 60) => {
      const fn = animateRef.current
      if (!fn) return { done: false, phase: 'idle' as SimulationPhase }
      const step = 1000 / fps
      let t = performance.now()
      for (let i = 0; i < maxFrames; i++) {
        if (phaseRef.current === 'complete') return { done: true, frames: i }
        t += step
        fn(t)
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        // Yield every 32 frames so async work (runPartition worker
        // response) can resolve between batches.
        if ((i & 31) === 0) await new Promise((r) => setTimeout(r, 0))
      }
      return { done: false, phase: phaseRef.current }
    }
    const onComplete = () => {
      w.__tensionSeed = seedStringRef.current
      w.__tensionLastRevealAt = Date.now()
      // eslint-disable-next-line no-console
      console.log(`[tension] reveal complete · seed=${seedStringRef.current}`)
    }
    window.addEventListener('tension:reveal-complete', onComplete)
    return () => {
      window.removeEventListener('tension:reveal-complete', onComplete)
      delete w.__tensionRandomize
      delete w.__tensionSetSeed
      delete w.__tensionSeed
      delete w.__tensionLastRevealAt
      delete w.__tensionPumpToComplete
    }
  }, [handleRandomize, regenerateWithSeed])

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    const scene = sceneRef.current
    if (!canvas || !scene) return
    // WebGPU canvases don't support `preserveDrawingBuffer`, so render an
    // explicit frame right before capture and read back via `toBlob`
    // rather than a synchronous `toDataURL` that might race a stale frame.
    scene.render()
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `tension-${seedStringRef.current}-${Date.now()}.png`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }, [])

  return (
    <ProjectShell
      title="TENSION"
      subtitle="FEB 2026"
      fps={fps}
      controls={
        <ControlPanel
          phase={phase}
          particleCount={particleCount}
          simParams={simParams}
          onSimParamsChange={setSimParams}
          variant={variant}
          onVariantChange={setVariant}
          onReset={handleReset}
          onSave={handleSave}
          onRandomize={handleRandomize}
        />
      }
    >
      <div className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          title={phase === 'complete' ? 'Click the dice to generate a new design.' : undefined}
        />
      </div>
    </ProjectShell>
  )
}
