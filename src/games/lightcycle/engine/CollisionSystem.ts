/**
 * Collision System
 *
 * Detects collisions between cycles, trails, and arena walls.
 */

import { ARENA_HALF, TRAIL_WIDTH } from '../constants'
import type { CollisionResult, CycleState, GridPosition, TrailSegment } from '../types'

/** Collision detection radius around cycle center */
const CYCLE_RADIUS = 0.4

export class CollisionSystem {
  /**
   * Check if a position collides with anything
   */
  checkCollision(
    position: GridPosition,
    cycleId: string,
    allCycles: CycleState[]
  ): CollisionResult {
    // Check wall collision first (cheapest)
    if (this.checkWallCollision(position)) {
      return { collided: true, type: 'wall', cycleId: null }
    }

    // Check trail collisions
    for (const cycle of allCycles) {
      if (!cycle.isAlive) continue

      const trailResult = this.checkTrailCollision(
        position,
        cycle.trail,
        cycleId === cycle.id
      )

      if (trailResult) {
        return { collided: true, type: 'trail', cycleId: cycle.id }
      }
    }

    // Check cycle-to-cycle collision
    for (const cycle of allCycles) {
      if (cycle.id === cycleId || !cycle.isAlive) continue

      if (this.checkCycleCollision(position, cycle.gridPosition)) {
        return { collided: true, type: 'cycle', cycleId: cycle.id }
      }
    }

    return { collided: false, type: null, cycleId: null }
  }

  /**
   * Check collision with arena walls
   */
  checkWallCollision(position: GridPosition): boolean {
    const margin = CYCLE_RADIUS
    const limit = ARENA_HALF - margin

    return (
      position.x < -limit ||
      position.x > limit ||
      position.z < -limit ||
      position.z > limit
    )
  }

  /**
   * Check collision with trail segments
   */
  checkTrailCollision(
    position: GridPosition,
    trail: TrailSegment[],
    isSelf: boolean
  ): boolean {
    // For self-collision, skip the last few segments (can't hit your own recent trail)
    const segmentsToCheck = isSelf
      ? trail.slice(0, Math.max(0, trail.length - 2))
      : trail

    for (const segment of segmentsToCheck) {
      if (this.pointIntersectsSegment(position, segment)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if a point intersects a trail segment
   */
  private pointIntersectsSegment(
    point: GridPosition,
    segment: TrailSegment
  ): boolean {
    const { start, end } = segment
    const halfWidth = TRAIL_WIDTH / 2 + CYCLE_RADIUS

    // Calculate segment bounds
    const minX = Math.min(start.x, end.x) - halfWidth
    const maxX = Math.max(start.x, end.x) + halfWidth
    const minZ = Math.min(start.z, end.z) - halfWidth
    const maxZ = Math.max(start.z, end.z) + halfWidth

    return (
      point.x >= minX &&
      point.x <= maxX &&
      point.z >= minZ &&
      point.z <= maxZ
    )
  }

  /**
   * Check collision between two cycle positions
   */
  checkCycleCollision(a: GridPosition, b: GridPosition): boolean {
    const dx = a.x - b.x
    const dz = a.z - b.z
    const distanceSquared = dx * dx + dz * dz
    const minDistance = CYCLE_RADIUS * 2

    return distanceSquared < minDistance * minDistance
  }

  /**
   * Ray cast from position in direction to find first collision
   * Returns distance to collision, or Infinity if no collision
   */
  raycast(
    position: GridPosition,
    direction: { x: number; z: number },
    maxDistance: number,
    allCycles: CycleState[],
    selfId: string
  ): { distance: number; type: 'wall' | 'trail' | 'cycle' | null } {
    const step = 0.5
    let minHitDistance = Infinity
    let hitType: 'wall' | 'trail' | 'cycle' | null = null

    // Check wall intersection
    const wallDist = this.raycastWall(position, direction)
    if (wallDist < minHitDistance) {
      minHitDistance = wallDist
      hitType = 'wall'
    }

    // Step through ray checking for trail/cycle hits
    for (let d = step; d <= maxDistance && d < minHitDistance; d += step) {
      const testPos = {
        x: position.x + direction.x * d,
        z: position.z + direction.z * d,
      }

      // Check trails
      for (const cycle of allCycles) {
        if (!cycle.isAlive) continue

        // Skip own recent trail
        const trail =
          cycle.id === selfId
            ? cycle.trail.slice(0, Math.max(0, cycle.trail.length - 3))
            : cycle.trail

        for (const segment of trail) {
          if (this.pointIntersectsSegment(testPos, segment)) {
            if (d < minHitDistance) {
              minHitDistance = d
              hitType = 'trail'
            }
          }
        }

        // Check cycle positions
        if (cycle.id !== selfId) {
          const dx = testPos.x - cycle.gridPosition.x
          const dz = testPos.z - cycle.gridPosition.z
          if (dx * dx + dz * dz < CYCLE_RADIUS * CYCLE_RADIUS * 4) {
            if (d < minHitDistance) {
              minHitDistance = d
              hitType = 'cycle'
            }
          }
        }
      }
    }

    return {
      distance: Math.min(minHitDistance, maxDistance),
      type: hitType,
    }
  }

  /**
   * Calculate distance to wall in a direction
   */
  private raycastWall(
    position: GridPosition,
    direction: { x: number; z: number }
  ): number {
    const margin = CYCLE_RADIUS
    let minDist = Infinity

    // Check each wall
    if (direction.x > 0) {
      minDist = Math.min(minDist, (ARENA_HALF - margin - position.x) / direction.x)
    } else if (direction.x < 0) {
      minDist = Math.min(minDist, (-ARENA_HALF + margin - position.x) / direction.x)
    }

    if (direction.z > 0) {
      minDist = Math.min(minDist, (ARENA_HALF - margin - position.z) / direction.z)
    } else if (direction.z < 0) {
      minDist = Math.min(minDist, (-ARENA_HALF + margin - position.z) / direction.z)
    }

    return minDist
  }
}
