/**
 * WalkerCompiler Tests
 *
 * Tests for the JIT-compiled walker step function.
 */

import { describe, test, expect } from 'bun:test'
import { compileStepFunction } from './WalkerCompiler'

describe('WalkerCompiler', () => {
  const gridW = 20
  const gridH = 20
  const config = { gridW, gridH, stepsPerFrame: 50 }

  function makeArrays(count: number) {
    return {
      walkerX: new Float32Array(count),
      walkerY: new Float32Array(count),
      walkerActive: new Uint8Array(count),
      walkerSeedId: new Uint16Array(count),
      biasX: new Float32Array(count),
      biasY: new Float32Array(count),
      grid: new Uint16Array(gridW * gridH),
    }
  }

  test('returns a callable function', () => {
    const step = compileStepFunction(config)
    expect(typeof step).toBe('function')
  })

  test('inactive walkers are not moved', () => {
    const step = compileStepFunction(config)
    const { walkerX, walkerY, walkerActive, walkerSeedId, biasX, biasY, grid } = makeArrays(1)
    walkerX[0] = 10
    walkerY[0] = 10
    walkerActive[0] = 0 // inactive
    walkerSeedId[0] = 1

    const sticks: number[][] = []
    step(walkerX, walkerY, walkerActive, walkerSeedId, grid, 1, 1.0, biasX, biasY, (w, cx, cy, sid) => {
      sticks.push([w, cx, cy, sid])
    })

    // Position unchanged since walker is inactive
    expect(walkerX[0]).toBe(10)
    expect(walkerY[0]).toBe(10)
    expect(sticks.length).toBe(0)
  })

  test('walker sticks when adjacent to occupied cell', () => {
    const step = compileStepFunction({ gridW, gridH, stepsPerFrame: 1 })
    const { walkerX, walkerY, walkerActive, walkerSeedId, biasX, biasY, grid } = makeArrays(1)

    // Place seed at (10, 10)
    grid[10 * gridW + 10] = 1

    // Place walker at cell center (11.5, 10.5) — adjacent to seed at cell (10, 10)
    walkerX[0] = 11.5
    walkerY[0] = 10.5
    walkerActive[0] = 1
    walkerSeedId[0] = 1

    const sticks: number[][] = []
    step(walkerX, walkerY, walkerActive, walkerSeedId, grid, 1, 0.01, biasX, biasY, (w, cx, cy, sid) => {
      sticks.push([w, cx, cy, sid])
    })

    // Walker should have stuck (cell (11, 10) is adjacent to (10, 10))
    expect(sticks.length).toBe(1)
    expect(walkerActive[0]).toBe(0) // deactivated
    expect(sticks[0][3]).toBe(1) // correct seed ID
  })

  test('walker is deactivated when it goes out of bounds', () => {
    const step = compileStepFunction({ gridW, gridH, stepsPerFrame: 200 })
    const { walkerX, walkerY, walkerActive, walkerSeedId, biasX, biasY, grid } = makeArrays(1)

    // Place walker near edge with strong bias toward edge
    walkerX[0] = 1
    walkerY[0] = 10
    walkerActive[0] = 1
    walkerSeedId[0] = 1
    biasX[0] = -5 // strong negative bias pushes walker out of bounds

    const sticks: number[][] = []
    step(walkerX, walkerY, walkerActive, walkerSeedId, grid, 1, 1.0, biasX, biasY, (w, cx, cy, sid) => {
      sticks.push([w, cx, cy, sid])
    })

    // Walker should be dead (out of bounds)
    expect(walkerActive[0]).toBe(0)
    expect(sticks.length).toBe(0) // died, didn't stick
  })

  test('onStick callback receives correct seed ID', () => {
    const step = compileStepFunction({ gridW, gridH, stepsPerFrame: 1 })
    const { walkerX, walkerY, walkerActive, walkerSeedId, biasX, biasY, grid } = makeArrays(1)

    // Seed 7 at (10, 10)
    grid[10 * gridW + 10] = 7

    walkerX[0] = 9.5
    walkerY[0] = 10.5
    walkerActive[0] = 1
    walkerSeedId[0] = 7

    const sticks: number[][] = []
    step(walkerX, walkerY, walkerActive, walkerSeedId, grid, 1, 0.01, biasX, biasY, (w, cx, cy, sid) => {
      sticks.push([w, cx, cy, sid])
    })

    expect(sticks.length).toBe(1)
    expect(sticks[0][3]).toBe(7)
  })

  test('processes multiple walkers in a batch', () => {
    const step = compileStepFunction({ gridW, gridH, stepsPerFrame: 1 })
    const count = 3
    const { walkerX, walkerY, walkerActive, walkerSeedId, biasX, biasY, grid } = makeArrays(count)

    // Seed at (10, 10)
    grid[10 * gridW + 10] = 1

    // Walker 0: adjacent, should stick
    walkerX[0] = 11.5; walkerY[0] = 10.5; walkerActive[0] = 1; walkerSeedId[0] = 1

    // Walker 1: far away, should not stick
    walkerX[1] = 5.5; walkerY[1] = 5.5; walkerActive[1] = 1; walkerSeedId[1] = 1

    // Walker 2: inactive
    walkerX[2] = 11.5; walkerY[2] = 10.5; walkerActive[2] = 0; walkerSeedId[2] = 1

    const sticks: number[][] = []
    step(walkerX, walkerY, walkerActive, walkerSeedId, grid, count, 0.01, biasX, biasY, (w, cx, cy, sid) => {
      sticks.push([w, cx, cy, sid])
    })

    // Only walker 0 should stick
    expect(sticks.length).toBe(1)
    expect(sticks[0][0]).toBe(0) // walker index 0
  })

  test('stuck walker cell gets written to grid', () => {
    const step = compileStepFunction({ gridW, gridH, stepsPerFrame: 1 })
    const { walkerX, walkerY, walkerActive, walkerSeedId, biasX, biasY, grid } = makeArrays(1)

    grid[10 * gridW + 10] = 1
    walkerX[0] = 11.5; walkerY[0] = 10.5; walkerActive[0] = 1; walkerSeedId[0] = 1

    step(walkerX, walkerY, walkerActive, walkerSeedId, grid, 1, 0.01, biasX, biasY, () => {})

    // Cell (11, 10) should now be occupied
    expect(grid[10 * gridW + 11]).toBe(1)
  })
})
