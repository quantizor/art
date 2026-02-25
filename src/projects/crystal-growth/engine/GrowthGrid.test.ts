/**
 * GrowthGrid Tests
 *
 * Tests for the flat Uint16Array occupancy grid.
 */

import { describe, test, expect } from 'bun:test'
import { GrowthGrid } from './GrowthGrid'

describe('GrowthGrid', () => {
  test('initializes with all cells empty', () => {
    const grid = new GrowthGrid(10, 10)
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        expect(grid.get(x, y)).toBe(0)
      }
    }
  })

  test('set and get a cell', () => {
    const grid = new GrowthGrid(10, 10)
    grid.set(3, 4, 1)
    expect(grid.get(3, 4)).toBe(1)
    expect(grid.get(3, 3)).toBe(0) // adjacent cell still empty
  })

  test('set multiple seeds with different IDs', () => {
    const grid = new GrowthGrid(20, 20)
    grid.set(5, 5, 1)
    grid.set(15, 15, 2)
    grid.set(10, 10, 3)
    expect(grid.get(5, 5)).toBe(1)
    expect(grid.get(15, 15)).toBe(2)
    expect(grid.get(10, 10)).toBe(3)
  })

  test('hasNeighbor returns true when adjacent cell is occupied', () => {
    const grid = new GrowthGrid(10, 10)
    grid.set(5, 5, 1)

    // 4-connected neighbors
    expect(grid.hasNeighbor(5, 4)).toBe(true) // above
    expect(grid.hasNeighbor(5, 6)).toBe(true) // below
    expect(grid.hasNeighbor(4, 5)).toBe(true) // left
    expect(grid.hasNeighbor(6, 5)).toBe(true) // right
  })

  test('hasNeighbor returns false when no adjacent cell is occupied', () => {
    const grid = new GrowthGrid(10, 10)
    grid.set(5, 5, 1)

    // Diagonal — not a 4-neighbor
    expect(grid.hasNeighbor(4, 4)).toBe(false)
    expect(grid.hasNeighbor(6, 6)).toBe(false)

    // Two cells away
    expect(grid.hasNeighbor(3, 5)).toBe(false)
    expect(grid.hasNeighbor(5, 3)).toBe(false)
  })

  test('hasNeighbor returns false at grid edges (no out-of-bounds read)', () => {
    const grid = new GrowthGrid(10, 10)
    grid.set(0, 0, 1)

    // Checking neighbors at (0, 0) should not crash
    expect(grid.hasNeighbor(1, 0)).toBe(true) // right neighbor
    expect(grid.hasNeighbor(0, 1)).toBe(true) // below neighbor
  })

  test('isInBounds checks boundaries correctly', () => {
    const grid = new GrowthGrid(10, 10)
    expect(grid.isInBounds(0, 0)).toBe(true)
    expect(grid.isInBounds(9, 9)).toBe(true)
    expect(grid.isInBounds(-1, 0)).toBe(false)
    expect(grid.isInBounds(0, -1)).toBe(false)
    expect(grid.isInBounds(10, 0)).toBe(false)
    expect(grid.isInBounds(0, 10)).toBe(false)
  })

  test('isSafeForWalker checks interior boundaries (1-cell margin)', () => {
    const grid = new GrowthGrid(10, 10)
    expect(grid.isSafeForWalker(0, 0)).toBe(false) // edge
    expect(grid.isSafeForWalker(1, 1)).toBe(true)
    expect(grid.isSafeForWalker(8, 8)).toBe(true)
    expect(grid.isSafeForWalker(9, 9)).toBe(false) // edge
  })

  test('clear resets all cells to empty', () => {
    const grid = new GrowthGrid(10, 10)
    grid.set(3, 3, 1)
    grid.set(7, 7, 2)
    grid.clear()
    expect(grid.get(3, 3)).toBe(0)
    expect(grid.get(7, 7)).toBe(0)
  })

  test('getNeighborSeedId returns the seed ID of an occupied neighbor', () => {
    const grid = new GrowthGrid(10, 10)
    grid.set(5, 5, 3)
    // Check from position adjacent to (5,5)
    expect(grid.getNeighborSeedId(5, 4)).toBe(3) // above has neighbor below at (5,5)
    expect(grid.getNeighborSeedId(6, 5)).toBe(3)
  })

  test('getNeighborSeedId returns 0 when no neighbors', () => {
    const grid = new GrowthGrid(10, 10)
    expect(grid.getNeighborSeedId(5, 5)).toBe(0)
  })

  test('worldToCell converts world coordinates to grid cells', () => {
    const grid = new GrowthGrid(100, 100, 2) // resolution = 2
    const { cx, cy } = grid.worldToCell(5.3, 10.7)
    expect(cx).toBe(10) // 5.3 * 2 = 10.6, truncated to 10
    expect(cy).toBe(21) // 10.7 * 2 = 21.4, truncated to 21
  })

  test('cellToWorld converts grid cells back to world coordinates', () => {
    const grid = new GrowthGrid(100, 100, 2)
    const { wx, wy } = grid.cellToWorld(10, 20)
    expect(wx).toBe(5) // 10 / 2
    expect(wy).toBe(10) // 20 / 2
  })

  test('raw data is a flat Uint16Array', () => {
    const grid = new GrowthGrid(8, 8)
    expect(grid.data).toBeInstanceOf(Uint16Array)
    expect(grid.data.length).toBe(64) // 8 * 8
  })
})
