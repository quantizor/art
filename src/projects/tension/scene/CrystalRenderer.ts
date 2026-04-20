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
import { computeColorDirect, computeColorWallBased, invalidateBandCache, precomputeSeedTilt } from '../engine/ColorMapper'
import type { SeedTiltData } from '../engine/ColorMapper'
import { GRID_WIDTH, GRID_HEIGHT, GRID_SCALE } from '../constants'
import type { ColorParams, Seed } from '../types'

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

  /** Per-seed pastel placeholder colour cache (rgb packed into 3 bytes). */
  private partitionColorCache: Map<number, [number, number, number]> = new Map()

  /** Per-seed maximum wall distance — used by the druse-trigger heuristic. */
  private seedMaxWallDist: Map<number, number> = new Map()

  /** Indices of cells currently lit as sparkle dust (cleared next frame). */
  private sparkleCells: Uint32Array = new Uint32Array(0)
  private sparkleCount = 0

  /** Cells sorted by wallDist ascending — the reveal order (inward). */
  private revealOrder: Uint32Array | null = null
  private revealCursor = 0
  private revealWallDist: Uint16Array | null = null
  private revealSeeds: Map<number, Seed> | null = null
  private revealTiltCache: Map<number, SeedTiltData> = new Map()
  private revealColorParams: ColorParams | null = null
  private revealColors: Uint8Array | null = null
  /**
   * Preserved prior-nodule reveal order, kept live through the
   * reset→re-init boundary so the dissolve→growing transition can
   * cross-fade sparkles between the old and new cell sets.
   */
  private previousRevealOrder: Uint32Array | null = null
  /** Walk pointer into the cell-order-independent (raw idx) precompute loop. */
  private precomputeIdx = 0
  private precomputeDone = false

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

  /**
   * Write a faint per-seed placeholder colour for a cell claimed during
   * the silent partition phase. Lets the user see cavity territories
   * expand in real time; gets overwritten during reveal.
   */
  addPartitionPixel(cx: number, cy: number, seedId: number): void {
    if (cx < 0 || cx >= GRID_WIDTH || cy < 0 || cy >= GRID_HEIGHT) return
    let rgb = this.partitionColorCache.get(seedId)
    if (!rgb) {
      // Deterministic low-chroma pastel per seed.
      const h = ((seedId * 83 + 29) * 2654435761) >>> 0
      const hue = h % 360
      const hRad = (hue * Math.PI) / 180
      const C = 0.04, L = 0.72
      const a = C * Math.cos(hRad), b = C * Math.sin(hRad)
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b
      const s_ = L - 0.0894841775 * a - 1.2914855480 * b
      const lc = l_ * l_ * l_, mc = m_ * m_ * m_, sc = s_ * s_ * s_
      const rLin = +4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc
      const gLin = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc
      const bLin = -0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc
      const toSrgb = (x: number) => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
      const clip = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x
      rgb = [
        (clip(toSrgb(rLin)) * 255) | 0,
        (clip(toSrgb(gLin)) * 255) | 0,
        (clip(toSrgb(bLin)) * 255) | 0,
      ]
      this.partitionColorCache.set(seedId, rgb)
    }
    const texY = GRID_HEIGHT - 1 - cy
    const off = (texY * GRID_WIDTH + cx) * 4
    this.textureData[off] = rgb[0]
    this.textureData[off + 1] = rgb[1]
    this.textureData[off + 2] = rgb[2]
    this.textureData[off + 3] = 255
    this.particleCount++
    this.dirty = true
  }

  /**
   * Prepare an inward reveal pass. Call after the voronoi partition +
   * wall-distance transform are finished. Sorts every claimed cell by
   * wallDist ascending (wall-first, centre-last) so advanceReveal can
   * stream colours in deposition order.
   */
  prepareReveal(
    gridData: Uint16Array,
    wallDist: Uint16Array,
    seeds: Map<number, Seed>,
    colorParams: ColorParams
  ): void {
    const N = gridData.length
    // Count claimed cells per wall-distance bucket.
    let maxD = 0
    let filled = 0
    for (let i = 0; i < N; i++) {
      if (gridData[i] !== 0) {
        filled++
        if (wallDist[i] > maxD) maxD = wallDist[i]
      }
    }
    const buckets = new Uint32Array(maxD + 2)
    for (let i = 0; i < N; i++) {
      if (gridData[i] !== 0) buckets[wallDist[i]]++
    }
    // Prefix sums → offsets.
    let acc = 0
    for (let i = 0; i < buckets.length; i++) {
      const c = buckets[i]
      buckets[i] = acc
      acc += c
    }
    const order = new Uint32Array(filled)
    const cursor = new Uint32Array(buckets.length)
    for (let i = 0; i < N; i++) {
      if (gridData[i] === 0) continue
      const d = wallDist[i]
      order[buckets[d] + cursor[d]++] = i
    }
    // Per-seed max wallDist for druse-trigger heuristic (in cell units).
    this.seedMaxWallDist.clear()
    for (let i = 0; i < N; i++) {
      const s = gridData[i]
      if (s === 0) continue
      const w = wallDist[i]
      const cur = this.seedMaxWallDist.get(s) ?? 0
      if (w > cur) this.seedMaxWallDist.set(s, w)
    }

    this.revealOrder = order
    this.revealCursor = 0
    this.revealWallDist = wallDist
    this.revealSeeds = seeds
    this.revealColorParams = colorParams
    this.revealTiltCache.clear()
    this.gridData = gridData

    // Allocate the precompute buffer but leave it empty; caller pumps
    // the precompute in chunks via precomputeChunk() so the main thread
    // stays responsive (orb pulses smoothly, no jank).
    if (!this.revealColors || this.revealColors.length !== N * 4) {
      this.revealColors = new Uint8Array(N * 4)
    } else {
      this.revealColors.fill(0)
    }
    this.precomputeIdx = 0
    this.precomputeDone = false

    // Clear any prior colour in case we were re-used.
    this.textureData.fill(0)
    this.baseTextureData.fill(0)
    this.boundaryCandidates.clear()
    this.lastStrainedCount = 0
    this.dirty = true
  }

  /** Number of cells remaining to reveal. */
  revealRemaining(): number {
    if (!this.revealOrder) return 0
    return this.revealOrder.length - this.revealCursor
  }

  /**
   * Process up to `count` cells of the color precompute. Returns true
   * when the entire grid has been precomputed. Safe to call every
   * frame during the growing phase — keeps the main thread responsive.
   */
  precomputeChunk(count: number): boolean {
    if (this.precomputeDone) return true
    const grid = this.gridData
    const wallDist = this.revealWallDist
    const seeds = this.revealSeeds
    const colorParams = this.revealColorParams
    const rc = this.revealColors
    if (!grid || !wallDist || !seeds || !colorParams || !rc) return true

    const W = GRID_WIDTH
    const invScale = 1 / GRID_SCALE
    const N = grid.length
    const end = Math.min(this.precomputeIdx + count, N)

    for (let i = this.precomputeIdx; i < end; i++) {
      const seedId = grid[i]
      if (seedId === 0) continue
      const seed = seeds.get(seedId)
      if (!seed) continue
      let tilt = this.revealTiltCache.get(seedId)
      if (!tilt) {
        tilt = precomputeSeedTilt(seed)
        this.revealTiltCache.set(seedId, tilt)
      }
      const cy = (i / W) | 0
      const cx = i - cy * W
      const dx = (cx - seed.x) * invScale
      const dy = (cy - seed.y) * invScale
      const wallDistCells = (wallDist[i] / 3) * invScale
      const cavityMax = ((this.seedMaxWallDist.get(seedId) ?? 0) / 3) * invScale
      computeColorWallBased(
        dx, dy, wallDistCells,
        colorParams,
        seed.axes[0] ?? 0,
        tilt,
        rc, rc, i * 4,
        cavityMax
      )
    }

    this.precomputeIdx = end
    if (end >= N) this.precomputeDone = true
    return this.precomputeDone
  }

  /** True if all cell colours have been precomputed and reveal can begin. */
  isPrecomputeDone(): boolean {
    return this.precomputeDone
  }

  /**
   * Animate a sparkle of bright pixels across cells that haven't been
   * revealed yet — gives the cavity a "loading" twinkle while it fills.
   * Each frame: clear last frame's sparkles, light up `count` new
   * random unrevealed cells.
   */
  /**
   * Pulsing orb of sparkles at canvas centre — shown during the growing
   * phase between fade-out and reveal. Density and radius pulse with
   * `phase` (0..1, typically a sin wave). Signals "working" without
   * revealing any of the actual design yet.
   */
  /** Centres where growing-phase orbs should pulse. */
  private orbCenters: readonly { x: number; y: number }[] = []

  setOrbCenters(centers: readonly { x: number; y: number }[]): void {
    this.orbCenters = centers
  }

  // Shared 3×3 gaussian kernel used by all particle phases.
  private static readonly SPARKLE_KERNEL = [
    0.28, 0.55, 0.28,
    0.55, 1.00, 0.55,
    0.28, 0.55, 0.28,
  ]

  /**
   * Shared sparkle-drawing primitive. Picks `count` cell indices from
   * [minIdx, maxIdx) of the reveal order (wall→centre) and splats a
   * soft 3×3 blob at each. Max-blends into the texture so sparkles
   * layer onto whatever's already there.
   */
  private splatSparkles(
    count: number, minIdx: number, maxIdx: number, pulse: number
  ): void {
    this.splatSparklesFromOrder(this.revealOrder, count, minIdx, maxIdx, pulse)
  }

  /**
   * Cheap shimmer primitive: given any cell-index order array and a
   * window within it, splats `count` soft 3×3 sparkles at randomly-
   * sampled cells. All particle phases use this — the only thing that
   * varies between phases is the cell set (paint area) and density.
   */
  private splatSparklesFromOrder(
    order: Uint32Array | null,
    count: number,
    minIdx: number,
    maxIdx: number,
    pulse: number
  ): void {
    if (!order || maxIdx <= minIdx || count <= 0) return
    const tex = this.textureData
    const W = GRID_WIDTH
    const H = GRID_HEIGHT
    const kernel = CrystalRenderer.SPARKLE_KERNEL
    const needed = this.sparkleCount + count * 9
    if (this.sparkleCells.length < needed) {
      const grown = new Uint32Array(Math.max(needed, this.sparkleCells.length * 2))
      grown.set(this.sparkleCells.subarray(0, this.sparkleCount))
      this.sparkleCells = grown
    }
    const range = maxIdx - minIdx
    for (let i = 0; i < count; i++) {
      const k = minIdx + ((Math.random() * range) | 0)
      const idx = order[k]
      const cy = (idx / W) | 0
      const cx = idx - cy * W
      const peak = 90 + ((Math.random() * 45) | 0) + ((pulse * 35) | 0)
      this.splatSoft(cx, cy, peak, kernel, tex, W, H)
    }
  }

  /**
   * Restores tracked sparkle cells to baseTextureData rather than zero:
   * cells revealed between sparkle splat and this restore would otherwise
   * become black specks baked into the final reveal.
   */
  private clearSparkles(): void {
    const tex = this.textureData
    const base = this.baseTextureData
    for (let i = 0; i < this.sparkleCount; i++) {
      const off = this.sparkleCells[i]
      tex[off] = base[off]
      tex[off + 1] = base[off + 1]
      tex[off + 2] = base[off + 2]
      tex[off + 3] = base[off + 3]
    }
    this.sparkleCount = 0
    this.dirty = true
  }

  restoreSparklesFromBase(): void {
    this.clearSparkles()
  }

  /** Save the current reveal order so the next reset can cross-fade against it. */
  capturePreviousRevealOrder(): void {
    this.previousRevealOrder = this.revealOrder
  }

  /** Drop the saved previous reveal order (after cross-fade completes). */
  clearPreviousRevealOrder(): void {
    this.previousRevealOrder = null
  }

  hasPreviousRevealOrder(): boolean {
    return this.previousRevealOrder !== null
  }

  /**
   * Cross-fade sparkles between the previous and current cavities by
   * physically lerping each sparkle's position from an old-cavity cell
   * to a new-cavity cell. `t` 0→1 slides the whole cloud from the old
   * shape to the new shape. Host-rock grid check is skipped during
   * the morph since intermediate positions may fall outside both
   * cavities; sparkleCells is still tracked so next frame clears them.
   */
  drawCrossfadeSparkles(count: number, pulse: number, t: number): void {
    this.clearSparkles()
    const prev = this.previousRevealOrder
    const cur = this.revealOrder
    const tt = t < 0 ? 0 : t > 1 ? 1 : t

    // If only one side is present, both fall back to it. Always route
    // through splatSoftNoGrid because sim.reset() clears gridData
    // between dissolve and partition-worker return.
    const prevSide = (prev && prev.length > 0) ? prev : (cur && cur.length > 0 ? cur : null)
    const curSide = (cur && cur.length > 0) ? cur : (prev && prev.length > 0 ? prev : null)
    if (!prevSide || !curSide) { this.dirty = true; return }

    const tex = this.textureData
    const W = GRID_WIDTH
    const H = GRID_HEIGHT
    const kernel = CrystalRenderer.SPARKLE_KERNEL
    if (this.sparkleCells.length < count * 9) {
      this.sparkleCells = new Uint32Array(count * 9)
    }

    // Simultaneous paint: split the sparkle budget between the OLD
    // cavity (fading) and the NEW cavity (emerging). A visible dissolve
    // on one side happens alongside a visible materialise on the other
    // so the lit-pixel count stays roughly constant through the
    // transition — no sudden shrink even when the new cavity is much
    // smaller than the old one.
    const prevShare = (count * (1 - tt)) | 0
    const curShare = count - prevShare

    const drawSide = (side: Uint32Array, n: number, fade: number) => {
      if (n <= 0) return
      const peakBase = (90 * fade) | 0
      const peakRange = (45 * fade) | 0
      const peakPulse = (35 * fade) | 0
      for (let i = 0; i < n; i++) {
        const idx = side[(Math.random() * side.length) | 0]
        const cy = (idx / W) | 0
        const cx = idx - cy * W
        const peak = peakBase + ((Math.random() * peakRange) | 0) + ((pulse * peakPulse) | 0)
        this.splatSoftNoGrid(cx, cy, peak, kernel, tex, W, H)
      }
    }

    // Old side fades from 1 → 0 across the crossfade; new side rises
    // from 0 → 1. Peaks scale so the dissolving cavity softly dims
    // rather than abruptly vanishing.
    drawSide(prevSide, prevShare, 1 - tt * 0.6)
    drawSide(curSide, curShare, 0.4 + tt * 0.6)

    this.dirty = true
  }

  /** splatSoft variant that ignores gridData (for morph transitions). */
  private splatSoftNoGrid(
    cx: number, cy: number, peak: number,
    kernel: number[], tex: Uint8Array, W: number, H: number
  ): void {
    for (let ky = 0; ky < 3; ky++) {
      const py = cy + ky - 1
      if (py < 0 || py >= H) continue
      const texY = H - 1 - py
      for (let kx = 0; kx < 3; kx++) {
        const px = cx + kx - 1
        if (px < 0 || px >= W) continue
        const off = (texY * W + px) * 4
        const v = (peak * kernel[ky * 3 + kx]) | 0
        if (v > tex[off]) {
          tex[off] = v
          tex[off + 1] = v
          tex[off + 2] = v
          tex[off + 3] = 255
          this.sparkleCells[this.sparkleCount++] = off
        }
      }
    }
  }

  drawGrowthOrb(count: number, tween: number, pulse: number): void {
    this.clearSparkles()
    const order = this.revealOrder
    if (order && order.length > 0) {
      const t = tween < 0 ? 0 : tween > 1 ? 1 : tween
      const minIdx = Math.floor((1 - t) * order.length)
      this.splatSparkles(count, minIdx, order.length, pulse)
    } else {
      // Fallback before partition is ready — orbs at seed centres.
      const W = GRID_WIDTH
      const H = GRID_HEIGHT
      const tex = this.textureData
      const kernel = CrystalRenderer.SPARKLE_KERNEL
      const centers = this.orbCenters.length > 0
        ? this.orbCenters
        : [{ x: W * 0.5, y: H * 0.5 }]
      const minDim = Math.min(W, H)
      const radius = minDim * (0.06 + 0.04 * pulse)
      const perCenter = Math.max(1, Math.floor(count / centers.length))
      if (this.sparkleCells.length < count * 9) {
        this.sparkleCells = new Uint32Array(count * 9)
      }
      for (let c = 0; c < centers.length; c++) {
        const { x: cx, y: cy } = centers[c]
        for (let i = 0; i < perCenter; i++) {
          const r = (Math.random() + Math.random()) * 0.5 * radius
          const theta = Math.random() * Math.PI * 2
          const px = (cx + Math.cos(theta) * r) | 0
          const py = (cy + Math.sin(theta) * r) | 0
          if (px < 0 || px >= W || py < 0 || py >= H) continue
          const peak = 90 + ((Math.random() * 45) | 0) + ((pulse * 35) | 0)
          this.splatSoft(px, py, peak, kernel, tex, W, H)
        }
      }
    }
    this.dirty = true
  }

  private fadeSource: Uint8Array | null = null

  /** Snapshot the current design so the dissolve can crossfade from it. */
  captureForDissolve(): void {
    if (!this.fadeSource || this.fadeSource.length !== this.textureData.length) {
      this.fadeSource = new Uint8Array(this.textureData.length)
    }
    this.fadeSource.set(this.textureData)
    this.sparkleCount = 0
  }

  /**
   * Per-cell stochastic dissolve: each cell has a stable hash-derived
   * threshold. When `progress` crosses that threshold, the cell flips
   * hard from design colour to black — so the design "eats away" in a
   * scattered pattern rather than fading uniformly. Sparkle density
   * ramps with progress. At progress=1 the canvas is a full sparkle
   * field over a black cavity — the growing-phase start state, so
   * handoff is pixel-continuous with no black frame in between.
   */
  drawParticleDissolve(progress: number, sparkleCount: number, pulse: number): void {
    const tex = this.textureData
    const src = this.fadeSource
    const order = this.revealOrder
    if (!src || !order) { this.dirty = true; return }

    const W = GRID_WIDTH
    const H = GRID_HEIGHT
    const p = progress < 0 ? 0 : progress > 1 ? 1 : progress

    this.clearSparkles()

    // Smoothstep the progress used for the design fade. Linear progress
    // makes the dissolve feel front-heavy — the design disappears too
    // fast at the start and drags at the end. Easing delays the bulk of
    // the fade to the middle of the tween, where sparkle density is
    // also at its peak, so sparkle has room to "take over" visually.
    const pEased = p * p * (3 - 2 * p)

    // Per-cell 2D hash → stable per-cell dissolve threshold. Mixing cx
    // and cy through distinct primes before scrambling decorrelates
    // neighbours in both axes so the dissolve reads as white noise.
    // A narrow window keeps the fade "front" from looking mottled.
    const WINDOW = 0.12
    const low = pEased - WINDOW
    const high = pEased + WINDOW
    const invWindow = 1 / (WINDOW * 2)
    for (let k = 0; k < order.length; k++) {
      const idx = order[k]
      const cy = (idx / W) | 0
      const cx = idx - cy * W
      const texY = H - 1 - cy
      const off = (texY * W + cx) * 4
      let h = (Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263)) | 0
      h = Math.imul(h ^ (h >>> 13), 1274126177) | 0
      h = (h ^ (h >>> 16)) >>> 0
      const cellTh = h / 4294967295
      if (cellTh <= low) {
        tex[off] = 0
        tex[off + 1] = 0
        tex[off + 2] = 0
        tex[off + 3] = src[off + 3]
      } else if (cellTh >= high) {
        tex[off] = src[off]
        tex[off + 1] = src[off + 1]
        tex[off + 2] = src[off + 2]
        tex[off + 3] = src[off + 3]
      } else {
        // Smoothstep the per-cell interpolation for a softer flip.
        const u = (cellTh - low) * invWindow
        const s = u * u * (3 - 2 * u)
        const fade = (s * 256) | 0
        tex[off] = (src[off] * fade) >> 8
        tex[off + 1] = (src[off + 1] * fade) >> 8
        tex[off + 2] = (src[off + 2] * fade) >> 8
        tex[off + 3] = src[off + 3]
      }
    }

    // Baseline sparkle stays high enough that the field is already
    // visually present when the dissolve starts, so the handoff to the
    // growing-phase orb doesn't read as a density jump.
    const n = (1200 + p * sparkleCount) | 0
    this.splatSparklesFromOrder(order, n, 0, order.length, pulse)

    this.dirty = true
  }

  /** Write a soft 3×3 blob centred at (cx, cy). Max-blends so overlap adds softly. */
  private splatSoft(
    cx: number, cy: number, peak: number,
    kernel: number[], tex: Uint8Array, W: number, H: number
  ): void {
    const grid = this.gridData
    for (let ky = 0; ky < 3; ky++) {
      const py = cy + ky - 1
      if (py < 0 || py >= H) continue
      const texY = H - 1 - py
      for (let kx = 0; kx < 3; kx++) {
        const px = cx + kx - 1
        if (px < 0 || px >= W) continue
        // Skip cells outside any nodule — host rock is never in the
        // reveal order and would be left lit after reveal completes,
        // bleeding sparkle pixels into the "empty space" outside the
        // agate. Only splat onto claimed cells.
        if (grid && grid[py * W + px] === 0) continue
        const off = (texY * W + px) * 4
        const v = (peak * kernel[ky * 3 + kx]) | 0
        if (v > tex[off]) {
          tex[off] = v
          tex[off + 1] = v
          tex[off + 2] = v
          tex[off + 3] = 255
          this.sparkleCells[this.sparkleCount++] = off
        }
      }
    }
  }

  drawSparkle(count: number, pulse = 1): void {
    const order = this.revealOrder
    if (!order) return
    this.clearSparkles()
    const remaining = order.length - this.revealCursor
    if (remaining <= 0) { this.dirty = true; return }
    const n = Math.min(count, remaining)
    this.splatSparkles(n, this.revealCursor, order.length, pulse)
    this.dirty = true
  }

  /**
   * Process the next `count` cells in wall-distance order, writing their
   * final colours into both textureData and baseTextureData. Also tracks
   * inter-seed boundary candidates so the post-reveal strain pass can run.
   */
  advanceReveal(count: number): void {
    const order = this.revealOrder
    const grid = this.gridData
    const rc = this.revealColors
    if (!order || !grid || !rc) return

    const W = GRID_WIDTH
    const H = GRID_HEIGHT
    const tex = this.textureData
    const base = this.baseTextureData
    const endCursor = Math.min(this.revealCursor + count, order.length)

    for (let k = this.revealCursor; k < endCursor; k++) {
      const idx = order[k]
      const cy = (idx / W) | 0
      const cx = idx - cy * W
      const seedId = grid[idx]
      if (seedId === 0) continue

      const texY = H - 1 - cy
      const texOff = (texY * W + cx) * 4
      const srcOff = idx * 4
      tex[texOff] = rc[srcOff]
      tex[texOff + 1] = rc[srcOff + 1]
      tex[texOff + 2] = rc[srcOff + 2]
      tex[texOff + 3] = rc[srcOff + 3]
      base[texOff] = rc[srcOff]
      base[texOff + 1] = rc[srcOff + 1]
      base[texOff + 2] = rc[srcOff + 2]
      base[texOff + 3] = rc[srcOff + 3]

      // Incremental boundary tracking for post-reveal strain blending.
      const minX = cx > 0 ? 1 : 0
      const maxX = cx < W - 1 ? 1 : 0
      const minY = cy > 0 ? 1 : 0
      const maxY = cy < H - 1 ? 1 : 0
      if (minX && grid[idx - 1] > 0 && grid[idx - 1] !== seedId) this.boundaryCandidates.add(idx)
      else if (maxX && grid[idx + 1] > 0 && grid[idx + 1] !== seedId) this.boundaryCandidates.add(idx)
      else if (minY && grid[idx - W] > 0 && grid[idx - W] !== seedId) this.boundaryCandidates.add(idx)
      else if (maxY && grid[idx + W] > 0 && grid[idx + W] !== seedId) this.boundaryCandidates.add(idx)
    }

    this.revealCursor = endCursor
    this.particleCount = endCursor
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
    this.revealOrder = null
    this.revealCursor = 0
    this.revealWallDist = null
    this.revealSeeds = null
    this.revealColorParams = null
    this.revealTiltCache.clear()
    this.partitionColorCache.clear()
    this.seedMaxWallDist.clear()
    this.sparkleCount = 0
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
