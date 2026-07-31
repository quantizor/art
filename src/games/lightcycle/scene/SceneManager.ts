/**
 * Scene Manager
 *
 * Orchestrates Three.js scene setup, rendering, and cleanup.
 */

import * as THREE from 'three/webgpu'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { pass } from 'three/tsl'
import { createGpuRenderer } from '~/utils/gpu'
import { disposeSceneGraph } from '~/utils/three/disposeSceneGraph'
import { setEnvironmentNode } from '~/utils/three/sceneNodes'
import { tronEnvironment } from './environment'
import { BLOOM_CONFIG, CAMERA_CONFIG } from '../constants'
import type { CameraMode } from '../types'

export class SceneManager {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGPURenderer
  renderPipeline: THREE.RenderPipeline

  private canvas: HTMLCanvasElement
  private width: number
  private height: number

  private constructor(canvas: HTMLCanvasElement, renderer: THREE.WebGPURenderer) {
    this.canvas = canvas
    this.width = canvas.clientWidth
    this.height = canvas.clientHeight
    this.renderer = renderer

    // Scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000000)
    this.scene.fog = new THREE.Fog(0x000000, 50, 150)
    setEnvironmentNode(this.scene, tronEnvironment)

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.thirdPerson.fov,
      this.width / this.height,
      0.1,
      500
    )
    this.camera.position.set(0, 50, 50)
    this.camera.lookAt(0, 0, 0)

    // Renderer. `updateStyle: false` keeps CSS in charge of the canvas box; a
    // renderer-written inline style would make `resize()` read back its own value.
    this.renderer.setSize(this.width, this.height, false)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    // Post-processing: scene pass + additive bloom
    const scenePass = pass(this.scene, this.camera)
    const scenePassColor = scenePass.getTextureNode('output')
    const bloomPass = bloom(scenePassColor, BLOOM_CONFIG.strength, BLOOM_CONFIG.radius, BLOOM_CONFIG.threshold)

    this.renderPipeline = new THREE.RenderPipeline(this.renderer)
    this.renderPipeline.outputNode = scenePassColor.add(bloomPass)

    // Ambient light - for base visibility
    const ambientLight = new THREE.AmbientLight(0x333355, 0.6)
    this.scene.add(ambientLight)

    // Key light for reflections
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(30, 50, 30)
    this.scene.add(keyLight)

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.5)
    fillLight.position.set(-30, 30, -30)
    this.scene.add(fillLight)
  }

  /** Create a WebGPU scene, aborting initialization when its mount is torn down. */
  static async create(
    canvas: HTMLCanvasElement,
    signal: AbortSignal,
  ): Promise<SceneManager> {
    const { renderer } = await createGpuRenderer(canvas, {
      antialias: true,
      powerPreference: 'high-performance',
      signal,
    })
    return new SceneManager(canvas, renderer)
  }

  /**
   * Handle window resize
   */
  resize(): void {
    this.width = this.canvas.clientWidth
    this.height = this.canvas.clientHeight

    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(this.width, this.height, false)
  }

  /**
   * Update camera based on mode and cycle position
   */
  updateCamera(
    mode: CameraMode,
    position: { x: number; z: number },
    rotation: number
  ): void {
    if (mode === 'topDown') {
      const config = CAMERA_CONFIG.topDown
      this.camera.fov = config.fov
      this.camera.position.set(position.x, config.height, position.z)
      this.camera.lookAt(position.x, 0, position.z)
      this.camera.rotation.z = -rotation
    } else if (mode === 'firstPerson') {
      const config = CAMERA_CONFIG.firstPerson
      this.camera.fov = config.fov
      // Position at cycle location, slightly elevated
      const offsetX = Math.sin(rotation) * config.offsetZ
      const offsetZ = Math.cos(rotation) * config.offsetZ
      this.camera.position.set(
        position.x - offsetX,
        config.offsetY,
        position.z - offsetZ
      )
      // Look forward in direction of travel
      const lookX = position.x + Math.sin(rotation) * 10
      const lookZ = position.z + Math.cos(rotation) * 10
      this.camera.lookAt(lookX, 1, lookZ)
    } else {
      // Third person
      const config = CAMERA_CONFIG.thirdPerson
      this.camera.fov = config.fov
      const offsetX = Math.sin(rotation) * config.offsetZ
      const offsetZ = Math.cos(rotation) * config.offsetZ
      this.camera.position.set(
        position.x - offsetX,
        config.offsetY,
        position.z - offsetZ
      )
      this.camera.lookAt(position.x, 1, position.z)
    }

    this.camera.updateProjectionMatrix()
  }

  /**
   * Render frame with post-processing
   */
  render(): void {
    this.renderPipeline.render()
  }

  /**
   * Render without post-processing (faster, for menus)
   */
  renderBasic(): void {
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Cleanup all resources
   */
  dispose(): void {
    this.renderPipeline.dispose()
    this.renderer.dispose()

    disposeSceneGraph(this.scene)
    this.scene.clear()
  }
}
