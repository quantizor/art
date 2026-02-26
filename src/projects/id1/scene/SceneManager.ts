/**
 * Scene Manager — id1
 *
 * Perspective camera scene with HDRI environment, shadow maps,
 * and orbit controls for a photorealistic still-life setup.
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'

const FOV = 40
const NEAR = 0.1
const FAR = 50
const STORAGE_KEY = 'id1:camera'

interface CameraState {
  px: number; py: number; pz: number
  tx: number; ty: number; tz: number
}

export class SceneManager {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls

  private canvas: HTMLCanvasElement
  private saveTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // Scene — no visible background (dark room)
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x050505)

    // Perspective camera — telephoto feel
    this.camera = new THREE.PerspectiveCamera(
      FOV,
      width / height,
      NEAR,
      FAR,
    )
    this.camera.position.set(1.09, 0.49, 0.31)

    // Renderer — cinematic tone mapping, soft shadows
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Orbit controls — constrained for still-life viewing
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.target.set(0, 0.25, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.minDistance = 0.3
    this.controls.maxDistance = 10
    this.controls.minPolarAngle = Math.PI * 0.15
    this.controls.maxPolarAngle = Math.PI * 0.55
    this.controls.enablePan = false

    // Restore saved camera position, then initialize controls
    this.restoreCamera()
    this.controls.update()

    // Save camera on orbit changes (debounced)
    this.controls.addEventListener('change', () => this.debouncedSave())
  }

  /** Get current camera state for HUD display */
  getCameraInfo(): { x: string; y: string; z: string; azimuth: string; polar: string; dist: string } {
    const p = this.camera.position
    const spherical = new THREE.Spherical().setFromVector3(
      p.clone().sub(this.controls.target),
    )
    return {
      x: p.x.toFixed(2),
      y: p.y.toFixed(2),
      z: p.z.toFixed(2),
      azimuth: ((spherical.theta * 180) / Math.PI).toFixed(1),
      polar: ((spherical.phi * 180) / Math.PI).toFixed(1),
      dist: spherical.radius.toFixed(2),
    }
  }

  private restoreCamera(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const s: CameraState = JSON.parse(raw)
      this.camera.position.set(s.px, s.py, s.pz)
      this.controls.target.set(s.tx, s.ty, s.tz)
    } catch {
      // Invalid data — use defaults
    }
  }

  private debouncedSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(() => this.saveCamera(), 300)
  }

  private saveCamera(): void {
    const p = this.camera.position
    const t = this.controls.target
    const state: CameraState = {
      px: p.x, py: p.y, pz: p.z,
      tx: t.x, ty: t.y, tz: t.z,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  /** Load HDRI for environment reflections only (not background) */
  loadEnvironment(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      new RGBELoader().load(
        path,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping
          this.scene.environment = texture
          // Don't set scene.background — keep the dark room
          resolve()
        },
        undefined,
        reject,
      )
    })
  }

  resize(): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  render(): void {
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.saveCamera() // persist final position
    this.controls.dispose()
    this.renderer.dispose()

    if (this.scene.environment) {
      this.scene.environment.dispose()
    }

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material]
        for (const mat of materials) {
          // Dispose all texture maps on the material
          for (const value of Object.values(mat)) {
            if (value instanceof THREE.Texture) {
              value.dispose()
            }
          }
          mat.dispose()
        }
      }
    })

    this.scene.clear()
  }
}
