/**
 * Crystal Renderer
 *
 * Renders DLA crystal growth as a DataTexture on a full-grid quad.
 * Each grid cell maps to one pixel — produces continuous, gap-free
 * color fields that look like polarized light microphotography.
 *
 * Includes a boundary-strain post-processing pass that diffuses
 * pressure inward from grain boundaries, simulating photoelastic
 * stress birefringence visible in real thin sections.
 */

import * as THREE from 'three'
import { computeColor } from '../engine/ColorMapper'
import { GRID_WIDTH, GRID_HEIGHT, GRID_SCALE } from '../constants'
import type { ColorParams } from '../types'

/** Pressure diffusion decay per cell — lower = tighter boundary effect */
const PRESSURE_DECAY = 0.65
/** Minimum pressure threshold — below this, skip processing */
const MIN_PRESSURE = 0.03
/** Scale diffusion iterations with DPI to keep consistent visual depth */
const DIFFUSION_ITERATIONS = Math.round(6 * GRID_SCALE)

export class CrystalRenderer {
  private textureData: Uint8Array
  private baseTextureData: Uint8Array
  private texture: THREE.DataTexture
  private mesh: THREE.Mesh
  private dirty = false
  private particleCount = 0

  /** Pre-allocated buffer for pressure diffusion (avoids GC) */
  private strainPressure: Float32Array

  constructor(scene: THREE.Scene, _maxParticles: number) {
    const size = GRID_WIDTH * GRID_HEIGHT

    // RGBA buffer: one pixel per grid cell
    this.textureData = new Uint8Array(size * 4)
    // Base texture stores unstrained colors for post-process rebuilds
    this.baseTextureData = new Uint8Array(size * 4)
    // Pre-allocate pressure field
    this.strainPressure = new Float32Array(size)

    this.texture = new THREE.DataTexture(
      this.textureData,
      GRID_WIDTH,
      GRID_HEIGHT,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    )
    // LinearFilter provides free bilinear interpolation when zoomed in
    this.texture.magFilter = THREE.LinearFilter
    this.texture.minFilter = THREE.LinearFilter
    this.texture.wrapS = THREE.ClampToEdgeWrapping
    this.texture.wrapT = THREE.ClampToEdgeWrapping
    this.texture.needsUpdate = true

    // Full-grid quad on the XZ plane
    const geometry = new THREE.PlaneGeometry(GRID_WIDTH, GRID_HEIGHT)
    geometry.rotateX(-Math.PI / 2)

    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      side: THREE.DoubleSide,
    })

    this.mesh = new THREE.Mesh(geometry, material)
    // Center quad at grid center
    this.mesh.position.set(GRID_WIDTH / 2, 0, GRID_HEIGHT / 2)
    scene.add(this.mesh)
  }

  /** Write a crystal pixel into the texture buffer */
  addParticle(
    cx: number,
    cy: number,
    growthAngle: number,
    distFromSeed: number,
    _seedId: number,
    colorParams: ColorParams,
    seedOrientation?: number,
    seedTilt?: number,
    boundaryPressure?: number
  ): void {
    const rgb = computeColor(growthAngle, distFromSeed, colorParams, seedOrientation, seedTilt, boundaryPressure)

    // DataTexture row 0 = bottom in OpenGL, grid row 0 = top → flip Y
    const texY = GRID_HEIGHT - 1 - cy
    const offset = (texY * GRID_WIDTH + cx) * 4

    const r = (rgb.r * 255) | 0
    const g = (rgb.g * 255) | 0
    const b = (rgb.b * 255) | 0

    // Write to both display and base textures
    this.textureData[offset] = r
    this.textureData[offset + 1] = g
    this.textureData[offset + 2] = b
    this.textureData[offset + 3] = 255

    this.baseTextureData[offset] = r
    this.baseTextureData[offset + 1] = g
    this.baseTextureData[offset + 2] = b
    this.baseTextureData[offset + 3] = 255

    this.particleCount++
    this.dirty = true
  }

  /** Flush texture updates to GPU — call once per frame */
  flush(): void {
    if (!this.dirty) return
    this.texture.needsUpdate = true
    this.dirty = false
  }

  /**
   * Post-process the texture to diffuse boundary strain inward.
   *
   * Simulates photoelastic stress: larger grains exert more pressure on
   * smaller neighbors, creating chromatic strain fringes and milky haze
   * that fade from the grain boundary toward the center.
   *
   * Three phases:
   * 1. Boundary detection — find cells adjacent to a foreign grain
   * 2. Pressure diffusion — iterative relaxation spreads pressure inward
   * 3. Strain application — blend iridescent strain + haze into the texture
   */
  applyBoundaryStrain(gridData: Uint16Array): void {
    const W = GRID_WIDTH
    const H = GRID_HEIGHT
    const size = W * H

    // Restore display texture from unstrained base
    this.textureData.set(this.baseTextureData)

    // Reuse pre-allocated pressure buffer
    const pressure = this.strainPressure
    pressure.fill(0)

    // ── Phase 1: Boundary detection with size-weighted pressure ──

    // Compute per-seed cell counts for size-ratio weighting
    const seedSizes = new Map<number, number>()
    for (let i = 0; i < size; i++) {
      const id = gridData[i]
      if (id > 0) seedSizes.set(id, (seedSizes.get(id) || 0) + 1)
    }

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x
        const ownId = gridData[idx]
        if (ownId === 0) continue

        // Check 4-connected neighbors for foreign grains
        let maxForeignSize = 0
        const n1 = gridData[idx - 1]
        const n2 = gridData[idx + 1]
        const n3 = gridData[idx - W]
        const n4 = gridData[idx + W]

        if (n1 > 0 && n1 !== ownId) maxForeignSize = Math.max(maxForeignSize, seedSizes.get(n1) || 0)
        if (n2 > 0 && n2 !== ownId) maxForeignSize = Math.max(maxForeignSize, seedSizes.get(n2) || 0)
        if (n3 > 0 && n3 !== ownId) maxForeignSize = Math.max(maxForeignSize, seedSizes.get(n3) || 0)
        if (n4 > 0 && n4 !== ownId) maxForeignSize = Math.max(maxForeignSize, seedSizes.get(n4) || 0)

        if (maxForeignSize === 0) continue

        // Scale pressure by size ratio: small grains squeezed by large neighbors
        // get more pressure; large grains barely notice small neighbors
        const ownSize = seedSizes.get(ownId) || 1
        const sizeRatio = maxForeignSize / ownSize
        pressure[idx] = sizeRatio > 1
          ? Math.min(sizeRatio * 0.5, 1.5)
          : sizeRatio * 0.3
      }
    }

    // ── Phase 2: Iterative relaxation diffuses pressure inward ──
    // In-place updates propagate pressure directionally — forward pass
    // propagates down/right faster, but for visual effects this asymmetry
    // is imperceptible.

    for (let iter = 0; iter < DIFFUSION_ITERATIONS; iter++) {
      let changed = false
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const idx = y * W + x
          const id = gridData[idx]
          if (id === 0) continue

          // Find max pressure among same-grain neighbors
          let maxNeighbor = 0
          if (gridData[idx - 1] === id && pressure[idx - 1] > maxNeighbor) maxNeighbor = pressure[idx - 1]
          if (gridData[idx + 1] === id && pressure[idx + 1] > maxNeighbor) maxNeighbor = pressure[idx + 1]
          if (gridData[idx - W] === id && pressure[idx - W] > maxNeighbor) maxNeighbor = pressure[idx - W]
          if (gridData[idx + W] === id && pressure[idx + W] > maxNeighbor) maxNeighbor = pressure[idx + W]

          const candidate = maxNeighbor * PRESSURE_DECAY
          if (candidate > pressure[idx]) {
            pressure[idx] = candidate
            changed = true
          }
        }
      }
      if (!changed) break // converged early
    }

    // ── Phase 3: Apply strain effects to pressured cells ──

    const TAU = Math.PI * 2
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = pressure[y * W + x]
        if (p < MIN_PRESSURE) continue

        // DataTexture row 0 = bottom in OpenGL, grid row 0 = top → flip Y
        const texY = H - 1 - y
        const offset = (texY * W + x) * 4

        const r = this.textureData[offset] / 255
        const g = this.textureData[offset + 1] / 255
        const b = this.textureData[offset + 2] / 255

        // Chromatic strain from thin-film interference at this position
        // Divide by GRID_SCALE so the pattern has the same visual period at any DPI
        const strainPhase = ((x * (0.04 / GRID_SCALE) + y * (0.03 / GRID_SCALE)) % 1 + 1) % 1
        const sr = 0.5 + 0.5 * Math.cos(strainPhase * TAU)
        const sg = 0.5 + 0.5 * Math.cos(strainPhase * TAU - TAU / 3)
        const sb = 0.5 + 0.5 * Math.cos(strainPhase * TAU - 2 * TAU / 3)

        // Blend: chromatic strain + milky haze, proportional to pressure
        const strainMix = p * 0.15
        const hazeMix = p * 0.08
        const milky = 0.82
        const baseFactor = 1 - strainMix - hazeMix

        this.textureData[offset] = Math.min(255, Math.max(0, (r * baseFactor + sr * strainMix + milky * hazeMix) * 255)) | 0
        this.textureData[offset + 1] = Math.min(255, Math.max(0, (g * baseFactor + sg * strainMix + milky * hazeMix) * 255)) | 0
        this.textureData[offset + 2] = Math.min(255, Math.max(0, (b * baseFactor + sb * strainMix + milky * hazeMix) * 255)) | 0
      }
    }

    this.dirty = true
  }

  /** Reset the texture to fully transparent (black) */
  reset(): void {
    this.textureData.fill(0)
    this.baseTextureData.fill(0)
    this.texture.needsUpdate = true
    this.particleCount = 0
  }

  getCount(): number {
    return this.particleCount
  }

  dispose(): void {
    this.texture.dispose()
    this.mesh.geometry.dispose()
    if (!Array.isArray(this.mesh.material)) {
      this.mesh.material.dispose()
    }
  }
}
