/**
 * id1 Viewer
 *
 * Glass torus on walnut table — photorealistic still-life scene.
 * Composes Three.js scene with PBR materials, HDRI environment,
 * and transmission glass.
 */

import * as THREE from 'three'
import { useEffect, useRef, useState } from 'react'
import { ProjectShell } from '~/components/ProjectShell'
import { SceneManager } from '../scene/SceneManager'
import { createLighting } from '../scene/Lighting'
import { createTable } from '../scene/TableMesh'
import { createGlassTorus } from '../scene/GlassTorus'

interface CameraDisplay {
  x: string; y: string; z: string
  azimuth: string; polar: string; dist: string
}

/** Elastic ease-out — damped sine overshoot settling to 1.0 */
function elasticOut(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1
}

interface EntryAnim {
  /** Seconds elapsed since this element's entry began */
  elapsed: number
  /** Total duration in seconds */
  duration: number
  /** Delay before this element starts animating */
  delay: number
  /** Apply scale — called each frame */
  apply: (progress: number) => void
}

export function Id1Viewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<SceneManager | null>(null)
  const rafRef = useRef<number>(0)
  const [fps, setFps] = useState(0)
  const [cam, setCam] = useState<CameraDisplay | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const manager = new SceneManager(canvas)
    sceneRef.current = manager

    // Build scene
    createLighting(manager.scene)

    const table = createTable()
    table.scale.set(0, 0, 0)
    manager.scene.add(table)

    const torus = createGlassTorus()
    torus.scale.set(0, 0, 0)
    manager.scene.add(torus)

    // Load HDRI environment for reflections
    manager.loadEnvironment('/textures/env/studio_small_09_1k.hdr')

    // Entry animations — staggered elastic pop-in
    const entries: EntryAnim[] = [
      {
        elapsed: 0, duration: 0.9, delay: 0.1,
        apply: (p) => { const s = elasticOut(p); table.scale.set(s, s, s) },
      },
      {
        elapsed: 0, duration: 0.8, delay: 0.4,
        apply: (p) => { const s = elasticOut(p); torus.scale.set(s, s, s) },
      },
    ]
    let animsDone = false

    // WASD keyboard panning
    const keysDown = new Set<string>()
    const PAN_SPEED = 1.5
    const panOffset = new THREE.Vector3()

    const onKeyDown = (e: KeyboardEvent) => {
      if (['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) {
        keysDown.add(e.key.toLowerCase())
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.key.toLowerCase())
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // Resize handler
    const onResize = () => manager.resize()
    window.addEventListener('resize', onResize)

    // Animation loop — pauses when tab is hidden
    let smoothedFrameTime = 0
    let lastTime = 0
    let frameCount = 0
    let running = true

    const animate = (time: number) => {
      if (!running) return
      rafRef.current = requestAnimationFrame(animate)

      const dt = lastTime ? (time - lastTime) / 1000 : 0.016
      lastTime = time
      frameCount++

      // FPS tracking
      const frameMs = dt * 1000
      smoothedFrameTime =
        smoothedFrameTime === 0
          ? frameMs
          : smoothedFrameTime * 0.85 + frameMs * 0.15
      if (frameCount % 15 === 0) {
        setFps(
          smoothedFrameTime > 0
            ? Math.round(1000 / smoothedFrameTime)
            : 0,
        )
        setCam(manager.getCameraInfo())
      }

      // Entry animations
      if (!animsDone) {
        let allDone = true
        for (const entry of entries) {
          entry.elapsed += dt
          const t = entry.elapsed - entry.delay
          if (t < 0) {
            allDone = false
          } else {
            const progress = Math.min(t / entry.duration, 1)
            entry.apply(progress)
            if (progress < 1) allDone = false
          }
        }
        animsDone = allDone
      }

      // WASD panning — move camera + target together on camera-relative XY
      if (keysDown.size > 0) {
        panOffset.set(0, 0, 0)
        const cam = manager.camera
        // Camera-right vector (X axis in camera space)
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
        // World up for vertical movement
        const up = new THREE.Vector3(0, 1, 0)

        if (keysDown.has('a')) panOffset.addScaledVector(right, -PAN_SPEED * dt)
        if (keysDown.has('d')) panOffset.addScaledVector(right, PAN_SPEED * dt)
        if (keysDown.has('w')) panOffset.addScaledVector(up, -PAN_SPEED * dt)
        if (keysDown.has('s')) panOffset.addScaledVector(up, PAN_SPEED * dt)

        cam.position.add(panOffset)
        manager.controls.target.add(panOffset)
      }

      // Slow auto-rotation on the torus
      torus.rotation.y += 0.3 * dt

      manager.render()
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(rafRef.current)
      } else {
        running = true
        lastTime = 0 // reset so first frame doesn't get a huge dt
        smoothedFrameTime = 0
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      manager.dispose()
      sceneRef.current = null
    }
  }, [])

  const cameraStatus = cam ? (
    <span className="text-[11px] font-mono text-white/30 tabular-nums">
      {cam.azimuth}&deg; &middot; {cam.polar}&deg; &middot; d{cam.dist} &middot; ({cam.x}, {cam.y}, {cam.z})
    </span>
  ) : null

  return (
    <ProjectShell title="ID1" subtitle="FEB 2026" fps={fps} statusRight={cameraStatus}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </ProjectShell>
  )
}
