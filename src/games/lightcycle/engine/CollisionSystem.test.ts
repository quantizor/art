/**
 * CollisionSystem Tests
 *
 * Tests for collision detection between cycles, trails, and walls.
 * Includes height-aware collision and trail expiry tests.
 */

import { describe, test, expect } from 'bun:test'
import { CollisionSystem } from './CollisionSystem'
import type { CycleState, TrailSegment } from '../types'

/** Helper to create a trail segment with all required fields */
function seg(
  start: { x: number; z: number },
  end: { x: number; z: number },
  direction: 'north' | 'east' | 'south' | 'west',
  opts: { startY?: number; endY?: number; timestamp?: number } = {}
): TrailSegment {
  return {
    start,
    end,
    direction,
    startY: opts.startY ?? 0,
    endY: opts.endY ?? 0,
    timestamp: opts.timestamp ?? performance.now(),
  }
}

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
      seg({ x: -10, z: 0 }, { x: 10, z: 0 }, 'east'),
    ]

    const verticalTrail: TrailSegment[] = [
      seg({ x: 0, z: -10 }, { x: 0, z: 10 }, 'south'),
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
        seg({ x: 0, z: 0 }, { x: 5, z: 0 }, 'east'),   // Old segment
        seg({ x: 5, z: 0 }, { x: 5, z: 5 }, 'south'),   // Recent
        seg({ x: 5, z: 5 }, { x: 10, z: 5 }, 'east'),   // Most recent
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

  describe('height-aware trail collision', () => {
    const groundTrail: TrailSegment[] = [
      seg({ x: -10, z: 0 }, { x: 10, z: 0 }, 'east', { startY: 0, endY: 0 }),
    ]

    test('racer on ground collides with ground trail', () => {
      expect(
        collisionSystem.checkTrailCollision({ x: 0, z: 0 }, groundTrail, false, 0)
      ).toBe(true)
    })

    test('jumping racer passes over ground trail', () => {
      // TRAIL_HEIGHT = 0.8, so trail spans y=0 to y=0.8
      // Racer at y=4 spans y=4 to y=4.8 -- no overlap
      expect(
        collisionSystem.checkTrailCollision({ x: 0, z: 0 }, groundTrail, false, 4)
      ).toBe(false)
    })

    test('slightly jumping racer still collides with ground trail', () => {
      // Racer at y=0.3 spans y=0.3 to y=1.1 -- overlaps with trail y=0 to y=0.8
      expect(
        collisionSystem.checkTrailCollision({ x: 0, z: 0 }, groundTrail, false, 0.3)
      ).toBe(true)
    })

    test('racer collides with elevated trail at same height', () => {
      const elevatedTrail: TrailSegment[] = [
        seg({ x: -10, z: 0 }, { x: 10, z: 0 }, 'east', { startY: 3, endY: 3 }),
      ]
      // Racer at y=3 spans y=3 to y=3.8 -- overlaps with trail y=3 to y=3.8
      expect(
        collisionSystem.checkTrailCollision({ x: 0, z: 0 }, elevatedTrail, false, 3)
      ).toBe(true)
    })

    test('ground racer does not collide with elevated trail', () => {
      const elevatedTrail: TrailSegment[] = [
        seg({ x: -10, z: 0 }, { x: 10, z: 0 }, 'east', { startY: 3, endY: 3 }),
      ]
      // Racer at y=0 spans y=0 to y=0.8 -- trail spans y=3 to y=3.8, no overlap
      expect(
        collisionSystem.checkTrailCollision({ x: 0, z: 0 }, elevatedTrail, false, 0)
      ).toBe(false)
    })
  })

  describe('trail expiry', () => {
    test('expired trail does not cause collision', () => {
      const expiredTrail: TrailSegment[] = [
        seg({ x: -10, z: 0 }, { x: 10, z: 0 }, 'east', {
          timestamp: performance.now() - 7000, // 7 seconds ago, past lifetime + fade
        }),
      ]
      expect(
        collisionSystem.checkTrailCollision({ x: 0, z: 0 }, expiredTrail, false, 0)
      ).toBe(false)
    })

    test('fresh trail causes collision', () => {
      const freshTrail: TrailSegment[] = [
        seg({ x: -10, z: 0 }, { x: 10, z: 0 }, 'east', {
          timestamp: performance.now(),
        }),
      ]
      expect(
        collisionSystem.checkTrailCollision({ x: 0, z: 0 }, freshTrail, false, 0)
      ).toBe(true)
    })
  })

  describe('live segment collision (no turns yet)', () => {
    test('detects collision with trail that has no turn segments', () => {
      // Simulates a cycle that has been driving straight with no turns.
      // The "live segment" from spawn to current position is the only trail data.
      const liveTrail: TrailSegment[] = [
        seg({ x: 0, z: 54 }, { x: 0, z: 20 }, 'north'),
      ]
      const cycles = [createCycle('ai-1', { x: 0, z: 20 }, liveTrail)]

      // Another cycle crossing this trail at z=30
      const result = collisionSystem.checkCollision({ x: 0, z: 30 }, 'player', cycles)
      expect(result.collided).toBe(true)
      expect(result.type).toBe('trail')
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
        seg({ x: -5, z: 5 }, { x: 5, z: 5 }, 'east'),
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

    test('jumping racer passes over ground trail', () => {
      const trail: TrailSegment[] = [
        seg({ x: -5, z: 5 }, { x: 5, z: 5 }, 'east'),
      ]
      const cycles = [createCycle('ai-1', { x: 10, z: 5 }, trail)]

      // Pass yOffset=4 (jumping over trail)
      const result = collisionSystem.checkCollision({ x: 0, z: 5 }, 'player', cycles, 4)

      expect(result.collided).toBe(false)
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
        seg({ x: 10, z: -5 }, { x: 10, z: 5 }, 'south'),
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
      // Trail at x=10 with TRAIL_WIDTH=0.4 + CYCLE_RADIUS=0.4 means detection ~9.4-9.6 units out
      expect(result.distance).toBeLessThan(11)
      expect(result.distance).toBeGreaterThan(8)
    })

    test('ignores expired trails in raycast', () => {
      const expiredTrail: TrailSegment[] = [
        seg({ x: 10, z: -5 }, { x: 10, z: 5 }, 'south', {
          timestamp: performance.now() - 7000,
        }),
      ]
      const cycles = [
        createCycle('player', { x: 0, z: 0 }),
        createCycle('ai-1', { x: 15, z: 0 }, expiredTrail),
      ]

      const result = collisionSystem.raycast(
        { x: 0, z: 0 },
        { x: 1, z: 0 }, // East toward expired trail
        20,
        cycles,
        'player'
      )

      // Should not detect the expired trail -- only wall far away
      expect(result.type).not.toBe('trail')
    })
  })
})
