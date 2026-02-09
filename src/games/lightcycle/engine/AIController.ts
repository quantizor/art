/**
 * AI Controller
 *
 * Smart AI with self-trail awareness, space evaluation,
 * and strategic decision making. Avoids boxing itself in.
 */

import {
  AI_CONFIG,
  DIRECTION_VECTORS,
  TURN_LEFT,
  TURN_RIGHT,
  ARENA_HALF,
} from '../constants'
import type { CycleState, GridDirection } from '../types'
import { CollisionSystem } from './CollisionSystem'

interface AIDecision {
  turn: 'left' | 'right' | 'none'
  urgency: number
  jump: boolean
}

interface DirectionScore {
  direction: GridDirection
  turn: 'left' | 'right' | 'none'
  forwardDistance: number
  escapePaths: number
  selfTrailDanger: number
  totalScore: number
}

export class AIController {
  private collisionSystem: CollisionSystem
  private lastDecisionTime: Map<string, number> = new Map()

  constructor(collisionSystem: CollisionSystem) {
    this.collisionSystem = collisionSystem
  }

  /**
   * Get AI decision for a cycle
   */
  getDecision(
    cycle: CycleState,
    allCycles: CycleState[],
    currentTime: number
  ): AIDecision {
    // Rate limit decisions
    const lastDecision = this.lastDecisionTime.get(cycle.id) || 0
    if (currentTime - lastDecision < AI_CONFIG.decisionInterval) {
      return { turn: 'none', urgency: 0, jump: false }
    }

    // Evaluate all three options
    const scores = this.evaluateAllDirections(cycle, allCycles)

    // Sort by total score
    scores.sort((a, b) => b.totalScore - a.totalScore)
    const bestOption = scores[0]
    const forwardOption = scores.find(s => s.turn === 'none')!

    // Check if we should jump
    const shouldJump = this.shouldJump(cycle, allCycles, forwardOption.forwardDistance)

    // CRITICAL: If forward is dangerous, we MUST turn
    if (forwardOption.forwardDistance < AI_CONFIG.minTurnDistance) {
      this.lastDecisionTime.set(cycle.id, currentTime)

      // Try jumping first if possible
      if (shouldJump && !cycle.isJumping) {
        return { turn: 'none', urgency: 1, jump: true }
      }

      // Must turn - pick the best option that's not forward
      const turnOptions = scores.filter(s => s.turn !== 'none')
      if (turnOptions.length > 0) {
        return { turn: turnOptions[0].turn, urgency: 1, jump: false }
      }

      // Desperate - pick anything
      return { turn: Math.random() < 0.5 ? 'left' : 'right', urgency: 1, jump: false }
    }

    // If best option is significantly better than forward, take it
    const scoreDiff = bestOption.totalScore - forwardOption.totalScore
    if (bestOption.turn !== 'none' && scoreDiff > 8) {
      this.lastDecisionTime.set(cycle.id, currentTime)
      return { turn: bestOption.turn, urgency: 0.7, jump: false }
    }

    // If forward has low escape paths (boxing in), turn early
    if (forwardOption.escapePaths < 2 && forwardOption.forwardDistance < 20) {
      const betterOption = scores.find(s => s.turn !== 'none' && s.escapePaths > forwardOption.escapePaths)
      if (betterOption) {
        this.lastDecisionTime.set(cycle.id, currentTime)
        return { turn: betterOption.turn, urgency: 0.6, jump: false }
      }
    }

    // If forward is getting short, consider turning
    if (forwardOption.forwardDistance < AI_CONFIG.lookAheadDistance * 0.5) {
      if (bestOption.turn !== 'none' && scoreDiff > 3) {
        this.lastDecisionTime.set(cycle.id, currentTime)
        return { turn: bestOption.turn, urgency: 0.5, jump: false }
      }
    }

    // Strategic jump occasionally
    if (shouldJump && !cycle.isJumping && Math.random() < 0.2) {
      this.lastDecisionTime.set(cycle.id, currentTime)
      return { turn: 'none', urgency: 0.3, jump: true }
    }

    return { turn: 'none', urgency: 0, jump: false }
  }

  /**
   * Evaluate all three direction options
   */
  private evaluateAllDirections(cycle: CycleState, allCycles: CycleState[]): DirectionScore[] {
    const directions: Array<{ dir: GridDirection; turn: 'left' | 'right' | 'none' }> = [
      { dir: cycle.direction, turn: 'none' },
      { dir: TURN_LEFT[cycle.direction], turn: 'left' },
      { dir: TURN_RIGHT[cycle.direction], turn: 'right' },
    ]

    return directions.map(({ dir, turn }) => {
      const vector = DIRECTION_VECTORS[dir]

      // 1. How far can we go in this direction?
      const forwardHit = this.collisionSystem.raycast(
        cycle.gridPosition,
        vector,
        AI_CONFIG.lookAheadDistance * 2,
        allCycles,
        cycle.id
      )

      // 2. If we go this way, how many escape paths will we have?
      const escapePaths = this.countEscapePaths(cycle, dir, allCycles)

      // 3. How close is our own trail in this direction? (danger of boxing in)
      const selfTrailDanger = this.evaluateSelfTrailDanger(cycle, dir, allCycles)

      // Calculate total score
      const totalScore =
        forwardHit.distance * 2.0 +           // Distance is important
        escapePaths * 8.0 +                    // Escape paths are VERY important
        selfTrailDanger * 1.0                  // Self-trail danger penalty

      return {
        direction: dir,
        turn,
        forwardDistance: forwardHit.distance,
        escapePaths,
        selfTrailDanger,
        totalScore,
      }
    })
  }

  /**
   * Count how many escape directions are available if we go this way
   * This is KEY to avoiding boxing ourselves in
   */
  private countEscapePaths(
    cycle: CycleState,
    primaryDir: GridDirection,
    allCycles: CycleState[]
  ): number {
    const vector = DIRECTION_VECTORS[primaryDir]

    // Project forward a bit (where we'd be after moving in this direction)
    const futurePos = {
      x: cycle.gridPosition.x + vector.x * 8,
      z: cycle.gridPosition.z + vector.z * 8,
    }

    // From that future position, check all 4 directions
    const allDirs: GridDirection[] = ['north', 'east', 'south', 'west']
    let openPaths = 0

    for (const dir of allDirs) {
      const checkVector = DIRECTION_VECTORS[dir]
      const hit = this.collisionSystem.raycast(
        futurePos,
        checkVector,
        15, // Check 15 units in each direction
        allCycles,
        cycle.id
      )

      // Count as open if we can go at least 8 units
      if (hit.distance >= 8) {
        openPaths++
      }
    }

    return openPaths
  }

  /**
   * Check if going this direction leads toward our own trail
   * Returns negative score (penalty) if dangerous
   */
  private evaluateSelfTrailDanger(
    cycle: CycleState,
    direction: GridDirection,
    allCycles: CycleState[]
  ): number {
    if (cycle.trail.length < 3) return 0 // Not enough trail to box ourselves

    const vector = DIRECTION_VECTORS[direction]
    let danger = 0

    // Check multiple distances ahead
    const checkDistances = [5, 10, 15, 20]

    for (const dist of checkDistances) {
      const checkPos = {
        x: cycle.gridPosition.x + vector.x * dist,
        z: cycle.gridPosition.z + vector.z * dist,
      }

      // Check if this position is near any of our OWN trail segments
      // (not the most recent ones)
      const oldTrail = cycle.trail.slice(0, Math.max(0, cycle.trail.length - 4))

      for (const segment of oldTrail) {
        const distToSegment = this.distanceToSegment(checkPos, segment)
        if (distToSegment < 3) {
          // We'd be close to our own trail - this is dangerous!
          danger -= (10 - distToSegment * 2)
        }
      }
    }

    // Also check perpendicular directions for our own trail
    const leftDir = TURN_LEFT[direction]
    const rightDir = TURN_RIGHT[direction]

    for (const sideDir of [leftDir, rightDir]) {
      const sideVector = DIRECTION_VECTORS[sideDir]
      const sideHit = this.collisionSystem.raycast(
        cycle.gridPosition,
        sideVector,
        10,
        allCycles,
        cycle.id
      )

      // If our own trail is close on the side, penalty
      if (sideHit.distance < 5 && sideHit.type === 'trail') {
        danger -= 5
      }
    }

    return danger
  }

  /**
   * Calculate minimum distance from a point to a trail segment
   */
  private distanceToSegment(
    point: { x: number; z: number },
    segment: { start: { x: number; z: number }; end: { x: number; z: number } }
  ): number {
    const { start, end } = segment

    // Vector from start to end
    const dx = end.x - start.x
    const dz = end.z - start.z
    const lenSq = dx * dx + dz * dz

    if (lenSq === 0) {
      // Segment is a point
      return Math.sqrt((point.x - start.x) ** 2 + (point.z - start.z) ** 2)
    }

    // Project point onto segment line
    const t = Math.max(0, Math.min(1,
      ((point.x - start.x) * dx + (point.z - start.z) * dz) / lenSq
    ))

    // Closest point on segment
    const closestX = start.x + t * dx
    const closestZ = start.z + t * dz

    return Math.sqrt((point.x - closestX) ** 2 + (point.z - closestZ) ** 2)
  }

  /**
   * Determine if jumping would help
   */
  private shouldJump(
    cycle: CycleState,
    allCycles: CycleState[],
    forwardDistance: number
  ): boolean {
    if (cycle.isJumping) return false
    if (performance.now() - cycle.lastJumpTime < 2000) return false

    const forwardVector = DIRECTION_VECTORS[cycle.direction]

    // Check what's ahead at jump distance
    if (forwardDistance > 3 && forwardDistance < 12) {
      const hit = this.collisionSystem.raycast(
        cycle.gridPosition,
        forwardVector,
        12,
        allCycles,
        cycle.id
      )

      // If it's a trail (not wall), we might jump over
      if (hit.type === 'trail' && hit.distance > 3 && hit.distance < 10) {
        return true
      }
    }

    // Emergency jump
    if (forwardDistance < 4) {
      return Math.random() < 0.4
    }

    return false
  }

  /**
   * Reset AI state
   */
  reset(): void {
    this.lastDecisionTime.clear()
  }
}
