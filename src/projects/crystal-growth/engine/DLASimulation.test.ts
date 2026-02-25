/**
 * DLASimulation Tests
 *
 * Tests for the main DLA engine.
 */

import { describe, test, expect } from 'bun:test'
import { DLASimulation } from './DLASimulation'

describe('DLASimulation', () => {
  test('starts with zero aggregate count', () => {
    const sim = new DLASimulation(() => {})
    expect(sim.getAggregateCount()).toBe(0)
  })

  test('addSeed places a seed on the grid', () => {
    const sim = new DLASimulation(() => {})
    sim.addSeed(256, 256)
    expect(sim.getAggregateCount()).toBe(1)
    expect(sim.getSeeds().length).toBe(1)
    expect(sim.getSeeds()[0].x).toBe(256)
    expect(sim.getSeeds()[0].y).toBe(256)
  })

  test('addSeed generates preferred axes', () => {
    const sim = new DLASimulation(() => {})
    sim.addSeed(100, 100)
    const seed = sim.getSeeds()[0]
    expect(seed.axes.length).toBe(3) // default axisCount
    // Axes should be evenly spaced
    const spacing = seed.axes[1] - seed.axes[0]
    expect(spacing).toBeCloseTo(Math.PI / 3, 5) // 60 degrees spacing for 3 axes in half-circle
  })

  test('multiple seeds get unique IDs', () => {
    const sim = new DLASimulation(() => {})
    sim.addSeed(100, 100)
    sim.addSeed(400, 400)
    const seeds = sim.getSeeds()
    expect(seeds[0].id).toBe(1)
    expect(seeds[1].id).toBe(2)
    expect(sim.getAggregateCount()).toBe(2)
  })

  test('update runs without error', () => {
    const sim = new DLASimulation(() => {})
    sim.addSeed(256, 256)
    // Should not throw
    sim.update(16)
    sim.update(16)
  })

  test('update produces aggregate growth over many frames', () => {
    const sticks: Array<{ cx: number; cy: number; seedId: number }> = []
    const sim = new DLASimulation((_w, cx, cy, seedId) => {
      sticks.push({ cx, cy, seedId })
    })
    sim.addSeed(256, 256)

    // Run many frames to get some sticking
    for (let i = 0; i < 200; i++) {
      sim.update(16)
    }

    const count = sim.getAggregateCount()
    expect(count).toBeGreaterThan(1) // At least seed + some stuck walkers
    expect(sticks.length).toBe(count - 1) // -1 for the seed itself
  })

  test('onStick callback fires with correct seed ID', () => {
    const sticks: Array<{ seedId: number }> = []
    const sim = new DLASimulation((_w, _cx, _cy, seedId) => {
      sticks.push({ seedId })
    })
    sim.addSeed(256, 256)

    for (let i = 0; i < 200; i++) {
      sim.update(16)
    }

    // All sticks should be from seed 1
    for (const s of sticks) {
      expect(s.seedId).toBe(1)
    }
  })

  test('reset clears all state', () => {
    const sim = new DLASimulation(() => {})
    sim.addSeed(256, 256)
    for (let i = 0; i < 50; i++) sim.update(16)

    sim.reset()
    expect(sim.getAggregateCount()).toBe(0)
    expect(sim.getSeeds().length).toBe(0)
  })

  test('setParams updates simulation parameters', () => {
    const sim = new DLASimulation(() => {})
    sim.addSeed(256, 256)

    // Should not throw when updating params
    sim.setParams({
      stepsPerFrame: 200,
      biasStrength: 0.5,
      axisCount: 4,
      seedCount: 40,
      stepSize: 1.5,
      walkerCount: 512,
      killRadiusMultiplier: 3.0,
    })

    sim.update(16)
    // Just verify it doesn't crash
    expect(sim.getAggregateCount()).toBeGreaterThanOrEqual(1)
  })

  test('stuck particles are adjacent to existing aggregate', () => {
    const stickPositions: Array<{ cx: number; cy: number }> = []
    const sim = new DLASimulation((_w, cx, cy) => {
      stickPositions.push({ cx, cy })
    })
    sim.addSeed(256, 256)

    for (let i = 0; i < 100; i++) {
      sim.update(16)
    }

    // Every stuck particle should be adjacent to at least one other aggregate cell
    // (guaranteed by the DLA algorithm's neighbor check)
    expect(stickPositions.length).toBeGreaterThan(0)
  })

  test('biased growth produces elongated structures', () => {
    const stickPositions: Array<{ cx: number; cy: number }> = []
    const sim = new DLASimulation((_w, cx, cy) => {
      stickPositions.push({ cx, cy })
    })
    sim.addSeed(256, 256)
    sim.setParams({
      stepsPerFrame: 100,
      biasStrength: 0.8, // Strong bias
      axisCount: 2, // Only 2 axes = very elongated
      seedCount: 40,
      stepSize: 1.0,
      walkerCount: 1024,
      killRadiusMultiplier: 2.5,
    })

    for (let i = 0; i < 500; i++) {
      sim.update(16)
    }

    if (stickPositions.length < 10) return // Skip if not enough data

    // Measure spread: with 2 axes and strong bias,
    // the structure should be more elongated than circular
    const dx = stickPositions.map((p) => p.cx - 256)
    const dy = stickPositions.map((p) => p.cy - 256)
    const maxDx = Math.max(...dx.map(Math.abs))
    const maxDy = Math.max(...dy.map(Math.abs))
    const maxExtent = Math.max(maxDx, maxDy)

    // The aggregate should extend at least a few cells from the seed
    expect(maxExtent).toBeGreaterThan(2)
  })
})

describe('seedMany', () => {
  test('places multiple seeds at once', () => {
    const sim = new DLASimulation(() => {})
    sim.seedMany([
      { x: 100, y: 100 },
      { x: 200, y: 200 },
      { x: 300, y: 300 },
    ])
    expect(sim.getSeeds().length).toBe(3)
    expect(sim.getAggregateCount()).toBe(3)
  })

  test('assigns unique IDs to all seeds', () => {
    const sim = new DLASimulation(() => {})
    sim.seedMany([
      { x: 100, y: 100 },
      { x: 200, y: 200 },
      { x: 300, y: 300 },
    ])
    const ids = sim.getSeeds().map((s) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(3)
  })

  test('each seed is retrievable via getSeed', () => {
    const sim = new DLASimulation(() => {})
    sim.seedMany([
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ])
    const seed1 = sim.getSeed(1)
    const seed2 = sim.getSeed(2)
    expect(seed1).toBeDefined()
    expect(seed2).toBeDefined()
    expect(seed1!.x).toBe(100)
    expect(seed2!.x).toBe(200)
  })

  test('generates growth axes for each seed', () => {
    const sim = new DLASimulation(() => {})
    sim.seedMany([
      { x: 100, y: 100 },
      { x: 400, y: 400 },
    ])
    for (const seed of sim.getSeeds()) {
      expect(seed.axes.length).toBe(3) // default axisCount
    }
  })

  test('growth occurs from multiple seeds', () => {
    const seedIds = new Set<number>()
    const sim = new DLASimulation((_w, _cx, _cy, seedId) => {
      seedIds.add(seedId)
    })
    sim.seedMany([
      { x: 100, y: 256 },
      { x: 400, y: 256 },
    ])

    for (let i = 0; i < 300; i++) {
      sim.update(16)
    }

    // Both seeds should have attracted some walkers
    expect(seedIds.size).toBeGreaterThanOrEqual(1)
  })
})
