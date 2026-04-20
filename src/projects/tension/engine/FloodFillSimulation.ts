/**
 * Seed store for the cavity partition pipeline.
 *
 * Owns the grid buffer and the per-seed metadata (axes, tilt, noise
 * offsets, cavity radius/aspect). The partition itself is computed
 * synchronously outside this class (CavityPartition.ts); the class
 * is kept because callers still want seed generation + grid storage
 * in one place.
 */

import { GrowthGrid } from './GrowthGrid'
import { forkSeedDomain, DOMAIN, type PRNG } from './SeededRandom'
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_SCALE,
  RESOLUTION,
  DEFAULT_SIM_PARAMS,
} from '../constants'
import type { CrystalProfile, Seed, SimulationParams } from '../types'
import { profile as agateProfile } from '../profiles'

export class FloodFillSimulation {
  private grid: GrowthGrid
  private seeds: Seed[] = []
  private nextSeedId = 1
  private params: SimulationParams = { ...DEFAULT_SIM_PARAMS }
  private profile: CrystalProfile = agateProfile
  private masterSeed = 0

  constructor() {
    this.grid = new GrowthGrid(GRID_WIDTH, GRID_HEIGHT, RESOLUTION)
  }

  setSeed(seed: number): void {
    this.masterSeed = seed
  }

  setParams(params: SimulationParams): void {
    this.params = { ...params }
    // Regenerate axes if axis count changed per-seed.
    for (const seed of this.seeds) {
      if (seed.axes.length !== params.axisCount) {
        const seedRng: PRNG = forkSeedDomain(this.masterSeed, DOMAIN.SEED_CRYSTALS, seed.id - 1)
        const baseAngle = seedRng() * Math.PI
        seed.axes = []
        for (let i = 0; i < params.axisCount; i++) {
          seed.axes.push(baseAngle + (i * Math.PI) / params.axisCount)
        }
      }
    }
  }

  seedMany(positions: Array<{ x: number; y: number }>): void {
    for (const pos of positions) {
      this.addSeed(pos.x, pos.y)
    }
  }

  getSeeds(): readonly Seed[] {
    return this.seeds
  }

  getGrid(): GrowthGrid {
    return this.grid
  }

  reset(): void {
    this.grid.clear()
    this.seeds = []
    this.nextSeedId = 1
  }

  private addSeed(x: number, y: number): void {
    const id = this.nextSeedId++
    const cx = Math.round(x) | 0
    const cy = Math.round(y) | 0

    const seedRng: PRNG = forkSeedDomain(this.masterSeed, DOMAIN.SEED_CRYSTALS, id - 1)
    const baseAngle = seedRng() * Math.PI
    const axes: number[] = []
    for (let i = 0; i < this.params.axisCount; i++) {
      axes.push(baseAngle + (i * Math.PI) / this.params.axisCount)
    }

    const tilt = (seedRng() - 0.5) * 2 * this.profile.tiltRange
    const noiseOffsetX = seedRng() * 1000
    const noiseOffsetY = seedRng() * 1000

    // Per-seed cavity cap — biased toward big, chonky dominant nodules.
    const minR = 420 * GRID_SCALE
    const maxR = 820 * GRID_SCALE
    const maxRadius = minR + seedRng() * (maxR - minR)
    const aspectRatio = 0.55 + seedRng() * 0.95

    this.seeds.push({
      id, x: cx, y: cy, axes, tilt, noiseOffsetX, noiseOffsetY, maxRadius, aspectRatio,
    })
  }
}
