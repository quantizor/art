/**
 * TrailRenderer Tests
 *
 * Tests for the ribbon-based trail system with Y-awareness and time-based fading.
 */

import { describe, test, expect, beforeEach } from 'bun:test'

// Mock the trail logic without Three.js dependencies
class MockTrailRenderer {
  points: Array<{ x: number; y: number; z: number; timestamp: number }> = []
  lastPosition: { x: number; y: number; z: number } | null = null
  distanceSinceLastPoint = 0
  pointSpacing = 2.0

  startNewSegment(position: { x: number; y: number; z: number }): void {
    this.points.push({ ...position, timestamp: performance.now() })
    this.lastPosition = { ...position }
    this.distanceSinceLastPoint = 0
  }

  extendLastSegment(newEnd: { x: number; y: number; z: number }): void {
    if (this.points.length === 0) {
      this.startNewSegment(newEnd)
      return
    }

    if (this.lastPosition) {
      const dx = newEnd.x - this.lastPosition.x
      const dy = newEnd.y - this.lastPosition.y
      const dz = newEnd.z - this.lastPosition.z
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
      this.distanceSinceLastPoint += distance
    }

    if (this.distanceSinceLastPoint >= this.pointSpacing) {
      this.points.push({ ...newEnd, timestamp: performance.now() })
      this.distanceSinceLastPoint = 0
    }

    this.lastPosition = { ...newEnd }
  }

  getLastSegmentEnd(): { x: number; y: number; z: number } | null {
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
        Math.pow(curr.x - prev.x, 2) +
        Math.pow(curr.y - prev.y, 2) +
        Math.pow(curr.z - prev.z, 2)
      )
    }

    // Add distance from last point to current position
    if (this.lastPosition && this.points.length > 0) {
      const last = this.points[this.points.length - 1]
      length += Math.sqrt(
        Math.pow(this.lastPosition.x - last.x, 2) +
        Math.pow(this.lastPosition.y - last.y, 2) +
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

describe('MockTrailRenderer (ribbon-based)', () => {
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
      renderer.startNewSegment({ x: 0, y: 0, z: 0 })
      expect(renderer.points.length).toBe(1)
      expect(renderer.points[0].x).toBe(0)
      expect(renderer.points[0].y).toBe(0)
      expect(renderer.points[0].z).toBe(0)
      expect(renderer.lastPosition).toEqual({ x: 0, y: 0, z: 0 })
    })

    test('extendLastSegment updates lastPosition', () => {
      renderer.startNewSegment({ x: 0, y: 0, z: 0 })
      renderer.extendLastSegment({ x: 1, y: 0, z: 0 })

      expect(renderer.lastPosition).toEqual({ x: 1, y: 0, z: 0 })
    })

    test('getLastSegmentEnd returns current position', () => {
      renderer.startNewSegment({ x: 5, y: 0, z: 5 })
      renderer.extendLastSegment({ x: 10, y: 0, z: 5 })

      expect(renderer.getLastSegmentEnd()).toEqual({ x: 10, y: 0, z: 5 })
    })
  })

  describe('control point spacing', () => {
    test('adds control points at regular intervals', () => {
      renderer.pointSpacing = 2.0
      renderer.startNewSegment({ x: 0, y: 0, z: 0 })

      // Move in small increments
      for (let i = 1; i <= 10; i++) {
        renderer.extendLastSegment({ x: i * 0.5, y: 0, z: 0 })
      }

      // Should have initial point + points at ~2.0 and ~4.0 distance
      expect(renderer.points.length).toBeGreaterThanOrEqual(2)
    })

    test('maintains continuous path', () => {
      renderer.startNewSegment({ x: 0, y: 0, z: 0 })

      // Move north
      for (let i = 1; i <= 10; i++) {
        renderer.extendLastSegment({ x: 0, y: 0, z: -i })
      }

      // Check path is continuous
      expect(renderer.points[0].x).toBe(0)
      expect(renderer.points[0].z).toBe(0)
      expect(renderer.lastPosition).toEqual({ x: 0, y: 0, z: -10 })
    })
  })

  describe('turning behavior', () => {
    test('path follows turns correctly', () => {
      renderer.pointSpacing = 1.0 // Smaller spacing for test
      renderer.startNewSegment({ x: 0, y: 0, z: 0 })

      // Move north
      renderer.extendLastSegment({ x: 0, y: 0, z: -5 })

      // Turn and move east
      renderer.extendLastSegment({ x: 5, y: 0, z: -5 })

      // Turn and move south
      renderer.extendLastSegment({ x: 5, y: 0, z: 0 })

      // Path should form a U shape
      expect(renderer.getLastSegmentEnd()).toEqual({ x: 5, y: 0, z: 0 })
      expect(renderer.points.length).toBeGreaterThan(1)
    })

    test('sharp 90-degree turns are tracked', () => {
      renderer.startNewSegment({ x: 0, y: 0, z: 0 })

      // Move north 10 units
      renderer.extendLastSegment({ x: 0, y: 0, z: -10 })

      // Instantly turn east 10 units
      renderer.extendLastSegment({ x: 10, y: 0, z: -10 })

      // The path should cover both segments
      const pathLength = renderer.getPathLength()
      expect(pathLength).toBeCloseTo(20, 0)
    })
  })

  describe('Y-aware trail (jump following)', () => {
    test('trail preserves Y positions', () => {
      renderer.startNewSegment({ x: 0, y: 0, z: 0 })
      renderer.extendLastSegment({ x: 0, y: 2.0, z: -3 })
      renderer.extendLastSegment({ x: 0, y: 4.0, z: -6 }) // Peak of jump
      renderer.extendLastSegment({ x: 0, y: 2.0, z: -9 })
      renderer.extendLastSegment({ x: 0, y: 0, z: -12 }) // Landed

      expect(renderer.points[0].y).toBe(0)
      expect(renderer.lastPosition!.y).toBe(0)
    })

    test('Y changes contribute to distance calculation', () => {
      renderer.pointSpacing = 2.0
      renderer.startNewSegment({ x: 0, y: 0, z: 0 })

      // Move up 3 units (should trigger a control point since distance > 2)
      renderer.extendLastSegment({ x: 0, y: 3, z: 0 })

      expect(renderer.points.length).toBe(2) // Initial + new point
    })
  })

  describe('timestamps', () => {
    test('points have timestamps', () => {
      const before = performance.now()
      renderer.startNewSegment({ x: 0, y: 0, z: 0 })
      const after = performance.now()

      expect(renderer.points[0].timestamp).toBeGreaterThanOrEqual(before)
      expect(renderer.points[0].timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('multiple turns (box pattern)', () => {
    test('drawing a box creates correct path', () => {
      renderer.startNewSegment({ x: 0, y: 0, z: 0 })

      // North
      renderer.extendLastSegment({ x: 0, y: 0, z: -10 })

      // East
      renderer.extendLastSegment({ x: 10, y: 0, z: -10 })

      // South
      renderer.extendLastSegment({ x: 10, y: 0, z: 0 })

      // West (back toward start)
      renderer.extendLastSegment({ x: 0, y: 0, z: 0 })

      // Path length should be approximately 40 (10*4)
      const pathLength = renderer.getPathLength()
      expect(pathLength).toBeCloseTo(40, 0)
    })
  })

  describe('edge cases', () => {
    test('very small movements are tracked', () => {
      renderer.startNewSegment({ x: 0, y: 0, z: 0 })
      renderer.extendLastSegment({ x: 0.1, y: 0, z: 0 })
      renderer.extendLastSegment({ x: 0.2, y: 0, z: 0 })

      expect(renderer.lastPosition).toEqual({ x: 0.2, y: 0, z: 0 })
    })

    test('extending before starting works', () => {
      renderer.extendLastSegment({ x: 5, y: 0, z: 5 })

      expect(renderer.points.length).toBe(1)
      expect(renderer.points[0].x).toBe(5)
      expect(renderer.points[0].z).toBe(5)
    })

    test('clear resets all state', () => {
      renderer.startNewSegment({ x: 0, y: 0, z: 0 })
      renderer.extendLastSegment({ x: 10, y: 0, z: 0 })
      renderer.clear()

      expect(renderer.points.length).toBe(0)
      expect(renderer.lastPosition).toBeNull()
    })
  })
})

describe('Trail collision detection', () => {
  test('detects collision on straight path', () => {
    const onPath = { x: 5, z: 0 }

    // Simple AABB collision check
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
