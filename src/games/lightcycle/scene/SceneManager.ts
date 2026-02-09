/**
 * Scene Manager
 *
 * Orchestrates Three.js scene setup, rendering, and cleanup.
 */

import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { BLOOM_CONFIG, CAMERA_CONFIG } from '../constants'
import type { CameraMode } from '../types'

export class SceneManager {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  composer: EffectComposer
  bloomPass: UnrealBloomPass

  private canvas: HTMLCanvasElement
  private width: number
  private height: number

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.width = canvas.clientWidth
    this.height = canvas.clientHeight

    // Scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000000)
    this.scene.fog = new THREE.Fog(0x000000, 50, 150)

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.thirdPerson.fov,
      this.width / this.height,
      0.1,
      500
    )
    this.camera.position.set(0, 50, 50)
    this.camera.lookAt(0, 0, 0)

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    // Post-processing
    this.composer = new EffectComposer(this.renderer)

    const renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(renderPass)

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      BLOOM_CONFIG.strength,
      BLOOM_CONFIG.radius,
      BLOOM_CONFIG.threshold
    )
    this.composer.addPass(this.bloomPass)

    const outputPass = new OutputPass()
    this.composer.addPass(outputPass)

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

    // Create procedural environment map for reflections (TRON-style)
    this.createEnvironmentMap()
  }

  /**
   * Create a procedural TRON-style environment map for reflections
   */
  private createEnvironmentMap(): void {
    // Create a cube render target for the environment
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256)
    cubeRenderTarget.texture.type = THREE.HalfFloatType

    // Create a scene for the environment
    const envScene = new THREE.Scene()

    // Gradient from deep blue at bottom to dark at top
    const topColor = new THREE.Color(0x000000)
    const bottomColor = new THREE.Color(0x001133)
    const horizonColor = new THREE.Color(0x002255)

    // Create a hemisphere of gradient colors
    const gradientMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: topColor },
        horizonColor: { value: horizonColor },
        bottomColor: { value: bottomColor },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          vec3 color;
          if (h > 0.0) {
            color = mix(horizonColor, topColor, h);
          } else {
            color = mix(horizonColor, bottomColor, -h);
          }
          // Add some grid-like patterns for TRON effect
          vec3 absPos = abs(vWorldPosition);
          float grid = step(0.95, fract(absPos.x * 0.1)) + step(0.95, fract(absPos.z * 0.1));
          color += vec3(0.0, 0.1, 0.2) * grid * 0.3;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
    })

    const envSphere = new THREE.Mesh(
      new THREE.SphereGeometry(100, 32, 16),
      gradientMaterial
    )
    envScene.add(envSphere)

    // Render the environment to cube map
    const cubeCamera = new THREE.CubeCamera(0.1, 200, cubeRenderTarget)
    cubeCamera.update(this.renderer, envScene)

    // Apply environment map to scene
    this.scene.environment = cubeRenderTarget.texture

    // Dispose temporary objects
    gradientMaterial.dispose()
    envSphere.geometry.dispose()
  }

  /**
   * Handle window resize
   */
  resize(): void {
    this.width = this.canvas.clientWidth
    this.height = this.canvas.clientHeight

    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(this.width, this.height)
    this.composer.setSize(this.width, this.height)
  }

  /**
   * Update camera based on mode and cycle position
   */
  updateCamera(
    mode: CameraMode,
    position: { x: number; z: number },
    rotation: number
  ): void {
    const config = CAMERA_CONFIG[mode]

    if (mode === 'topDown') {
      this.camera.fov = config.fov
      this.camera.position.set(position.x, (config as typeof CAMERA_CONFIG.topDown).height, position.z)
      this.camera.lookAt(position.x, 0, position.z)
      this.camera.rotation.z = -rotation
    } else if (mode === 'firstPerson') {
      const fpConfig = config as typeof CAMERA_CONFIG.firstPerson
      this.camera.fov = fpConfig.fov
      // Position at cycle location, slightly elevated
      const offsetX = Math.sin(rotation) * fpConfig.offsetZ
      const offsetZ = Math.cos(rotation) * fpConfig.offsetZ
      this.camera.position.set(
        position.x - offsetX,
        fpConfig.offsetY,
        position.z - offsetZ
      )
      // Look forward in direction of travel
      const lookX = position.x + Math.sin(rotation) * 10
      const lookZ = position.z + Math.cos(rotation) * 10
      this.camera.lookAt(lookX, 1, lookZ)
    } else {
      // Third person
      const tpConfig = config as typeof CAMERA_CONFIG.thirdPerson
      this.camera.fov = tpConfig.fov
      const offsetX = Math.sin(rotation) * tpConfig.offsetZ
      const offsetZ = Math.cos(rotation) * tpConfig.offsetZ
      this.camera.position.set(
        position.x - offsetX,
        tpConfig.offsetY,
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
    this.composer.render()
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
    this.composer.dispose()
    this.renderer.dispose()

    // Traverse and dispose all scene objects
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose())
        } else {
          object.material.dispose()
        }
      }
    })

    this.scene.clear()
  }
}
