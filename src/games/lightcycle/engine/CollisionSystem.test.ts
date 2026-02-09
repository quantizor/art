/**
 * CollisionSystem Tests
 *
 * Tests for collision detection between cycles, trails, and walls.
 */

import { describe, test, expect } from 'bun:test'
import { CollisionSystem } from './CollisionSystem'
import type { CycleState, TrailSegment } from '../types'

describe('CollisionSystem', () => {
  const collisionSystem = new CollisionSystem()

  // Helper to create a minimal cycle state
  function createCycle(
    id: string,
    position: { x: number; z: number },
    trail: TrailSegment[] = []
  ): CycleState {
    return {
      id,
      gridPosition: position,
      direction: 'north',
      angle: 0,
      targetAngle: -1,
      isTurning: false,
      color: 0x00ffff,
      isAlive: true,
      trail,
      isPlayer: id === 'player',
      speed: 1,
      trailActive: true,
      isJumping: false,
      jumpStartTime: 0,
      lastJumpTime: 0,
    }
  }

  describe('checkWallCollision', () => {
    test('returns false for position in center', () => {
      expect(collisionSystem.checkWallCollision({ x: 0, z: 0 })).toBe(false)
    })

    test('returns false for position well within bounds', () => {
      expect(collisionSystem.checkWallCollision({ x: 50, z: 50 })).toBe(false)
    })

    test('returns true for position at east wall', () => {
      // ARENA_HALF = 64, CYCLE_RADIUS = 0.4
      expect(collisionSystem.checkWallCollision({ x: 63.7, z: 0 })).toBe(true)
    })

    test('returns true for position at west wall', () => {
      expect(collisionSystem.checkWallCollision({ x: -63.7, z: 0 })).toBe(true)
    })

    test('returns true for position at north wall', () => {
      expect(collisionSystem.checkWallCollision({ x: 0, z: -63.7 })).toBe(true)
    })

    test('returns true for position at south wall', () => {
      expect(collisionSystem.checkWallCollision({ x: 0, z: 63.7 })).toBe(true)
    })
  })

  describe('checkCycleCollision', () => {
    test('returns false for cycles far apart', () => {
      expect(
        collisionSystem.checkCycleCollision({ x: 0, z: 0 }, { x: 10, z: 10 })
      ).toBe(false)
    })

    test('returns true for cycles at same position', () => {
      expect(
        collisionSystem.checkCycleCollision({ x: 5, z: 5 }, { x: 5, z: 5 })
      ).toBe(true)
    })

    test('returns true for cycles within collision radius', () => {
      // CYCLE_RADIUS = 0.4, so 2*0.4 = 0.8 is min distance
      expect(
        collisionSystem.checkCycleCollision({ x: 0, z: 0 }, { x: 0.5, z: 0 })
      ).toBe(true)
    })

    test('returns false for cycles just outside collision radius', () => {
      expect(
        collisionSystem.checkCycleCollision({ x: 0, z: 0 }, { x: 1, z: 0 })
      ).toBe(false)
    })
  })

  describe('checkTrailCollision', () => {
    const horizontalTrail: TrailSegment[] = [
      { start: { x: -10, z: 0 }, end: { x: 10, z: 0 }, direction: 'east' },
    ]

    const verticalTrail: TrailSegment[] = [
      { start: { x: 0, z: -10 }, end: { x: 0, z: 10 }, direction: 'south' },
    ]

    test('returns true when point is on horizontal trail', () => {
      expect(
        collisionSystem.checkTrailCollision({ x: 0, z: 0 }, horizontalTrail, false)
      ).toBe(true)
    })

    test('returns true when point is on vertical trail', () => {
      expect(
        collisionSystem.checkTrailCollision({ x: 0, z: 5 }, verticalTrail, false)
      ).toBe(true)
    })

    test('returns false when point is far from trail', () => {
      expect(
        collisionSystem.checkTrailCollision({ x: 20, z: 20 }, horizontalTrail, false)
      ).toBe(false)
    })

    test('skips recent segments for self-collision', () => {
      // When checking self-collision, the last 2 segments are skipped
      const recentTrail: TrailSegment[] = [
        { start: { x: 0, z: 0 }, end: { x: 5, z: 0 }, direction: 'east' }, // Old segment
        { start: { x: 5, z: 0 }, end: { x: 5, z: 5 }, direction: 'south' }, // Recent
        { start: { x: 5, z: 5 }, end: { x: 10, z: 5 }, direction: 'east' }, // Most recent
      ]

      // Point on the old segment should collide
      expect(
        collisionSystem.checkTrailCollision({ x: 2, z: 0 }, recentTrail, true)
      ).toBe(true)

      // Point on recent segments should NOT collide (for self)
      expect(
        collisionSystem.checkTrailCollision({ x: 5, z: 2 }, recentTrail, true)
      ).toBe(false)
    })
  })

  describe('checkCollision', () => {
    test('detects wall collision', () => {
      const cycles = [createCycle('player', { x: 0, z: 0 })]
      const result = collisionSystem.checkCollision({ x: 64, z: 0 }, 'player', cycles)

      expect(result.collided).toBe(true)
      expect(result.type).toBe('wall')
    })

    test('detects cycle-to-cycle collision', () => {
      const cycles = [
        createCycle('player', { x: 0, z: 0 }),
        createCycle('ai-1', { x: 0.5, z: 0 }), // Very close
      ]
      const result = collisionSystem.checkCollision({ x: 0.5, z: 0 }, 'player', cycles)

      expect(result.collided).toBe(true)
      expect(result.type).toBe('cycle')
      expect(result.cycleId).toBe('ai-1')
    })

    test('detects trail collision', () => {
      const trail: TrailSegment[] = [
        { start: { x: -5, z: 5 }, end: { x: 5, z: 5 }, direction: 'east' },
      ]
      const cycles = [createCycle('ai-1', { x: 10, z: 5 }, trail)]

      const result = collisionSystem.checkCollision({ x: 0, z: 5 }, 'player', cycles)

      expect(result.collided).toBe(true)
      expect(result.type).toBe('trail')
      expect(result.cycleId).toBe('ai-1')
    })

    test('returns no collision for safe position', () => {
      const cycles = [
        createCycle('player', { x: 0, z: 0 }),
        createCycle('ai-1', { x: 20, z: 20 }),
      ]
      const result = collisionSystem.checkCollision({ x: 0, z: 0 }, 'player', cycles)

      expect(result.collided).toBe(false)
      expect(result.type).toBeNull()
    })
  })

  describe('raycast', () => {
    test('detects wall in direction of travel', () => {
      const cycles = [createCycle('player', { x: 60, z: 0 })]
      const result = collisionSystem.raycast(
        { x: 60, z: 0 },
        { x: 1, z: 0 }, // East
        20,
        cycles,
        'player'
      )

      expect(result.type).toBe('wall')
      expect(result.distance).toBeLessThan(5) // Should hit wall soon
    })

    test('returns max distance when no obstacle within range', () => {
      const cycles = [createCycle('player', { x: 0, z: 0 })]
      const result = collisionSystem.raycast(
        { x: 0, z: 0 },
        { x: 1, z: 0 }, // East
        10, // Short distance, wall is ~64 units away
        cycles,
        'player'
      )

      // Wall is far away (~64 units), so within 10 units there's no hit
      // But raycast still returns wall type since it calculates wall distance
      expect(result.distance).toBe(10) // Clamped to max distance
    })

    test('detects trail in direction of travel', () => {
      const trail: TrailSegment[] = [
        { start: { x: 10, z: -5 }, end: { x: 10, z: 5 }, direction: 'south' },
      ]
      const cycles = [
        createCycle('player', { x: 0, z: 0 }),
        createCycle('ai-1', { x: 15, z: 0 }, trail),
      ]

      const result = collisionSystem.raycast(
        { x: 0, z: 0 },
        { x: 1, z: 0 }, // East toward trail
        20,
        cycles,
        'player'
      )

      expect(result.type).toBe('trail')
      expect(result.distance).toBeCloseTo(10, 0)
    })
  })
})
