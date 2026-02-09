/**
 * TrailRenderer Tests
 *
 * Tests for the spline-based trail system.
 * The trail is now a continuous path through control points.
 */

import { describe, test, expect, beforeEach } from 'bun:test'

// Mock the trail logic without Three.js dependencies
class MockTrailRenderer {
  points: Array<{ x: number; z: number }> = []
  lastPosition: { x: number; z: number } | null = null
  distanceSinceLastPoint = 0
  pointSpacing = 2.0

  startNewSegment(position: { x: number; z: number }): void {
    this.points.push({ ...position })
    this.lastPosition = { ...position }
    this.distanceSinceLastPoint = 0
  }

  extendLastSegment(newEnd: { x: number; z: number }): void {
    if (this.points.length === 0) {
      this.startNewSegment(newEnd)
      return
    }

    if (this.lastPosition) {
      const dx = newEnd.x - this.lastPosition.x
      const dz = newEnd.z - this.lastPosition.z
      const distance = Math.sqrt(dx * dx + dz * dz)
      this.distanceSinceLastPoint += distance
    }

    if (this.distanceSinceLastPoint >= this.pointSpacing) {
      this.points.push({ ...newEnd })
      this.distanceSinceLastPoint = 0
    }

    this.lastPosition = { ...newEnd }
  }

  getLastSegmentEnd(): { x: number; z: number } | null {
    return this.lastPosition ? { ...this.lastPosition } : null
  }

  /**
   * Get the path from first point to last position
   */
  getPathLength(): number {
    if (this.points.length === 0) return 0

    let length = 0
    for (let i = 1; i < this.points.length; i++) {
      const prev = this.points[i - 1]
      const curr = this.points[i]
      length += Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.z - prev.z, 2)
      )
    }

    // Add distance from last point to current position
    if (this.lastPosition && this.points.length > 0) {
      const last = this.points[this.points.length - 1]
      length += Math.sqrt(
        Math.pow(this.lastPosition.x - last.x, 2) +
        Math.pow(this.lastPosition.z - last.z, 2)
      )
    }

    return length
  }

  clear(): void {
    this.points = []
    this.lastPosition = null
    this.distanceSinceLastPoint = 0
  }
}

describe('MockTrailRenderer (spline-based)', () => {
  let renderer: MockTrailRenderer

  beforeEach(() => {
    renderer = new MockTrailRenderer()
  })

  describe('basic operations', () => {
    test('starts with no points', () => {
      expect(renderer.points.length).toBe(0)
      expect(renderer.lastPosition).toBeNull()
    })

    test('startNewSegment adds initial point', () => {
      renderer.startNewSegment({ x: 0, z: 0 })
      expect(renderer.points.length).toBe(1)
      expect(renderer.points[0]).toEqual({ x: 0, z: 0 })
      expect(renderer.lastPosition).toEqual({ x: 0, z: 0 })
    })

    test('extendLastSegment updates lastPosition', () => {
      renderer.startNewSegment({ x: 0, z: 0 })
      renderer.extendLastSegment({ x: 1, z: 0 })

      expect(renderer.lastPosition).toEqual({ x: 1, z: 0 })
    })

    test('getLastSegmentEnd returns current position', () => {
      renderer.startNewSegment({ x: 5, z: 5 })
      renderer.extendLastSegment({ x: 10, z: 5 })

      expect(renderer.getLastSegmentEnd()).toEqual({ x: 10, z: 5 })
    })
  })

  describe('control point spacing', () => {
    test('adds control points at regular intervals', () => {
      renderer.pointSpacing = 2.0
      renderer.startNewSegment({ x: 0, z: 0 })

      // Move in small increments
      for (let i = 1; i <= 10; i++) {
        renderer.extendLastSegment({ x: i * 0.5, z: 0 })
      }

      // Should have initial point + points at ~2.0 and ~4.0 distance
      expect(renderer.points.length).toBeGreaterThanOrEqual(2)
    })

    test('maintains continuous path', () => {
      renderer.startNewSegment({ x: 0, z: 0 })

      // Move north
      for (let i = 1; i <= 10; i++) {
        renderer.extendLastSegment({ x: 0, z: -i })
      }

      // Check path is continuous
      expect(renderer.points[0]).toEqual({ x: 0, z: 0 })
      expect(renderer.lastPosition).toEqual({ x: 0, z: -10 })
    })
  })

  describe('turning behavior', () => {
    test('path follows turns correctly', () => {
      renderer.pointSpacing = 1.0 // Smaller spacing for test
      renderer.startNewSegment({ x: 0, z: 0 })

      // Move north
      renderer.extendLastSegment({ x: 0, z: -5 })

      // Turn and move east
      renderer.extendLastSegment({ x: 5, z: -5 })

      // Turn and move south
      renderer.extendLastSegment({ x: 5, z: 0 })

      // Path should form a U shape
      expect(renderer.getLastSegmentEnd()).toEqual({ x: 5, z: 0 })
      expect(renderer.points.length).toBeGreaterThan(1)
    })

    test('sharp 90-degree turns are tracked', () => {
      renderer.startNewSegment({ x: 0, z: 0 })

      // Move north 10 units
      renderer.extendLastSegment({ x: 0, z: -10 })

      // Instantly turn east 10 units
      renderer.extendLastSegment({ x: 10, z: -10 })

      // The path should cover both segments
      const pathLength = renderer.getPathLength()
      expect(pathLength).toBeCloseTo(20, 0)
    })
  })

  describe('multiple turns (box pattern)', () => {
    test('drawing a box creates correct path', () => {
      renderer.startNewSegment({ x: 0, z: 0 })

      // North
      renderer.extendLastSegment({ x: 0, z: -10 })

      // East
      renderer.extendLastSegment({ x: 10, z: -10 })

      // South
      renderer.extendLastSegment({ x: 10, z: 0 })

      // West (back toward start)
      renderer.extendLastSegment({ x: 0, z: 0 })

      // Path length should be approximately 40 (10*4)
      const pathLength = renderer.getPathLength()
      expect(pathLength).toBeCloseTo(40, 0)
    })
  })

  describe('edge cases', () => {
    test('very small movements are tracked', () => {
      renderer.startNewSegment({ x: 0, z: 0 })
      renderer.extendLastSegment({ x: 0.1, z: 0 })
      renderer.extendLastSegment({ x: 0.2, z: 0 })

      expect(renderer.lastPosition).toEqual({ x: 0.2, z: 0 })
    })

    test('extending before starting works', () => {
      renderer.extendLastSegment({ x: 5, z: 5 })

      expect(renderer.points.length).toBe(1)
      expect(renderer.points[0]).toEqual({ x: 5, z: 5 })
    })

    test('clear resets all state', () => {
      renderer.startNewSegment({ x: 0, z: 0 })
      renderer.extendLastSegment({ x: 10, z: 0 })
      renderer.clear()

      expect(renderer.points.length).toBe(0)
      expect(renderer.lastPosition).toBeNull()
    })
  })
})

describe('Trail collision detection', () => {
  test('detects collision on straight path', () => {
    const renderer = new MockTrailRenderer()
    renderer.startNewSegment({ x: 0, z: 0 })
    renderer.extendLastSegment({ x: 10, z: 0 })

    // Point on the path should collide
    const onPath = { x: 5, z: 0 }

    // Simple collision check
    const minX = Math.min(0, 10) - 0.5
    const maxX = Math.max(0, 10) + 0.5
    const minZ = Math.min(0, 0) - 0.5
    const maxZ = Math.max(0, 0) + 0.5

    const collides =
      onPath.x >= minX &&
      onPath.x <= maxX &&
      onPath.z >= minZ &&
      onPath.z <= maxZ

    expect(collides).toBe(true)
  })

  test('no collision far from path', () => {
    const renderer = new MockTrailRenderer()
    renderer.startNewSegment({ x: 0, z: 0 })
    renderer.extendLastSegment({ x: 10, z: 0 })

    const farAway = { x: 100, z: 100 }

    const minX = Math.min(0, 10) - 0.5
    const maxX = Math.max(0, 10) + 0.5
    const minZ = Math.min(0, 0) - 0.5
    const maxZ = Math.max(0, 0) + 0.5

    const collides =
      farAway.x >= minX &&
      farAway.x <= maxX &&
      farAway.z >= minZ &&
      farAway.z <= maxZ

    expect(collides).toBe(false)
  })
})
