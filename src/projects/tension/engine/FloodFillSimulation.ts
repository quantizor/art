/**
 * Flood-Fill Simulation
 *
 * Nearest-first frontier expansion engine that grows solid Voronoi-like
 * grain domains. Each seed expands outward by always claiming the
 * nearest unclaimed frontier cell, producing compact, gap-free growth
 * with straight grain boundaries — like a cross-section through 3D
 * crystals viewed under polarized light.
 *
 * A per-seed max growth radius leaves intentional negative space
 * between grains, proportional to the longest screen dimension.
 */

import { GrowthGrid } from './GrowthGrid'
import { MinHeap } from './MinHeap'
import { cellHash, valueNoise } from './ColorMapper'
import { forkSeedDomain, DOMAIN, type PRNG } from './SeededRandom'
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_SCALE,
  RESOLUTION,
  DEFAULT_SIM_PARAMS,
  MAX_PARTICLES,
} from '../constants'
import type { CrystalProfile, Seed, SimulationParams, OnStickCallback } from '../types'
import { getProfile, DEFAULT_CRYSTAL_TYPE } from '../profiles'

/** Pack (x, y) into a single integer key for Set storage */
function packKey(x: number, y: number): number {
  return y * GRID_WIDTH + x
}

// 8-connected neighbor offsets (cardinal + diagonal)
const DX = [1, -1, 0, 0, 1, -1, 1, -1]
const DY = [0, 0, 1, -1, 1, -1, -1, 1]

export class FloodFillSimulation {
  private grid: GrowthGrid
  private seeds: Seed[] = []
  private seedMap: Map<number, Seed> = new Map()
  private nextSeedId = 1
  private aggregateCount = 0
  private params: SimulationParams = { ...DEFAULT_SIM_PARAMS }

  /** Per-seed frontier: seedId → Set of packed grid keys (membership check) */
  private frontiers: Map<number, Set<number>> = new Map()

  /** Per-seed frontier heap: seedId → MinHeap ordered by distance (fast nearest selection) */
  private frontierHeaps: Map<number, MinHeap> = new Map()

  /** Reverse index: packed cell key → seed IDs whose frontiers contain it */
  private cellToSeeds: Map<number, number[]> = new Map()

  /** Cached array of active seed IDs (avoids Array.from each frame) */
  private seedIdsCache: number[] = []

  /** Per-seed cell count for area cap enforcement */
  private seedCellCounts: Map<number, number> = new Map()

  /** Max cells per seed — derived from profile.maxGrainArea */
  private maxCellsPerSeed: number

  /** Active crystal profile */
  private profile: CrystalProfile = getProfile(DEFAULT_CRYSTAL_TYPE)

  /** True when all seeds have exhausted their frontiers */
  private allSeedsCapped = false

  /** Master seed for deterministic PRNG forking */
  private masterSeed = 0

  private onStickExternal: OnStickCallback

  constructor(onStick: OnStickCallback) {
    this.onStickExternal = onStick
    this.grid = new GrowthGrid(GRID_WIDTH, GRID_HEIGHT, RESOLUTION)
    this.maxCellsPerSeed = Math.round(MAX_PARTICLES * this.profile.maxGrainArea)
  }

  /** Switch the active crystal profile */
  setProfile(profile: CrystalProfile): void {
    this.profile = profile
    this.maxCellsPerSeed = Math.round(MAX_PARTICLES * profile.maxGrainArea)
  }

  /** Set the master seed for deterministic PRNG forking */
  setSeed(seed: number): void {
    this.masterSeed = seed
  }

  /** Add a seed at the given grid coordinates */
  addSeed(x: number, y: number): void {
    const id = this.nextSeedId++
    const cx = Math.round(x) | 0
    const cy = Math.round(y) | 0

    const axisCount = this.params.axisCount
    const axes: number[] = []
    // Use seed index (0-based) for per-seed PRNG forking
    const seedRng: PRNG = forkSeedDomain(this.masterSeed, DOMAIN.SEED_CRYSTALS, id - 1)
    const baseAngle = seedRng() * Math.PI
    for (let i = 0; i < axisCount; i++) {
      axes.push(baseAngle + (i * Math.PI) / axisCount)
    }

    // Random tilt per crystal — varies effective retardation and brightness
    const tilt = (seedRng() - 0.5) * 2 * this.profile.tiltRange

    const seed: Seed = { id, x: cx, y: cy, axes, tilt }
    this.seeds.push(seed)
    this.seedMap.set(id, seed)
    this.seedIdsCache.push(id)

    if (this.grid.isInBounds(cx, cy) && this.grid.get(cx, cy) === 0) {
      this.grid.set(cx, cy, id)
      this.aggregateCount++
      // Initialize frontier with empty 8-connected neighbors
      const frontier = new Set<number>()
      const heap = new MinHeap(64)
      this.frontiers.set(id, frontier)
      this.frontierHeaps.set(id, heap)
      this.addEmptyNeighborsToFrontier(cx, cy, frontier, heap, seed)

      this.seedCellCounts.set(id, 1)

      // Fire callback for the seed cell itself (no boundary pressure at origin)
      this.onStickExternal(0, cx, cy, id, 0, 0, 0)
    }
  }

  /** Add multiple seeds at once from position array */
  seedMany(positions: Array<{ x: number; y: number }>): void {
    for (const pos of positions) {
      this.addSeed(pos.x, pos.y)
    }
  }

  /** Run one simulation frame */
  update(_dt: number): void {
    if (this.seeds.length === 0) return
    if (this.aggregateCount >= MAX_PARTICLES) return
    if (this.allSeedsCapped) return

    // Scale fill rate by DPI^1.5 (not DPI² — quadratic is too expensive at 2× DPI)
    const scaledSteps = this.params.stepsPerFrame * Math.pow(GRID_SCALE, 1.5)

    // Cubic ease-out: starts fast, decelerates smoothly as grid fills
    const progress = this.aggregateCount / MAX_PARTICLES
    const easeOut = (1 - progress) * (1 - progress) * (1 - progress) // (1-t)³
    const speedMultiplier = 0.15 + 0.85 * easeOut

    const fillsThisFrame = Math.min(
      Math.round(scaledSteps * speedMultiplier),
      MAX_PARTICLES - this.aggregateCount
    )

    // Compute total frontier size for proportional allocation
    let totalFrontierSize = 0
    this.frontiers.forEach((frontier) => {
      totalFrontierSize += frontier.size
    })
    if (totalFrontierSize === 0) {
      this.allSeedsCapped = true
      return
    }

    // Track whether any cells were filled this frame
    const countBefore = this.aggregateCount

    // Distribute fills proportionally to frontier size
    let fillsRemaining = fillsThisFrame
    const seedIds = this.seedIdsCache

    for (let si = 0; si < seedIds.length; si++) {
      const seedId = seedIds[si]
      const frontier = this.frontiers.get(seedId)
      if (!frontier || frontier.size === 0) continue

      const seed = this.seedMap.get(seedId)
      if (!seed) continue

      // Area cap: stop seed at 35% of total grid
      const cellCount = this.seedCellCounts.get(seedId) ?? 0
      if (cellCount >= this.maxCellsPerSeed) {
        frontier.clear()
        this.frontierHeaps.get(seedId)?.clear()
        continue
      }

      // Proportional allocation (at least 1 if frontier non-empty)
      const proportion = frontier.size / totalFrontierSize
      let fillsForSeed = Math.max(1, Math.round(fillsThisFrame * proportion))
      fillsForSeed = Math.min(fillsForSeed, fillsRemaining, frontier.size)

      if (fillsForSeed <= 0) continue

      const heap = this.frontierHeaps.get(seedId)!

      // Claim nearest frontier cells for this seed
      for (let f = 0; f < fillsForSeed; f++) {
        if (frontier.size === 0) break

        const chosenKey = this.selectNearestFromHeap(heap, frontier, seed)
        if (chosenKey === -1) {
          // All remaining frontier cells are beyond growth radius — seed is done
          frontier.clear()
          heap.clear()
          break
        }

        // Inline unpackKey — avoid tuple allocation in hot loop
        const cy = (chosenKey / GRID_WIDTH) | 0
        const cx = chosenKey - cy * GRID_WIDTH

        // Claim the cell
        this.grid.set(cx, cy, seedId)
        this.aggregateCount++
        const newCount = (this.seedCellCounts.get(seedId) ?? 0) + 1
        this.seedCellCounts.set(seedId, newCount)
        if (newCount >= this.maxCellsPerSeed) {
          frontier.clear()
          heap.clear()
          break
        }

        // Remove from only the seeds that contest this cell (reverse index)
        const contestingSeeds = this.cellToSeeds.get(chosenKey)
        if (contestingSeeds) {
          for (let ci = 0; ci < contestingSeeds.length; ci++) {
            const otherFrontier = this.frontiers.get(contestingSeeds[ci])
            if (otherFrontier) otherFrontier.delete(chosenKey)
          }
          this.cellToSeeds.delete(chosenKey)
        }

        // Add new empty neighbors to this seed's frontier
        this.addEmptyNeighborsToFrontier(cx, cy, frontier, heap, seed)

        // Fire callback with raw (dx, dy) offsets — no atan2/sqrt needed.
        // The color pipeline computes distance/angle only where required.
        const dxFromSeed = cx - seed.x
        const dyFromSeed = cy - seed.y

        this.onStickExternal(0, cx, cy, seedId, dxFromSeed, dyFromSeed, 0)

        if (this.aggregateCount >= MAX_PARTICLES) return
      }

      fillsRemaining -= fillsForSeed
      if (fillsRemaining <= 0) break
    }

    // If no cells were filled, all seeds are capped or blocked
    if (this.aggregateCount === countBefore) {
      this.allSeedsCapped = true
    }
  }

  /** Check if the simulation has finished (grid full or all seeds capped) */
  isDone(): boolean {
    return this.aggregateCount >= MAX_PARTICLES || this.allSeedsCapped
  }

  /** Reset all state */
  reset(): void {
    this.grid.clear()
    this.seeds = []
    this.seedMap.clear()
    this.frontiers.clear()
    this.frontierHeaps.clear()
    this.cellToSeeds.clear()
    this.seedIdsCache = []
    this.seedCellCounts.clear()
    this.allSeedsCapped = false
    this.nextSeedId = 1
    this.aggregateCount = 0
  }

  /** Update simulation parameters */
  setParams(params: SimulationParams): void {
    this.params = { ...params }

    // Re-generate seed axes if axis count changed
    for (const seed of this.seeds) {
      if (seed.axes.length !== params.axisCount) {
        seed.axes = []
        const seedRng: PRNG = forkSeedDomain(this.masterSeed, DOMAIN.SEED_CRYSTALS, seed.id - 1)
        const baseAngle = seedRng() * Math.PI
        for (let i = 0; i < params.axisCount; i++) {
          seed.axes.push(baseAngle + (i * Math.PI) / params.axisCount)
        }
      }
    }
  }

  /** Get current aggregate particle count */
  getAggregateCount(): number {
    return this.aggregateCount
  }

  /** Get all seeds */
  getSeeds(): readonly Seed[] {
    return this.seeds
  }

  /** Get seed by ID (O(1) lookup) */
  getSeed(id: number): Seed | undefined {
    return this.seedMap.get(id)
  }

  /** Get the grid (for testing) */
  getGrid(): GrowthGrid {
    return this.grid
  }

  // ─── Private ─────────────────────────────────────

  /** Add empty 8-connected neighbors of (cx, cy) to frontier set + heap */
  private addEmptyNeighborsToFrontier(
    cx: number,
    cy: number,
    frontier: Set<number>,
    heap: MinHeap,
    seed: Seed
  ): void {
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d]
      const ny = cy + DY[d]
      if (
        this.grid.isInBounds(nx, ny) &&
        this.grid.get(nx, ny) === 0
      ) {
        const key = packKey(nx, ny)
        if (!frontier.has(key)) {
          frontier.add(key)

          // Fractal growth scoring: use fBM-warped distance so the
          // crystal's silhouette mirrors its internal band pattern.
          // Same noise field as the color mapper (noiseScale=0.035).
          const dx = nx - seed.x
          const dy = ny - seed.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          // Normalize to base resolution for noise coordinate consistency
          const invScale = 1 / GRID_SCALE
          const bx = dx * invScale
          const by = dy * invScale

          // Inline fBM (matches color mapper exactly)
          const ns = this.profile.growthNoiseScale
          let fnx = bx * ns
          let fny = by * ns
          const pwHL = Math.pow(2, -this.profile.growthH)
          const octaves = this.profile.growthOctaves
          let warp = 0
          let amp = 1.0
          for (let oi = 0; oi < octaves; oi++) {
            warp += amp * (valueNoise(fnx, fny) - 0.5)
            amp *= pwHL
            fnx *= 2
            fny *= 2
          }

          // Fade warp in from center (matches color mapper centerFade)
          const bwBase = 14 // bandWavelength reference scale
          const fadeMul = this.profile.bandCenterFadeMultiplier
          const centerFade = dist * invScale < bwBase * fadeMul
            ? (dist * invScale) / (bwBase * fadeMul) : 1
          const warpedDist = dist + warp * bwBase * this.profile.growthWarpStrength * centerFade * GRID_SCALE

          // Score by warped distance² — crystal grows along fBM contours
          const score = warpedDist * warpedDist

          heap.push(key, score)

          // Register in reverse index
          const existing = this.cellToSeeds.get(key)
          if (existing) {
            existing.push(seed.id)
          } else {
            this.cellToSeeds.set(key, [seed.id])
          }
        }
      }
    }
  }

  /**
   * Pop the nearest valid frontier cell from the heap.
   *
   * Uses lazy deletion: cells that have been claimed by another seed
   * (removed from the Set but still in the heap) are discarded on pop.
   * O(log N) amortized per selection vs the previous O(N) linear scan.
   */
  private selectNearestFromHeap(
    heap: MinHeap,
    frontier: Set<number>,
    _seed: Seed
  ): number {
    while (heap.size > 0) {
      const key = heap.pop()
      if (key === -1) break

      // Lazy deletion: skip if no longer in this seed's frontier
      if (!frontier.has(key)) continue

      return key
    }

    return -1
  }
}
