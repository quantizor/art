/**
 * Performance benchmark for FloodFillSimulation + ColorMapper pipeline.
 *
 * Measures the full per-frame cost: simulation update + color computation.
 * Run with: bun test --timeout 60000 FloodFillSimulation.bench.test.ts
 */

import { describe, test, expect } from 'bun:test'
import { FloodFillSimulation } from './FloodFillSimulation'
import { computeColor } from './ColorMapper'
import { generateSeedPositions } from './SeedPlacer'
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  SEED_MIN_DISTANCE,
  DEFAULT_COLOR_PARAMS,
  GRID_SCALE,
} from '../constants'

describe('FloodFillSimulation benchmark', () => {
  test('simulation-only throughput', () => {
    let particles = 0
    const sim = new FloodFillSimulation(
      (_wi, _cx, _cy, _sid, _ga, _dist, _bp) => { particles++ }
    )

    const positions = generateSeedPositions(40, GRID_WIDTH, GRID_HEIGHT, SEED_MIN_DISTANCE)
    sim.seedMany(positions)

    const frames = 100
    const start = performance.now()
    for (let i = 0; i < frames; i++) sim.update(16)
    const elapsed = performance.now() - start

    console.log(`\n=== Simulation-Only ===`)
    console.log(`Per frame: ${(elapsed / frames).toFixed(2)} ms  |  FPS: ${(1000 / (elapsed / frames)).toFixed(0)}`)
    console.log(`Particles/frame: ${(particles / frames).toFixed(0)}`)
    console.log(`========================\n`)

    expect(particles).toBeGreaterThan(0)
  })

  test('simulation + color computation throughput', () => {
    let particles = 0
    const colorParams = { ...DEFAULT_COLOR_PARAMS }

    const sim = new FloodFillSimulation(
      (_wi, cx, cy, seedId, growthAngle, distFromSeed, boundaryPressure) => {
        particles++
        const seed = sim.getSeed(seedId)
        const seedOrientation = seed ? seed.axes[0] : 0
        const seedTilt = seed ? seed.tilt : 0
        // Simulate the full color computation pipeline
        computeColor(growthAngle, distFromSeed / GRID_SCALE, colorParams, seedOrientation, seedTilt, boundaryPressure)
      }
    )

    const positions = generateSeedPositions(40, GRID_WIDTH, GRID_HEIGHT, SEED_MIN_DISTANCE)
    sim.seedMany(positions)

    const frames = 100
    const start = performance.now()
    for (let i = 0; i < frames; i++) sim.update(16)
    const elapsed = performance.now() - start

    console.log(`\n=== Sim + Color ===`)
    console.log(`Per frame: ${(elapsed / frames).toFixed(2)} ms  |  FPS: ${(1000 / (elapsed / frames)).toFixed(0)}`)
    console.log(`Particles/frame: ${(particles / frames).toFixed(0)}`)
    console.log(`====================\n`)

    expect(particles).toBeGreaterThan(0)
  })

  test('selectNearestFromFrontier stress test (large frontier)', () => {
    // Simulate early growth where frontiers are small, then measure at larger sizes
    let particles = 0
    const sim = new FloodFillSimulation(
      (_wi, _cx, _cy, _sid, _ga, _dist, _bp) => { particles++ }
    )

    const positions = generateSeedPositions(40, GRID_WIDTH, GRID_HEIGHT, SEED_MIN_DISTANCE)
    sim.seedMany(positions)

    // Warm up: grow for 200 frames to build up frontier sizes
    for (let i = 0; i < 200; i++) sim.update(16)
    const warmupParticles = particles

    // Measure: 50 frames at larger frontier size
    particles = 0
    const start = performance.now()
    for (let i = 0; i < 50; i++) sim.update(16)
    const elapsed = performance.now() - start

    console.log(`\n=== Large Frontier ===`)
    console.log(`Per frame: ${(elapsed / 50).toFixed(2)} ms  |  FPS: ${(1000 / (elapsed / 50)).toFixed(0)}`)
    console.log(`Particles/frame: ${(particles / 50).toFixed(0)}`)
    console.log(`Total particles before: ${warmupParticles}, after: ${warmupParticles + particles}`)
    console.log(`=======================\n`)

    expect(particles).toBeGreaterThan(0)
  })
})
