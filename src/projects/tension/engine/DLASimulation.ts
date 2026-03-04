/**
 * DLA Simulation
 *
 * Core Diffusion-Limited Aggregation engine with directional bias.
 * Uses SoA TypedArrays for zero GC pressure and compiled inner loops.
 */

import { GrowthGrid } from './GrowthGrid'
import { compileStepFunction } from './WalkerCompiler'
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  RESOLUTION,
  DEFAULT_SIM_PARAMS,
  MAX_PARTICLES,
} from '../constants'
import type { Seed, SimulationParams, OnStickCallback, StepFunction } from '../types'

export class DLASimulation {
  private grid: GrowthGrid
  private seeds: Seed[] = []
  private seedMap: Map<number, Seed> = new Map()
  private nextSeedId = 1
  private aggregateCount = 0
  private params: SimulationParams = { ...DEFAULT_SIM_PARAMS }

  // SoA walker state
  private walkerX: Float32Array
  private walkerY: Float32Array
  private walkerActive: Uint8Array
  private walkerSeedId: Uint16Array
  private biasX: Float32Array
  private biasY: Float32Array

  // Compiled step function
  private stepFn: StepFunction

  // External callback
  private onStickExternal: OnStickCallback

  constructor(onStick: OnStickCallback) {
    this.onStickExternal = onStick
    this.grid = new GrowthGrid(GRID_WIDTH, GRID_HEIGHT, RESOLUTION)

    const count = this.params.walkerCount
    this.walkerX = new Float32Array(count)
    this.walkerY = new Float32Array(count)
    this.walkerActive = new Uint8Array(count)
    this.walkerSeedId = new Uint16Array(count)
    this.biasX = new Float32Array(count)
    this.biasY = new Float32Array(count)

    this.stepFn = compileStepFunction({
      gridW: GRID_WIDTH,
      gridH: GRID_HEIGHT,
      stepsPerFrame: this.params.stepsPerFrame,
    })
  }

  /** Add a seed at the given grid coordinates */
  addSeed(x: number, y: number): void {
    const id = this.nextSeedId++
    const cx = Math.round(x) | 0
    const cy = Math.round(y) | 0

    // Generate preferred growth axes
    const axisCount = this.params.axisCount
    const axes: number[] = []
    const baseAngle = Math.random() * Math.PI // Random orientation per seed
    for (let i = 0; i < axisCount; i++) {
      axes.push(baseAngle + (i * Math.PI) / axisCount)
    }

    const tilt = (Math.random() - 0.5) * 0.3
    const seed: Seed = { id, x: cx, y: cy, axes, tilt }
    this.seeds.push(seed)
    this.seedMap.set(id, seed)

    // Place seed on grid
    if (this.grid.isInBounds(cx, cy)) {
      this.grid.set(cx, cy, id)
      this.aggregateCount++
    }

    // Initialize walkers
    this.respawnAllWalkers()
  }

  /** Add multiple seeds at once from position array */
  seedMany(positions: Array<{ x: number; y: number }>): void {
    for (const pos of positions) {
      const id = this.nextSeedId++
      const cx = Math.round(pos.x) | 0
      const cy = Math.round(pos.y) | 0

      const axisCount = this.params.axisCount
      const axes: number[] = []
      const baseAngle = Math.random() * Math.PI
      for (let i = 0; i < axisCount; i++) {
        axes.push(baseAngle + (i * Math.PI) / axisCount)
      }

      const tilt = (Math.random() - 0.5) * 0.3
      const seed: Seed = { id, x: cx, y: cy, axes, tilt }
      this.seeds.push(seed)
      this.seedMap.set(id, seed)

      if (this.grid.isInBounds(cx, cy)) {
        this.grid.set(cx, cy, id)
        this.aggregateCount++
      }
    }

    this.respawnAllWalkers()
  }

  /** Run one simulation frame */
  update(_dt: number): void {
    if (this.seeds.length === 0) return
    if (this.aggregateCount >= MAX_PARTICLES) return

    // Run compiled step function
    this.stepFn(
      this.walkerX,
      this.walkerY,
      this.walkerActive,
      this.walkerSeedId,
      this.grid.data,
      this.params.walkerCount,
      this.params.stepSize,
      this.biasX,
      this.biasY,
      (walkerIndex: number, cx: number, cy: number, seedId: number) => {
        this.aggregateCount++

        // Compute growth direction from nearest occupied neighbor
        const growthAngle = this.computeGrowthAngle(cx, cy)
        const seed = this.seedMap.get(seedId)
        const distFromSeed = seed
          ? Math.sqrt((cx - seed.x) ** 2 + (cy - seed.y) ** 2)
          : 0

        this.onStickExternal(walkerIndex, cx, cy, seedId, growthAngle, distFromSeed, 0)
      }
    )

    // Respawn dead walkers
    this.respawnDeadWalkers()
  }

  /** Reset all state */
  reset(): void {
    this.grid.clear()
    this.seeds = []
    this.seedMap.clear()
    this.nextSeedId = 1
    this.aggregateCount = 0
    this.walkerActive.fill(0)
  }

  /** Update simulation parameters */
  setParams(params: SimulationParams): void {
    const needRecompile = params.stepsPerFrame !== this.params.stepsPerFrame
    const needResize = params.walkerCount !== this.params.walkerCount
    this.params = { ...params }

    if (needRecompile) {
      this.stepFn = compileStepFunction({
        gridW: GRID_WIDTH,
        gridH: GRID_HEIGHT,
        stepsPerFrame: params.stepsPerFrame,
      })
    }

    if (needResize) {
      const count = params.walkerCount
      this.walkerX = new Float32Array(count)
      this.walkerY = new Float32Array(count)
      this.walkerActive = new Uint8Array(count)
      this.walkerSeedId = new Uint16Array(count)
      this.biasX = new Float32Array(count)
      this.biasY = new Float32Array(count)
      this.respawnAllWalkers()
    }

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

  /** Compute growth angle as direction from nearest neighbor to this cell */
  private computeGrowthAngle(cx: number, cy: number): number {
    const w = GRID_WIDTH
    const idx = cy * w + cx

    // Find occupied neighbor and compute angle from neighbor to this cell
    let nx = cx
    let ny = cy
    if (cx > 0 && this.grid.data[idx - 1]) { nx = cx - 1 }
    else if (cx < GRID_WIDTH - 1 && this.grid.data[idx + 1]) { nx = cx + 1 }
    else if (cy > 0 && this.grid.data[idx - w]) { ny = cy - 1 }
    else if (cy < GRID_HEIGHT - 1 && this.grid.data[idx + w]) { ny = cy + 1 }
    else { return Math.random() * Math.PI * 2 }

    // Angle from neighbor to this cell
    return Math.atan2(cy - ny, cx - nx)
  }

  /** Spawn a walker at a random position across the entire grid */
  private spawnWalker(index: number): void {
    if (this.seeds.length === 0) return

    // Spawn at random position on the grid
    const margin = 2
    this.walkerX[index] = margin + Math.random() * (GRID_WIDTH - 2 * margin)
    this.walkerY[index] = margin + Math.random() * (GRID_HEIGHT - 2 * margin)
    this.walkerActive[index] = 1

    // Find nearest seed for bias computation
    const wx = this.walkerX[index]
    const wy = this.walkerY[index]
    let nearestSeed = this.seeds[0]
    let nearestDist2 = Infinity
    for (const seed of this.seeds) {
      const dx = wx - seed.x
      const dy = wy - seed.y
      const d2 = dx * dx + dy * dy
      if (d2 < nearestDist2) {
        nearestDist2 = d2
        nearestSeed = seed
      }
    }

    this.walkerSeedId[index] = nearestSeed.id

    // Compute directional bias toward nearest preferred axis
    this.computeBias(index, nearestSeed)
  }

  /** Compute directional bias for a walker */
  private computeBias(index: number, seed: Seed): void {
    const dx = this.walkerX[index] - seed.x
    const dy = this.walkerY[index] - seed.y
    const angleToSeed = Math.atan2(dy, dx)

    // Find nearest preferred axis
    let minDiff = Infinity
    let nearestAxis = 0
    for (const axis of seed.axes) {
      // Check both directions of the axis
      let diff = Math.abs(angleToSeed - axis)
      if (diff > Math.PI) diff = Math.PI * 2 - diff
      if (diff < minDiff) {
        minDiff = diff
        nearestAxis = axis
      }
      // Also check opposite direction
      let diffOpp = Math.abs(angleToSeed - (axis + Math.PI))
      if (diffOpp > Math.PI) diffOpp = Math.PI * 2 - diffOpp
      if (diffOpp < minDiff) {
        minDiff = diffOpp
        nearestAxis = axis + Math.PI
      }
    }

    // Bias toward the seed along the nearest axis
    const biasStrength = this.params.biasStrength
    this.biasX[index] = -Math.cos(nearestAxis) * biasStrength
    this.biasY[index] = -Math.sin(nearestAxis) * biasStrength
  }

  /** Respawn all walkers */
  private respawnAllWalkers(): void {
    for (let i = 0; i < this.params.walkerCount; i++) {
      this.spawnWalker(i)
    }
  }

  /** Respawn only dead/inactive walkers (OOB deactivated by compiled step) */
  private respawnDeadWalkers(): void {
    for (let i = 0; i < this.params.walkerCount; i++) {
      if (!this.walkerActive[i]) {
        this.spawnWalker(i)
      }
    }
  }
}
