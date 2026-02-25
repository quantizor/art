/**
 * FloodFillSimulation Tests
 *
 * Tests for the stochastic frontier flood-fill engine.
 */

import { describe, test, expect } from 'bun:test'
import { FloodFillSimulation } from './FloodFillSimulation'
import { GRID_WIDTH, GRID_HEIGHT, MAX_PARTICLES } from '../constants'

describe('FloodFillSimulation', () => {
  test('starts with zero aggregate count', () => {
    const sim = new FloodFillSimulation(() => {})
    expect(sim.getAggregateCount()).toBe(0)
  })

  test('addSeed places a seed on the grid and fires callback', () => {
    const sticks: Array<{ cx: number; cy: number; seedId: number }> = []
    const sim = new FloodFillSimulation((_w, cx, cy, seedId) => {
      sticks.push({ cx, cy, seedId })
    })
    sim.addSeed(256, 256)
    expect(sim.getAggregateCount()).toBe(1)
    expect(sim.getSeeds().length).toBe(1)
    expect(sim.getSeeds()[0].x).toBe(256)
    expect(sim.getSeeds()[0].y).toBe(256)
    // Callback should fire for seed placement
    expect(sticks.length).toBe(1)
    expect(sticks[0].seedId).toBe(1)
  })

  test('addSeed generates preferred axes', () => {
    const sim = new FloodFillSimulation(() => {})
    sim.addSeed(100, 100)
    const seed = sim.getSeeds()[0]
    expect(seed.axes.length).toBe(3) // default axisCount
    const spacing = seed.axes[1] - seed.axes[0]
    expect(spacing).toBeCloseTo(Math.PI / 3, 5)
  })

  test('multiple seeds get unique IDs', () => {
    const sim = new FloodFillSimulation(() => {})
    sim.addSeed(100, 100)
    sim.addSeed(400, 400)
    const seeds = sim.getSeeds()
    expect(seeds[0].id).toBe(1)
    expect(seeds[1].id).toBe(2)
    expect(sim.getAggregateCount()).toBe(2)
  })

  test('update produces aggregate growth', () => {
    const sticks: Array<{ cx: number; cy: number; seedId: number }> = []
    const sim = new FloodFillSimulation((_w, cx, cy, seedId) => {
      sticks.push({ cx, cy, seedId })
    })
    sim.addSeed(256, 256)

    sim.update(16)

    const count = sim.getAggregateCount()
    expect(count).toBeGreaterThan(1)
    // sticks includes the seed placement callback
    expect(sticks.length).toBe(count)
  })

  test('cells are always 8-connected to existing aggregate', () => {
    const grid = new Map<string, number>()
    const sim = new FloodFillSimulation((_w, cx, cy, seedId) => {
      grid.set(`${cx},${cy}`, seedId)
    })
    sim.addSeed(256, 256)

    for (let i = 0; i < 10; i++) {
      sim.update(16)
    }

    // Every cell should have at least one 8-connected neighbor in the aggregate
    for (const [key] of grid) {
      const [cx, cy] = key.split(',').map(Number)
      const hasNeighbor =
        grid.has(`${cx + 1},${cy}`) ||
        grid.has(`${cx - 1},${cy}`) ||
        grid.has(`${cx},${cy + 1}`) ||
        grid.has(`${cx},${cy - 1}`) ||
        grid.has(`${cx + 1},${cy + 1}`) ||
        grid.has(`${cx - 1},${cy - 1}`) ||
        grid.has(`${cx + 1},${cy - 1}`) ||
        grid.has(`${cx - 1},${cy + 1}`)
      if (grid.size > 1) {
        expect(hasNeighbor).toBe(true)
      }
    }
  })

  test('onStick callback fires with correct seed ID', () => {
    const sticks: Array<{ seedId: number }> = []
    const sim = new FloodFillSimulation((_w, _cx, _cy, seedId) => {
      sticks.push({ seedId })
    })
    sim.addSeed(256, 256)

    for (let i = 0; i < 5; i++) {
      sim.update(16)
    }

    for (const s of sticks) {
      expect(s.seedId).toBe(1)
    }
  })

  test('reset clears all state', () => {
    const sim = new FloodFillSimulation(() => {})
    sim.addSeed(256, 256)
    for (let i = 0; i < 5; i++) sim.update(16)

    sim.reset()
    expect(sim.getAggregateCount()).toBe(0)
    expect(sim.getSeeds().length).toBe(0)
  })

  test('setParams updates simulation parameters', () => {
    const sim = new FloodFillSimulation(() => {})
    sim.addSeed(256, 256)

    sim.setParams({
      stepsPerFrame: 500,
      biasStrength: 0.5,
      axisCount: 4,
      seedCount: 40,
      stepSize: 1.5,
      walkerCount: 512,
      killRadiusMultiplier: 3.0,
    })

    sim.update(16)
    expect(sim.getAggregateCount()).toBeGreaterThan(1)
  })

  test('simulation grows substantially over many frames', () => {
    const sim = new FloodFillSimulation(() => {})
    sim.addSeed(256, 256)

    // Run enough frames to see meaningful growth
    for (let i = 0; i < 50; i++) {
      sim.update(16)
    }

    // 50 frames × 300 stepsPerFrame = ~15,000 cells claimed
    expect(sim.getAggregateCount()).toBeGreaterThan(5000)
  })

  test('simulation respects MAX_PARTICLES limit', () => {
    let count = 0
    const sim = new FloodFillSimulation(() => { count++ })
    sim.addSeed(256, 256)

    // Run a few frames and verify count never exceeds MAX_PARTICLES
    for (let i = 0; i < 100; i++) {
      sim.update(16)
    }

    expect(sim.getAggregateCount()).toBeLessThanOrEqual(MAX_PARTICLES)
    expect(sim.getAggregateCount()).toBe(count)
  })

  test('no duplicate cells are claimed', () => {
    const cells = new Set<string>()
    let duplicates = 0
    const sim = new FloodFillSimulation((_w, cx, cy) => {
      const key = `${cx},${cy}`
      if (cells.has(key)) duplicates++
      cells.add(key)
    })
    sim.addSeed(256, 256)

    for (let i = 0; i < 20; i++) {
      sim.update(16)
    }

    expect(duplicates).toBe(0)
  })

  test('growth provides distFromSeed in callback', () => {
    const distances: number[] = []
    const sim = new FloodFillSimulation(
      (_w, cx, cy, _seedId, _angle, distFromSeed) => {
        distances.push(distFromSeed)
      }
    )
    sim.addSeed(256, 256)

    for (let i = 0; i < 5; i++) {
      sim.update(16)
    }

    // First callback is seed placement (dist=0), rest should be > 0
    expect(distances[0]).toBe(0)
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThan(0)
    }
  })

  test('addSeed mid-simulation expands new frontier', () => {
    const seedIds = new Set<number>()
    const sim = new FloodFillSimulation((_w, _cx, _cy, seedId) => {
      seedIds.add(seedId)
    })
    sim.addSeed(100, 100)

    for (let i = 0; i < 5; i++) sim.update(16)

    sim.addSeed(400, 400)

    for (let i = 0; i < 10; i++) sim.update(16)

    // Both seeds should have contributed cells
    expect(seedIds.has(1)).toBe(true)
    expect(seedIds.has(2)).toBe(true)
  })
})

describe('FloodFillSimulation seedMany', () => {
  test('places multiple seeds at once', () => {
    const sim = new FloodFillSimulation(() => {})
    sim.seedMany([
      { x: 100, y: 100 },
      { x: 200, y: 200 },
      { x: 300, y: 300 },
    ])
    expect(sim.getSeeds().length).toBe(3)
    expect(sim.getAggregateCount()).toBe(3)
  })

  test('assigns unique IDs to all seeds', () => {
    const sim = new FloodFillSimulation(() => {})
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
    const sim = new FloodFillSimulation(() => {})
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

  test('growth occurs from multiple seeds', () => {
    const seedIds = new Set<number>()
    const sim = new FloodFillSimulation((_w, _cx, _cy, seedId) => {
      seedIds.add(seedId)
    })
    sim.seedMany([
      { x: 100, y: 256 },
      { x: 400, y: 256 },
    ])

    for (let i = 0; i < 20; i++) {
      sim.update(16)
    }

    expect(seedIds.size).toBe(2)
  })

  test('seeds compete for shared boundary cells', () => {
    // Place two seeds close together — they should form a boundary
    const cellOwners = new Map<string, number>()
    const sim = new FloodFillSimulation((_w, cx, cy, seedId) => {
      cellOwners.set(`${cx},${cy}`, seedId)
    })
    sim.seedMany([
      { x: 250, y: 256 },
      { x: 260, y: 256 },
    ])

    // Run until they meet
    for (let i = 0; i < 100; i++) {
      sim.update(16)
    }

    // Check cells between the two seeds — some should belong to seed 1, some to seed 2
    let seed1Count = 0
    let seed2Count = 0
    for (let x = 250; x <= 260; x++) {
      const owner = cellOwners.get(`${x},256`)
      if (owner === 1) seed1Count++
      else if (owner === 2) seed2Count++
    }
    expect(seed1Count).toBeGreaterThan(0)
    expect(seed2Count).toBeGreaterThan(0)
  })
})
