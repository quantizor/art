/**
 * Scene Manager
 *
 * Orchestrates a WebGPU orthographic scene for microscopy-style rendering.
 * Even lighting from camera direction with subtle bloom for polished surface glow.
 */

import * as THREE from 'three/webgpu'
import { createGpuRenderer } from '~/utils/gpu'
import { disposeSceneGraph } from '~/utils/three/disposeSceneGraph'
import {
  BACKGROUND_COLOR,
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_SCALE,
} from '../constants'

export class SceneManager {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  renderer: THREE.WebGPURenderer

  private canvas: HTMLCanvasElement
  private width: number
  private height: number

  private constructor(canvas: HTMLCanvasElement, renderer: THREE.WebGPURenderer) {
    this.canvas = canvas
    this.width = canvas.clientWidth
    this.height = canvas.clientHeight

    // Scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(BACKGROUND_COLOR)

    // Orthographic camera, grid matches canvas aspect so it's an exact fit (no clipping)
    const halfW = GRID_WIDTH / 2
    const halfH = GRID_HEIGHT / 2
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 1000)
    // Position camera above grid center looking down
    this.camera.position.set(GRID_WIDTH / 2, 100, GRID_HEIGHT / 2)
    this.camera.lookAt(GRID_WIDTH / 2, 0, GRID_HEIGHT / 2)

    // Render directly to canvas, no intermediate render targets, which
    // would halve resolution on HiDPI displays.
    // Tone mapping disabled to preserve the precisely-computed DataTexture colors.
    this.renderer = renderer
    // `updateStyle: false` keeps CSS in charge of the canvas box. A
    // renderer-written inline style would make `resize()` read back its own value.
    this.renderer.setSize(this.width, this.height, false)
    this.renderer.setPixelRatio(GRID_SCALE)
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
  }

  /** Create a WebGPU scene, aborting initialization when its mount is torn down. */
  static async create(
    canvas: HTMLCanvasElement,
    signal: AbortSignal,
  ): Promise<SceneManager> {
    const { renderer } = await createGpuRenderer(canvas, {
      antialias: false,
      powerPreference: 'high-performance',
      signal,
    })
    return new SceneManager(canvas, renderer)
  }

  /** Convert NDC coordinates to world position */
  ndcToWorld(ndcX: number, ndcY: number): { x: number; y: number } {
    const halfW = (this.camera.right - this.camera.left) / 2
    const halfH = (this.camera.top - this.camera.bottom) / 2
    return {
      x: GRID_WIDTH / 2 + ndcX * halfW,
      y: GRID_HEIGHT / 2 - ndcY * halfH,
    }
  }

  /** Handle window resize */
  resize(): void {
    this.width = this.canvas.clientWidth
    this.height = this.canvas.clientHeight

    this.updateCameraFrustum()

    this.renderer.setSize(this.width, this.height, false)
  }

  /** Render frame directly to canvas */
  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  /** Cleanup all resources */
  dispose(): void {
    this.renderer.dispose()

    disposeSceneGraph(this.scene)
    this.scene.clear()
  }

  // ─── Private ─────────────────────────────────────

  private updateCameraFrustum(): void {
    const halfW = GRID_WIDTH / 2
    const halfH = GRID_HEIGHT / 2
    this.camera.left = -halfW
    this.camera.right = halfW
    this.camera.top = halfH
    this.camera.bottom = -halfH
    this.camera.updateProjectionMatrix()
  }
}
