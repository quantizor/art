/**
 * GridSystem Tests
 *
 * Tests for grid-based movement and positioning calculations.
 */

import { describe, test, expect } from 'bun:test'
import { GridSystem } from './GridSystem'

describe('GridSystem', () => {
  const gridSystem = new GridSystem()

  describe('moveForward', () => {
    test('moves north (negative z)', () => {
      const position = { x: 0, z: 0 }
      const result = gridSystem.moveForward(position, 'north', 5)
      expect(result.x).toBe(0)
      expect(result.z).toBe(-5)
    })

    test('moves south (positive z)', () => {
      const position = { x: 0, z: 0 }
      const result = gridSystem.moveForward(position, 'south', 5)
      expect(result.x).toBe(0)
      expect(result.z).toBe(5)
    })

    test('moves east (positive x)', () => {
      const position = { x: 0, z: 0 }
      const result = gridSystem.moveForward(position, 'east', 5)
      expect(result.x).toBe(5)
      expect(result.z).toBe(0)
    })

    test('moves west (negative x)', () => {
      const position = { x: 0, z: 0 }
      const result = gridSystem.moveForward(position, 'west', 5)
      expect(result.x).toBe(-5)
      expect(result.z).toBe(0)
    })
  })

  describe('moveForwardAngle', () => {
    test('moves at angle 0 (north)', () => {
      const position = { x: 0, z: 0 }
      const result = gridSystem.moveForwardAngle(position, 0, 5)
      expect(result.x).toBeCloseTo(0, 5)
      expect(result.z).toBeCloseTo(-5, 5)
    })

    test('moves at angle PI/2 (east)', () => {
      const position = { x: 0, z: 0 }
      const result = gridSystem.moveForwardAngle(position, Math.PI / 2, 5)
      expect(result.x).toBeCloseTo(5, 5)
      expect(result.z).toBeCloseTo(0, 5)
    })

    test('moves at angle PI (south)', () => {
      const position = { x: 0, z: 0 }
      const result = gridSystem.moveForwardAngle(position, Math.PI, 5)
      expect(result.x).toBeCloseTo(0, 5)
      expect(result.z).toBeCloseTo(5, 5)
    })

    test('moves at diagonal angle', () => {
      const position = { x: 0, z: 0 }
      const result = gridSystem.moveForwardAngle(position, Math.PI / 4, 5)
      // 45 degrees: should move equally in x and -z
      const expected = 5 * Math.sin(Math.PI / 4) // ~3.54
      expect(result.x).toBeCloseTo(expected, 5)
      expect(result.z).toBeCloseTo(-expected, 5)
    })
  })

  describe('calculateMovement', () => {
    test('calculates movement for 1 second at normal speed', () => {
      const movement = gridSystem.calculateMovement(1000, 1)
      expect(movement).toBe(12) // BASE_SPEED = 12
    })

    test('calculates movement for 0.5 seconds at double speed', () => {
      const movement = gridSystem.calculateMovement(500, 2)
      expect(movement).toBe(12) // 0.5s * 2x speed * 12 = 12
    })
  })

  describe('isInBounds', () => {
    test('returns true for center of arena', () => {
      expect(gridSystem.isInBounds({ x: 0, z: 0 })).toBe(true)
    })

    test('returns true for position within bounds', () => {
      expect(gridSystem.isInBounds({ x: 50, z: 50 })).toBe(true)
    })

    test('returns false for position outside bounds', () => {
      expect(gridSystem.isInBounds({ x: 100, z: 0 })).toBe(false) // ARENA_HALF = 64
    })

    test('respects margin parameter', () => {
      // At 63.5, with default margin 0.5, should be at edge
      expect(gridSystem.isInBounds({ x: 63.4, z: 0 })).toBe(true)
      expect(gridSystem.isInBounds({ x: 63.6, z: 0 })).toBe(false)
    })
  })

  describe('distanceToWall', () => {
    test('calculates distance to north wall', () => {
      const distance = gridSystem.distanceToWall({ x: 0, z: 10 }, 'north')
      expect(distance).toBe(74) // 10 + ARENA_HALF (64)
    })

    test('calculates distance to south wall', () => {
      const distance = gridSystem.distanceToWall({ x: 0, z: 10 }, 'south')
      expect(distance).toBe(54) // ARENA_HALF (64) - 10
    })
  })

  describe('distance', () => {
    test('calculates distance between two points', () => {
      const distance = gridSystem.distance({ x: 0, z: 0 }, { x: 3, z: 4 })
      expect(distance).toBe(5) // 3-4-5 triangle
    })
  })

  describe('snapToGrid', () => {
    test('snaps position to nearest grid cell', () => {
      const snapped = gridSystem.snapToGrid({ x: 1.7, z: 2.3 })
      expect(snapped.x).toBe(2)
      expect(snapped.z).toBe(2)
    })
  })
})
