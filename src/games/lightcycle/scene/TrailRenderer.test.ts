/**
 * Trail point spacing tests.
 *
 * Exercises production helpers used by TrailRenderer, without Three.js.
 */

import { describe, test, expect } from 'bun:test'
import {
  POINT_SPACING,
  accumulateTravel,
  buildTrailIndices,
  distanceBetween,
  shouldAddControlPoint,
} from './trailPointLogic'

describe('trailPointLogic', () => {
  describe('distanceBetween', () => {
    test('returns zero for identical points', () => {
      expect(distanceBetween({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 })).toBe(0)
    })

    test('includes Y in the distance', () => {
      expect(distanceBetween({ x: 0, y: 0, z: 0 }, { x: 0, y: 3, z: 4 })).toBe(5)
    })
  })

  describe('accumulateTravel', () => {
    test('leaves the accumulator unchanged when there is no previous point', () => {
      expect(accumulateTravel(null, { x: 10, y: 0, z: 0 }, 1.5)).toBe(1.5)
    })

    test('adds the step distance to the accumulator', () => {
      expect(
        accumulateTravel({ x: 0, y: 0, z: 0 }, { x: POINT_SPACING, y: 0, z: 0 }, 0),
      ).toBe(POINT_SPACING)
    })
  })

  describe('shouldAddControlPoint', () => {
    test('is false below spacing', () => {
      expect(shouldAddControlPoint(POINT_SPACING - 0.01)).toBe(false)
    })

    test('is true at and above spacing', () => {
      expect(shouldAddControlPoint(POINT_SPACING)).toBe(true)
      expect(shouldAddControlPoint(POINT_SPACING + 1)).toBe(true)
    })
  })

  describe('spacing integration', () => {
    test('adds a point after traveling POINT_SPACING units', () => {
      let distanceSinceLastPoint = 0
      let last: { x: number; y: number; z: number } | null = { x: 0, y: 0, z: 0 }
      const points: Array<{ x: number; y: number; z: number }> = [
        { x: 0, y: 0, z: 0 },
      ]

      const steps = [
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 2.5, y: 0, z: 0 },
      ]

      for (const step of steps) {
        distanceSinceLastPoint = accumulateTravel(last, step, distanceSinceLastPoint)
        if (shouldAddControlPoint(distanceSinceLastPoint)) {
          points.push(step)
          distanceSinceLastPoint = 0
        }
        last = step
      }

      expect(points).toEqual([
        { x: 0, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
      ])
      expect(distanceSinceLastPoint).toBeCloseTo(0.5)
    })
  })

  describe('buildTrailIndices', () => {
    test('produces no triangles for a single point', () => {
      expect(buildTrailIndices(1)).toEqual([])
    })

    test('produces 3 quads (18 indices) per adjacent point pair', () => {
      const indices = buildTrailIndices(5)
      expect(indices.length).toBe((5 - 1) * 18)
    })

    test('never references a vertex beyond 4 * maxPoints', () => {
      const maxPoints = 6
      const indices = buildTrailIndices(maxPoints)
      const maxVertex = Math.max(...indices)
      expect(maxVertex).toBeLessThan(maxPoints * 4)
    })

    test('first quad set wires point 0 to point 1', () => {
      // Left face: (0,4,1) (1,4,5); right face: (2,3,6) (3,7,6); top: (1,5,3) (3,5,7)
      expect(buildTrailIndices(2)).toEqual([
        0, 4, 1,
        1, 4, 5,
        2, 3, 6,
        3, 7, 6,
        1, 5, 3,
        3, 5, 7,
      ])
    })
  })
})
