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
 *
 * Performance: uses computeColorDirect() to write RGBA bytes directly
 * to the texture buffer (zero intermediate allocations). Boundary
 * strain uses an incrementally-maintained set of candidate cells
 * instead of scanning the full grid.
 */

import * as THREE from 'three'
import { computeColor, computeColorDirect, invalidateBandCache } from '../engine/ColorMapper'
import type { SeedTiltData } from '../engine/ColorMapper'
import { GRID_WIDTH, GRID_HEIGHT } from '../constants'
import type { ColorParams } from '../types'

/** Screen blend strength at boundary cells */
const BOUNDARY_BLEND = 0.45

export class CrystalRenderer {
  private textureData: Uint8Array
  private baseTextureData: Uint8Array
  private texture: THREE.DataTexture
  private mesh: THREE.Mesh
  private dirty = false
  private particleCount = 0

  /**
   * Incrementally-maintained set of cell indices that *might* be on a
   * grain boundary. A cell is added here when it is claimed and at
   * least one of its 8-connected neighbors is already claimed by a
   * different seed. This set is typically 1-5% of total cells, so
   * the strain pass processes orders of magnitude fewer cells than
   * the full grid.
   */
  private boundaryCandidates: Set<number> = new Set()

  /**
   * Set of cell indices that were actually modified by the last strain
   * pass. Used to restore only affected pixels instead of copying the
   * entire 16MB buffer. Typically much smaller than boundaryCandidates
   * since many candidates may have foreignWeight === 0.
   */
  private lastStrainedCells: Uint32Array = new Uint32Array(0)
  private lastStrainedCount = 0

  /** Grid data reference for boundary detection during addParticleDirect */
  private gridData: Uint16Array | null = null

  constructor(scene: THREE.Scene, _maxParticles: number) {
    const size = GRID_WIDTH * GRID_HEIGHT

    // RGBA buffer: one pixel per grid cell
    this.textureData = new Uint8Array(size * 4)
    // Base texture stores unstrained colors for post-process rebuilds
    this.baseTextureData = new Uint8Array(size * 4)

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
    // Mark as sRGB so Three.js doesn't double-gamma our pre-computed colors
    this.texture.colorSpace = THREE.SRGBColorSpace
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

  /** Set grid data reference for incremental boundary detection */
  setGridData(gridData: Uint16Array): void {
    this.gridData = gridData
  }

  /**
   * Write a crystal pixel directly to the texture buffer using the
   * zero-allocation computeColorDirect path.
   *
   * Accepts raw (dx, dy) offsets from the seed center instead of
   * (angle, distFromSeed) to avoid the atan2/sqrt roundtrip.
   *
   * Also incrementally detects boundary candidates: when a newly
   * claimed cell has neighbors belonging to a different seed, both
   * the new cell and its foreign neighbors are added to the boundary
   * candidate set.
   */
  addParticleDirect(
    cx: number,
    cy: number,
    dx: number,
    dy: number,
    seedId: number,
    colorParams: ColorParams,
    seedOrientation: number,
    tiltData: SeedTiltData
  ): void {
    // DataTexture row 0 = bottom in OpenGL, grid row 0 = top -> flip Y
    const texY = GRID_HEIGHT - 1 - cy
    const offset = (texY * GRID_WIDTH + cx) * 4

    // Write color directly to both display and base texture buffers.
    // computeColorDirect writes to both buf and baseBuf in one pass,
    // eliminating the separate 4-byte copy per pixel.
    computeColorDirect(
      dx, dy, colorParams,
      seedOrientation, tiltData,
      this.textureData, this.baseTextureData, offset
    )

    // ── Incremental boundary detection ──
    // Check 8-connected neighbors for foreign seeds. If found, mark
    // both this cell and the foreign neighbor as boundary candidates.
    const grid = this.gridData
    if (grid) {
      const W = GRID_WIDTH
      const idx = cy * W + cx
      const minX = cx > 0 ? 1 : 0
      const maxX = cx < W - 1 ? 1 : 0
      const minY = cy > 0 ? 1 : 0
      const maxY = cy < GRID_HEIGHT - 1 ? 1 : 0

      // Check cardinal + diagonal neighbors
      if (minX && grid[idx - 1] > 0 && grid[idx - 1] !== seedId) {
        this.boundaryCandidates.add(idx)
        this.boundaryCandidates.add(idx - 1)
      }
      if (maxX && grid[idx + 1] > 0 && grid[idx + 1] !== seedId) {
        this.boundaryCandidates.add(idx)
        this.boundaryCandidates.add(idx + 1)
      }
      if (minY && grid[idx - W] > 0 && grid[idx - W] !== seedId) {
        this.boundaryCandidates.add(idx)
        this.boundaryCandidates.add(idx - W)
      }
      if (maxY && grid[idx + W] > 0 && grid[idx + W] !== seedId) {
        this.boundaryCandidates.add(idx)
        this.boundaryCandidates.add(idx + W)
      }
      if (minX && minY && grid[idx - W - 1] > 0 && grid[idx - W - 1] !== seedId) {
        this.boundaryCandidates.add(idx)
        this.boundaryCandidates.add(idx - W - 1)
      }
      if (maxX && minY && grid[idx - W + 1] > 0 && grid[idx - W + 1] !== seedId) {
        this.boundaryCandidates.add(idx)
        this.boundaryCandidates.add(idx - W + 1)
      }
      if (minX && maxY && grid[idx + W - 1] > 0 && grid[idx + W - 1] !== seedId) {
        this.boundaryCandidates.add(idx)
        this.boundaryCandidates.add(idx + W - 1)
      }
      if (maxX && maxY && grid[idx + W + 1] > 0 && grid[idx + W + 1] !== seedId) {
        this.boundaryCandidates.add(idx)
        this.boundaryCandidates.add(idx + W + 1)
      }
    }

    this.particleCount++
    this.dirty = true
  }

  /** Write a crystal pixel into the texture buffer (legacy path) */
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

    // DataTexture row 0 = bottom in OpenGL, grid row 0 = top -> flip Y
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
   * Incremental boundary strain pass.
   *
   * Only processes cells in the boundaryCandidates set (typically 1-5%
   * of total cells) instead of scanning the entire 4.2M grid.
   *
   * Restoration is also incremental: instead of copying the entire 16MB
   * baseTextureData buffer, we only restore the pixels that were modified
   * by the previous strain pass (tracked in lastStrainedCells). This
   * reduces the restore cost from ~16MB memcpy to ~100-200KB of scattered
   * writes, which is dramatically faster.
   */
  applyBoundaryStrain(gridData: Uint16Array): void {
    const W = GRID_WIDTH
    const H = GRID_HEIGHT

    // Restore ONLY the pixels that were modified by the previous strain pass.
    // This replaces the O(16MB) full-buffer copy with O(strainedCount * 4) writes.
    const tex = this.textureData
    const base = this.baseTextureData
    const prevCount = this.lastStrainedCount
    const prevCells = this.lastStrainedCells
    for (let i = 0; i < prevCount; i++) {
      const off = prevCells[i]
      tex[off] = base[off]
      tex[off + 1] = base[off + 1]
      tex[off + 2] = base[off + 2]
      // alpha is always 255, no need to restore
    }

    const candidates = this.boundaryCandidates

    // Ensure the strained-cells buffer is large enough
    if (this.lastStrainedCells.length < candidates.size) {
      this.lastStrainedCells = new Uint32Array(candidates.size)
    }
    let strainedCount = 0

    for (const idx of candidates) {
      const y = (idx / W) | 0
      const x = idx - y * W

      // Skip edge cells (same as original)
      if (x <= 0 || x >= W - 1 || y <= 0 || y >= H - 1) continue

      const ownId = gridData[idx]
      if (ownId === 0) continue

      // Count foreign neighbors (8-connected) and accumulate their color.
      // Cardinal neighbors count as 1.0, diagonals as 0.5 — this gives
      // natural sub-pixel weighting for smooth antialiased edges.
      // Inlined neighbor offsets to avoid array allocation per cell.
      let foreignWeight = 0
      let nr = 0, ng = 0, nb = 0

      // Cardinal neighbors (weight 1.0 each)
      let nIdx = idx - 1
      let nId = gridData[nIdx]
      if (nId > 0 && nId !== ownId) {
        const nY = (nIdx / W) | 0
        const nOff = ((H - 1 - nY) * W + (nIdx - nY * W)) * 4
        nr += base[nOff]; ng += base[nOff + 1]; nb += base[nOff + 2]
        foreignWeight += 1.0
      }
      nIdx = idx + 1
      nId = gridData[nIdx]
      if (nId > 0 && nId !== ownId) {
        const nY = (nIdx / W) | 0
        const nOff = ((H - 1 - nY) * W + (nIdx - nY * W)) * 4
        nr += base[nOff]; ng += base[nOff + 1]; nb += base[nOff + 2]
        foreignWeight += 1.0
      }
      nIdx = idx - W
      nId = gridData[nIdx]
      if (nId > 0 && nId !== ownId) {
        const nY = (nIdx / W) | 0
        const nOff = ((H - 1 - nY) * W + (nIdx - nY * W)) * 4
        nr += base[nOff]; ng += base[nOff + 1]; nb += base[nOff + 2]
        foreignWeight += 1.0
      }
      nIdx = idx + W
      nId = gridData[nIdx]
      if (nId > 0 && nId !== ownId) {
        const nY = (nIdx / W) | 0
        const nOff = ((H - 1 - nY) * W + (nIdx - nY * W)) * 4
        nr += base[nOff]; ng += base[nOff + 1]; nb += base[nOff + 2]
        foreignWeight += 1.0
      }

      // Diagonal neighbors (weight 0.5 each)
      nIdx = idx - W - 1
      nId = gridData[nIdx]
      if (nId > 0 && nId !== ownId) {
        const nY = (nIdx / W) | 0
        const nOff = ((H - 1 - nY) * W + (nIdx - nY * W)) * 4
        nr += base[nOff] * 0.5; ng += base[nOff + 1] * 0.5; nb += base[nOff + 2] * 0.5
        foreignWeight += 0.5
      }
      nIdx = idx - W + 1
      nId = gridData[nIdx]
      if (nId > 0 && nId !== ownId) {
        const nY = (nIdx / W) | 0
        const nOff = ((H - 1 - nY) * W + (nIdx - nY * W)) * 4
        nr += base[nOff] * 0.5; ng += base[nOff + 1] * 0.5; nb += base[nOff + 2] * 0.5
        foreignWeight += 0.5
      }
      nIdx = idx + W - 1
      nId = gridData[nIdx]
      if (nId > 0 && nId !== ownId) {
        const nY = (nIdx / W) | 0
        const nOff = ((H - 1 - nY) * W + (nIdx - nY * W)) * 4
        nr += base[nOff] * 0.5; ng += base[nOff + 1] * 0.5; nb += base[nOff + 2] * 0.5
        foreignWeight += 0.5
      }
      nIdx = idx + W + 1
      nId = gridData[nIdx]
      if (nId > 0 && nId !== ownId) {
        const nY = (nIdx / W) | 0
        const nOff = ((H - 1 - nY) * W + (nIdx - nY * W)) * 4
        nr += base[nOff] * 0.5; ng += base[nOff + 1] * 0.5; nb += base[nOff + 2] * 0.5
        foreignWeight += 0.5
      }

      if (foreignWeight === 0) continue

      // Average the foreign neighbor color
      const invFW255 = 1 / (foreignWeight * 255)
      nr *= invFW255
      ng *= invFW255
      nb *= invFW255

      // Blend strength from neighbor count: 1 diagonal = subtle, 4 cardinals = max
      // Normalized to [0, BOUNDARY_BLEND]
      const blend = (foreignWeight < 6 ? foreignWeight / 6 : 1) * BOUNDARY_BLEND

      const texOff = ((H - 1 - y) * W + x) * 4
      const r = tex[texOff] / 255
      const g = tex[texOff + 1] / 255
      const b = tex[texOff + 2] / 255

      // Screen blend: light transmitted through both crystal layers
      const sr = r + nr * blend - r * nr * blend
      const sg = g + ng * blend - g * ng * blend
      const sb = b + nb * blend - b * nb * blend

      tex[texOff] = (sr * 255) | 0
      tex[texOff + 1] = (sg * 255) | 0
      tex[texOff + 2] = (sb * 255) | 0

      // Track this pixel for incremental restore next time
      this.lastStrainedCells[strainedCount++] = texOff
    }

    this.lastStrainedCount = strainedCount
    this.dirty = true
  }

  /** Reset the texture to fully transparent (black) */
  reset(): void {
    this.textureData.fill(0)
    this.baseTextureData.fill(0)
    this.texture.needsUpdate = true
    this.particleCount = 0
    this.boundaryCandidates.clear()
    this.lastStrainedCount = 0
    invalidateBandCache()
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
    this.boundaryCandidates.clear()
    this.lastStrainedCount = 0
  }
}
