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
import { cellHash } from './ColorMapper'
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_SCALE,
  RESOLUTION,
  DEFAULT_SIM_PARAMS,
  MAX_PARTICLES,
} from '../constants'
import type { Seed, SimulationParams, OnStickCallback } from '../types'

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

  /** Per-seed cell counts for pressure computation */
  private seedCellCounts: Map<number, number> = new Map()

  /** Per-seed accumulated pressure level (max pressure seen from any neighbor) */
  private seedPressure: Map<number, number> = new Map()

  /** Max growth radius² — crystals stop growing beyond this distance from seed */
  private maxGrowthRadiusSq = Infinity

  /** True when all seeds have reached their growth cap or exhausted frontiers */
  private allSeedsCapped = false

  private onStickExternal: OnStickCallback

  constructor(onStick: OnStickCallback) {
    this.onStickExternal = onStick
    this.grid = new GrowthGrid(GRID_WIDTH, GRID_HEIGHT, RESOLUTION)
  }

  /** Add a seed at the given grid coordinates */
  addSeed(x: number, y: number): void {
    const id = this.nextSeedId++
    const cx = Math.round(x) | 0
    const cy = Math.round(y) | 0

    const axisCount = this.params.axisCount
    const axes: number[] = []
    const baseAngle = Math.random() * Math.PI
    for (let i = 0; i < axisCount; i++) {
      axes.push(baseAngle + (i * Math.PI) / axisCount)
    }

    // Random tilt per crystal — varies effective retardation and brightness
    // ±0.8 rad (±46°) produces dramatic per-grain color/brightness variety
    const tilt = (Math.random() - 0.5) * 1.6

    const seed: Seed = { id, x: cx, y: cy, axes, tilt }
    this.seeds.push(seed)
    this.seedMap.set(id, seed)
    this.seedIdsCache.push(id)

    if (this.grid.isInBounds(cx, cy) && this.grid.get(cx, cy) === 0) {
      this.grid.set(cx, cy, id)
      this.aggregateCount++
      this.seedCellCounts.set(id, 1)

      // Initialize frontier with empty 8-connected neighbors
      const frontier = new Set<number>()
      const heap = new MinHeap(64)
      this.frontiers.set(id, frontier)
      this.frontierHeaps.set(id, heap)
      this.addEmptyNeighborsToFrontier(cx, cy, frontier, heap, seed)

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

    // Lazy-compute max growth radius on first update (after all seeds placed)
    if (this.maxGrowthRadiusSq === Infinity) {
      this.computeMaxGrowthRadius()
    }

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

        // Track per-seed cell count
        const ownCount = (this.seedCellCounts.get(seedId) || 0) + 1
        this.seedCellCounts.set(seedId, ownCount)

        // Compute boundary pressure: check if neighbors belong to foreign grains
        let boundaryPressure = 0
        for (let d = 0; d < 8; d++) {
          const nx = cx + DX[d]
          const ny = cy + DY[d]
          if (this.grid.isInBounds(nx, ny)) {
            const foreignId = this.grid.get(nx, ny)
            if (foreignId > 0 && foreignId !== seedId) {
              const foreignCount = this.seedCellCounts.get(foreignId) || 0
              const ratio = foreignCount / Math.max(1, ownCount)
              // Pressure is proportional to how much larger the neighbor is
              boundaryPressure = Math.max(
                boundaryPressure,
                ratio > 1 ? Math.min(ratio - 1, 2) : ratio * 0.15
              )
            }
          }
        }

        // Track seed's max known pressure for near-boundary gradient
        if (boundaryPressure > 0) {
          const prev = this.seedPressure.get(seedId) || 0
          this.seedPressure.set(seedId, Math.max(prev, boundaryPressure))
        }

        // Compute growth metadata and fire callback
        const growthAngle = Math.atan2(cy - seed.y, cx - seed.x)
        const distFromSeed = Math.sqrt(
          (cx - seed.x) ** 2 + (cy - seed.y) ** 2
        )

        // Near-boundary interior cells get a mild pressure gradient
        const seedKnownPressure = this.seedPressure.get(seedId) || 0
        if (boundaryPressure === 0 && seedKnownPressure > 0) {
          const effectiveRadius = Math.sqrt(ownCount / Math.PI)
          const normalizedDist = distFromSeed / Math.max(1, effectiveRadius)
          if (normalizedDist > 0.7) {
            boundaryPressure = seedKnownPressure * ((normalizedDist - 0.7) / 0.3) * 0.2
          }
        }

        this.onStickExternal(0, cx, cy, seedId, growthAngle, distFromSeed, boundaryPressure)

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
    this.seedPressure.clear()
    this.maxGrowthRadiusSq = Infinity
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
        const baseAngle = Math.random() * Math.PI
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

  /**
   * Compute max growth radius from seed count and grid dimensions.
   *
   * Targets ~85% theoretical grid coverage so that ~15% remains as
   * negative space. The cap also never exceeds 25% of the longest
   * grid dimension, preventing any single crystal from dominating.
   */
  private computeMaxGrowthRadius(): void {
    // Max growth radius = 65% of longest dimension. No per-seed area limit —
    // natural frontier competition between seeds determines final grain sizes.
    // Seeds with more space grow large; crowded seeds stay small.
    const maxDim = Math.max(GRID_WIDTH, GRID_HEIGHT)
    const maxRadius = maxDim * 0.35
    this.maxGrowthRadiusSq = maxRadius * maxRadius
  }

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

          // Push to heap with distance² + noise + facet penalty
          const dx = nx - seed.x
          const dy = ny - seed.y
          const dist2 = dx * dx + dy * dy
          let score = dist2 + cellHash(nx >> 3, ny >> 3) * 3.0

          // Faceted growth: replace circular distance with polygon-normalized
          // distance so growth follows convex polygon contours. A cell's
          // "polygon distance" = dist / r_polygon(θ), where r_polygon is
          // the regular N-gon edge distance at that angle. Cells on the
          // same scaled polygon contour get equal scores → convex growth.
          const facets = this.params.facets
          if (facets >= 3 && dist2 > 4) {
            const angle = Math.atan2(dy, dx)
            const halfSector = Math.PI / facets
            const twoSector = 2 * halfSector
            const relAngle = angle - seed.axes[0]
            const sectorAngle = ((relAngle % twoSector) + twoSector) % twoSector - halfSector
            // Distance from center to polygon edge at this angle
            const polyRadius = Math.cos(halfSector) / Math.cos(sectorAngle)
            // Normalized distance: same value = same polygon contour
            const polyDist = Math.sqrt(dist2) / polyRadius
            score = polyDist * polyDist + cellHash(nx >> 3, ny >> 3) * 3.0
          }

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
    seed: Seed
  ): number {
    const maxRadSq = this.maxGrowthRadiusSq

    while (heap.size > 0) {
      const key = heap.pop()
      if (key === -1) break

      // Lazy deletion: skip if no longer in this seed's frontier
      if (!frontier.has(key)) continue

      // Check growth radius (polygon-aware when faceted)
      const fy = (key / GRID_WIDTH) | 0
      const fx = key - fy * GRID_WIDTH
      const dx = fx - seed.x
      const dy = fy - seed.y
      let effectiveDist2 = dx * dx + dy * dy

      const facets = this.params.facets
      if (facets >= 3 && effectiveDist2 > 4) {
        const angle = Math.atan2(dy, dx)
        const halfSector = Math.PI / facets
        const twoSector = 2 * halfSector
        const relAngle = angle - seed.axes[0]
        const sectorAngle = ((relAngle % twoSector) + twoSector) % twoSector - halfSector
        const polyRadius = Math.cos(halfSector) / Math.cos(sectorAngle)
        const polyDist = Math.sqrt(effectiveDist2) / polyRadius
        effectiveDist2 = polyDist * polyDist
      }

      if (effectiveDist2 > maxRadSq) {
        frontier.delete(key)
        continue
      }

      return key
    }

    return -1
  }
}
