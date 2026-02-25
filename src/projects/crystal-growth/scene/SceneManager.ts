/**
 * Scene Manager
 *
 * Orchestrates Three.js orthographic scene for microscopy-style rendering.
 * Includes bloom and vignette post-processing.
 */

import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import {
  BACKGROUND_COLOR,
  VIGNETTE_CONFIG,
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_SCALE,
} from '../constants'

/** Vignette shader for microscopy edge darkening */
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: VIGNETTE_CONFIG.darkness },
    offset: { value: VIGNETTE_CONFIG.offset },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * 2.0;
      float dist = length(uv);
      float vig = smoothstep(offset, offset - 0.5, dist);
      texel.rgb *= mix(1.0 - darkness, 1.0, vig);
      gl_FragColor = texel;
    }
  `,
}

export class SceneManager {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  renderer: THREE.WebGLRenderer
  composer: EffectComposer

  private canvas: HTMLCanvasElement
  private width: number
  private height: number
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.width = canvas.clientWidth
    this.height = canvas.clientHeight

    // Scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(BACKGROUND_COLOR)

    // Orthographic camera sized to fit the grid exactly to the viewport
    const halfW = GRID_WIDTH / 2
    const halfH = GRID_HEIGHT / 2
    const aspect = this.width / this.height
    const gridAspect = GRID_WIDTH / GRID_HEIGHT

    let left: number, right: number, top: number, bottom: number
    if (aspect > gridAspect) {
      // Viewport wider than grid — lock width, crop height (cover)
      left = -halfW
      right = halfW
      top = halfW / aspect
      bottom = -halfW / aspect
    } else {
      // Viewport taller than grid — lock height, crop width (cover)
      top = halfH
      bottom = -halfH
      left = -halfH * aspect
      right = halfH * aspect
    }

    this.camera = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 1000)
    // Position camera above grid center looking down
    this.camera.position.set(GRID_WIDTH / 2, 100, GRID_HEIGHT / 2)
    this.camera.lookAt(GRID_WIDTH / 2, 0, GRID_HEIGHT / 2)

    // Renderer — antialias disabled since we render a single flat textured quad;
    // MSAA has no geometric edges to smooth and would only cost fill rate.
    // Tone mapping disabled to preserve the precisely-computed DataTexture colors.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
    this.renderer.setSize(this.width, this.height)
    // Match device pixel ratio — the DPI-scaled texture has enough detail
    this.renderer.setPixelRatio(GRID_SCALE)
    this.renderer.toneMapping = THREE.NoToneMapping

    // Post-processing
    this.composer = new EffectComposer(this.renderer)

    const renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(renderPass)

    const vignettePass = new ShaderPass(VignetteShader)
    this.composer.addPass(vignettePass)

    const outputPass = new OutputPass()
    this.composer.addPass(outputPass)
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

    this.renderer.setSize(this.width, this.height)
    this.composer.setSize(this.width, this.height)
  }

  /** Render frame with post-processing */
  render(): void {
    this.composer.render()
  }

  /** Cleanup all resources */
  dispose(): void {
    this.composer.dispose()
    this.renderer.dispose()

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

  // ─── Private ─────────────────────────────────────

  private updateCameraFrustum(): void {
    const aspect = this.width / this.height
    const halfW = GRID_WIDTH / 2
    const halfH = GRID_HEIGHT / 2
    const gridAspect = GRID_WIDTH / GRID_HEIGHT

    if (aspect > gridAspect) {
      // Cover: lock width, crop height
      this.camera.left = -halfW
      this.camera.right = halfW
      this.camera.top = halfW / aspect
      this.camera.bottom = -halfW / aspect
    } else {
      // Cover: lock height, crop width
      this.camera.top = halfH
      this.camera.bottom = -halfH
      this.camera.left = -halfH * aspect
      this.camera.right = halfH * aspect
    }
    this.camera.updateProjectionMatrix()
  }
}
