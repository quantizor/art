/**
 * AI Controller — Strategy-Based Adversarial Engine
 *
 * Instead of reactive obstacle avoidance, this AI actively hunts, traps,
 * and outmaneuvers opponents using five named strategies:
 *
 *   headOn  — chicken run: charge at opponent, swerve at last second
 *   cutOff  — race ahead of opponent's path, lay trail across it
 *   box     — circle to opponent's open side, close it off with trail
 *   wallRide — follow wall/trail at safe distance, conserve space
 *   survive — pure survival: pick the most open direction
 *
 * Fully deterministic — no Math.random(). Personality and difficulty
 * modulate which strategies are preferred and how well they execute.
 */

import {
  AI_CONFIG,
  AI_DIFFICULTY_PROFILES,
  AI_PERSONALITY_WEIGHTS,
  AI_STRATEGY_PREFERENCES,
  DIRECTION_VECTORS,
  TURN_LEFT,
  TURN_RIGHT,
  ARENA_HALF,
  DIRECTION_TO_ANGLE,
} from '../constants'
import { normalizeAngle } from '../constants'
import type {
  AIDifficulty,
  AIPersonality,
  AIProfile,
  AIStrategyName,
  AIStrategyPreferences,
  AIStrategyState,
  CycleState,
  GridDirection,
} from '../types'
import { CollisionSystem } from './CollisionSystem'

// ============================================
// PUBLIC TYPES
// ============================================

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
  opponentProximity: number
  centerPreference: number
  totalScore: number
}

// ============================================
// CONSTANTS
// ============================================

/** Turn cooldown — strategies need responsive turning (300ms ≈ 3.6 units) */
const TURN_COOLDOWN = 300

/** Absolute emergency — crash imminent, override everything */
const EMERGENCY_DISTANCE = 1.0

// ============================================
// PROFILE FACTORY
// ============================================

export function getDefaultProfile(
  difficulty: AIDifficulty,
  personality: AIPersonality
): AIProfile {
  return {
    difficulty,
    personality,
    difficultyParams: AI_DIFFICULTY_PROFILES[difficulty],
    personalityWeights: AI_PERSONALITY_WEIGHTS[personality],
  }
}

const DEFAULT_PROFILE = getDefaultProfile('medium', 'defensive')

// ============================================
// AI CONTROLLER
// ============================================

export class AIController {
  private collisionSystem: CollisionSystem
  private strategyState: Map<string, AIStrategyState> = new Map()

  constructor(collisionSystem: CollisionSystem) {
    this.collisionSystem = collisionSystem
  }

  // ──────────────────────────────────────────
  // MAIN DECISION ENTRY POINT
  // ──────────────────────────────────────────

  getDecision(
    cycle: CycleState,
    allCycles: CycleState[],
    currentTime: number
  ): AIDecision {
    const profile = cycle.aiProfile ?? DEFAULT_PROFILE
    const preferences = AI_STRATEGY_PREFERENCES[profile.personality]

    // Initialize strategy state for this cycle
    let state = this.strategyState.get(cycle.id)
    if (!state) {
      state = {
        activeStrategy: 'survive',
        targetId: null,
        strategyStartTime: currentTime,
        persistenceTicks: 0,
        lastEvalTime: -Infinity,
        decisionCount: 0,
        lastTurnTime: -Infinity,
      }
      this.strategyState.set(cycle.id, state)
    }

    // Rate limit
    const effectiveInterval =
      AI_CONFIG.decisionInterval * profile.difficultyParams.decisionIntervalMultiplier
    if (currentTime - state.lastEvalTime < effectiveInterval) {
      return { turn: 'none', urgency: 0, jump: false }
    }
    state.lastEvalTime = currentTime
    state.decisionCount++

    // ── STRATEGY SELECTION ────────────────────────
    const targetDead =
      state.targetId !== null &&
      !allCycles.some((c) => c.id === state!.targetId && c.isAlive)
    const shouldReconsider =
      state.persistenceTicks >= preferences.maxPersistence ||
      state.persistenceTicks >= preferences.minPersistence ||
      targetDead

    if (shouldReconsider) {
      const targetId = this.selectTarget(cycle, allCycles, profile, preferences)
      const target = targetId
        ? allCycles.find((c) => c.id === targetId && c.isAlive)
        : undefined

      const newStrategy = this.evaluateStrategies(
        cycle,
        allCycles,
        target,
        profile,
        preferences
      )

      state.activeStrategy = newStrategy
      state.targetId = targetId
      state.strategyStartTime = currentTime
      state.persistenceTicks = 0
    }
    state.persistenceTicks++

    // ── STRATEGY EXECUTION ────────────────────────
    const target = state.targetId
      ? allCycles.find((c) => c.id === state!.targetId && c.isAlive)
      : undefined

    // Difficulty-based mistakes: every Nth decision, fall back to survive
    const mistakeInterval =
      profile.difficultyParams.mistakeRate > 0
        ? Math.round(1 / profile.difficultyParams.mistakeRate)
        : Infinity
    const isMistake = state.decisionCount % mistakeInterval === 0
    const effectiveStrategy = isMistake ? 'survive' : state.activeStrategy

    let decision: AIDecision
    switch (effectiveStrategy) {
      case 'headOn':
        decision = target
          ? this.executeHeadOn(cycle, target, allCycles, profile)
          : this.executeSurvive(cycle, allCycles, profile)
        break
      case 'cutOff':
        decision = target
          ? this.executeCutOff(cycle, target, allCycles, profile)
          : this.executeSurvive(cycle, allCycles, profile)
        break
      case 'box':
        decision = target
          ? this.executeBox(cycle, target, allCycles, profile)
          : this.executeSurvive(cycle, allCycles, profile)
        break
      case 'wallRide':
        decision = this.executeWallRide(cycle, allCycles, profile)
        break
      case 'survive':
      default:
        decision = this.executeSurvive(cycle, allCycles, profile)
        break
    }

    // ── EMERGENCY OVERRIDE ────────────────────────
    decision = this.applyEmergencyOverride(
      decision,
      cycle,
      allCycles,
      state,
      currentTime,
      profile
    )

    // Track turn timing
    if (decision.turn !== 'none') {
      state.lastTurnTime = currentTime
    }

    return decision
  }

  // ──────────────────────────────────────────
  // TARGET SELECTION
  // ──────────────────────────────────────────

  private selectTarget(
    self: CycleState,
    allCycles: CycleState[],
    profile: AIProfile,
    preferences: AIStrategyPreferences
  ): string | null {
    const opponents = allCycles.filter((c) => c.id !== self.id && c.isAlive)
    if (opponents.length === 0) return null

    // Easy/medium: nearest opponent
    if (!profile.difficultyParams.considersOpponents) {
      return this.selectNearestOpponent(self, opponents)
    }

    // Hard: weighted scoring
    let bestScore = -Infinity
    let bestId: string | null = null

    for (const opp of opponents) {
      const dx = opp.gridPosition.x - self.gridPosition.x
      const dz = opp.gridPosition.z - self.gridPosition.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      // Closer = higher priority
      const distScore = Math.max(0, 60 - dist)

      // Is opponent approaching us? (dot product)
      const oppVec = DIRECTION_VECTORS[opp.direction]
      const toUsX = self.gridPosition.x - opp.gridPosition.x
      const toUsZ = self.gridPosition.z - opp.gridPosition.z
      const toUsMag = Math.sqrt(toUsX * toUsX + toUsZ * toUsZ)
      const dot =
        toUsMag > 0
          ? (oppVec.x * toUsX + oppVec.z * toUsZ) / toUsMag
          : 0
      const approachScore = dot > 0.5 ? 15 : 0

      // Vulnerability: fewer escape paths = easier target
      const oppEscapes = this.countQuickEscapePaths(opp, allCycles)
      const vulnScore = Math.max(0, (4 - oppEscapes) * 5)

      const total =
        distScore *
          (preferences.headOnPreference + preferences.cutOffPreference) *
          0.1 +
        approachScore * preferences.headOnPreference * 0.5 +
        vulnScore *
          (preferences.boxPreference + preferences.cutOffPreference) *
          0.3

      if (total > bestScore) {
        bestScore = total
        bestId = opp.id
      }
    }

    return bestId
  }

  private selectNearestOpponent(
    self: CycleState,
    opponents: CycleState[]
  ): string | null {
    let bestDist = Infinity
    let bestId: string | null = null
    for (const opp of opponents) {
      const dx = opp.gridPosition.x - self.gridPosition.x
      const dz = opp.gridPosition.z - self.gridPosition.z
      const dist = dx * dx + dz * dz
      if (dist < bestDist) {
        bestDist = dist
        bestId = opp.id
      }
    }
    return bestId
  }

  /** Quick 4-direction escape path count */
  private countQuickEscapePaths(
    cycle: CycleState,
    allCycles: CycleState[]
  ): number {
    const dirs: Array<{ x: number; z: number }> = [
      { x: 0, z: -1 },
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: -1, z: 0 },
    ]
    let open = 0
    for (const dir of dirs) {
      const hit = this.collisionSystem.raycast(
        cycle.gridPosition,
        dir,
        15,
        allCycles,
        cycle.id
      )
      if (hit.distance >= 10) open++
    }
    return open
  }

  // ──────────────────────────────────────────
  // STRATEGY SELECTION
  // ──────────────────────────────────────────

  private evaluateStrategies(
    self: CycleState,
    allCycles: CycleState[],
    target: CycleState | undefined,
    profile: AIProfile,
    preferences: AIStrategyPreferences
  ): AIStrategyName {
    const scores: Array<{ name: AIStrategyName; score: number }> = []

    if (target) {
      scores.push({
        name: 'headOn',
        score:
          this.scoreHeadOn(self, target, allCycles) *
          preferences.headOnPreference,
      })
      scores.push({
        name: 'cutOff',
        score:
          this.scoreCutOff(self, target, allCycles) *
          preferences.cutOffPreference,
      })
      scores.push({
        name: 'box',
        score:
          this.scoreBox(self, target, allCycles) * preferences.boxPreference,
      })
    }

    scores.push({
      name: 'wallRide',
      score:
        this.scoreWallRide(self, allCycles) * preferences.wallRidePreference,
    })
    scores.push({
      name: 'survive',
      score:
        this.scoreSurvive(self, allCycles) * preferences.survivePreference,
    })

    // Deterministic tie-breaking: prefer strategies earlier in fixed order
    const priorityOrder: AIStrategyName[] = [
      'headOn',
      'cutOff',
      'box',
      'wallRide',
      'survive',
    ]
    scores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return priorityOrder.indexOf(a.name) - priorityOrder.indexOf(b.name)
    })

    return scores[0].name
  }

  // ──────────────────────────────────────────
  // STRATEGY CONDITION SCORING (each 0-10)
  // ──────────────────────────────────────────

  /** headOn: good when target is roughly ahead, 10-50 units, with escape room */
  private scoreHeadOn(
    self: CycleState,
    target: CycleState,
    allCycles: CycleState[]
  ): number {
    const dx = target.gridPosition.x - self.gridPosition.x
    const dz = target.gridPosition.z - self.gridPosition.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < 8 || dist > 50) return 0

    // Is target roughly ahead?
    const selfVec = DIRECTION_VECTORS[self.direction]
    const dot = (selfVec.x * dx + selfVec.z * dz) / dist
    if (dot < 0.3) return 0

    // Are we facing each other?
    const oppVec = DIRECTION_VECTORS[target.direction]
    const facingDot = -(selfVec.x * oppVec.x + selfVec.z * oppVec.z)
    const facingBonus = facingDot > 0.7 ? 4 : facingDot > 0 ? 2 : 0

    // Escape room on at least one side
    const leftDir = TURN_LEFT[self.direction]
    const rightDir = TURN_RIGHT[self.direction]
    const leftClear = this.collisionSystem.raycast(
      self.gridPosition,
      DIRECTION_VECTORS[leftDir],
      15,
      allCycles,
      self.id
    ).distance
    const rightClear = this.collisionSystem.raycast(
      self.gridPosition,
      DIRECTION_VECTORS[rightDir],
      15,
      allCycles,
      self.id
    ).distance
    if (Math.max(leftClear, rightClear) < 5) return 0

    const distScore = 1 - Math.abs(dist - 25) / 25
    return Math.max(0, Math.min(10, distScore * 6 + facingBonus))
  }

  /** cutOff: good when we can beat target to their projected path */
  private scoreCutOff(
    self: CycleState,
    target: CycleState,
    allCycles: CycleState[]
  ): number {
    const dx = target.gridPosition.x - self.gridPosition.x
    const dz = target.gridPosition.z - self.gridPosition.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < 5 || dist > 60) return 0

    // Project target 1.5 seconds ahead
    const tVec = DIRECTION_VECTORS[target.direction]
    const futureTarget = {
      x: target.gridPosition.x + tVec.x * 18,
      z: target.gridPosition.z + tVec.z * 18,
    }

    const toFuture = {
      x: futureTarget.x - self.gridPosition.x,
      z: futureTarget.z - self.gridPosition.z,
    }
    const distToIntercept = Math.sqrt(
      toFuture.x * toFuture.x + toFuture.z * toFuture.z
    )

    const targetDistToFuture = 18
    if (distToIntercept >= targetDistToFuture) return 0

    // Intercept must be roughly ahead of us
    const selfVec = DIRECTION_VECTORS[self.direction]
    const dotToIntercept =
      toFuture.x * selfVec.x + toFuture.z * selfVec.z
    if (dotToIntercept < 0) return 0

    // Check path is clear
    const interceptDir = {
      x: toFuture.x / distToIntercept,
      z: toFuture.z / distToIntercept,
    }
    const pathClear = this.collisionSystem.raycast(
      self.gridPosition,
      interceptDir,
      distToIntercept,
      allCycles,
      self.id
    )
    if (pathClear.distance < distToIntercept * 0.8) return 2

    const advantage =
      (targetDistToFuture - distToIntercept) / targetDistToFuture
    return Math.min(10, advantage * 12 + 2)
  }

  /** box: good when target is already partially boxed */
  private scoreBox(
    self: CycleState,
    target: CycleState,
    allCycles: CycleState[]
  ): number {
    const dist = Math.sqrt(
      (target.gridPosition.x - self.gridPosition.x) ** 2 +
        (target.gridPosition.z - self.gridPosition.z) ** 2
    )

    if (dist > 50) return 0

    const targetEscapes = this.countQuickEscapePaths(target, allCycles)
    if (targetEscapes >= 3) return 1

    const escapeScore = (4 - targetEscapes) * 2.5
    const proxBonus = dist < 25 ? 2 : 0
    return Math.min(10, escapeScore + proxBonus)
  }

  /** wallRide: good when wall/trail is nearby on one side */
  private scoreWallRide(
    self: CycleState,
    allCycles: CycleState[]
  ): number {
    const leftDir = TURN_LEFT[self.direction]
    const rightDir = TURN_RIGHT[self.direction]

    const leftHit = this.collisionSystem.raycast(
      self.gridPosition,
      DIRECTION_VECTORS[leftDir],
      8,
      allCycles,
      self.id
    )
    const rightHit = this.collisionSystem.raycast(
      self.gridPosition,
      DIRECTION_VECTORS[rightDir],
      8,
      allCycles,
      self.id
    )

    const closestSide = Math.min(leftHit.distance, rightHit.distance)
    const farthestSide = Math.max(leftHit.distance, rightHit.distance)

    if (closestSide >= 2 && closestSide <= 5 && farthestSide > 6) return 7
    if (closestSide < 2) return 2
    if (closestSide > 5) return 1
    return 3
  }

  /** survive: good when we're in danger */
  private scoreSurvive(
    self: CycleState,
    allCycles: CycleState[]
  ): number {
    const escapes = this.countQuickEscapePaths(self, allCycles)

    const fwdHit = this.collisionSystem.raycast(
      self.gridPosition,
      DIRECTION_VECTORS[self.direction],
      30,
      allCycles,
      self.id
    )

    let panicScore = 0
    if (escapes <= 1) panicScore += 5
    else if (escapes === 2) panicScore += 2
    if (fwdHit.distance < 5) panicScore += 3
    else if (fwdHit.distance < 10) panicScore += 1

    const nearbyOpponents = allCycles.filter((c) => {
      if (c.id === self.id || !c.isAlive) return false
      const d = Math.sqrt(
        (c.gridPosition.x - self.gridPosition.x) ** 2 +
          (c.gridPosition.z - self.gridPosition.z) ** 2
      )
      return d < 15
    }).length
    if (nearbyOpponents >= 2) panicScore += 2

    return Math.min(10, panicScore)
  }

  // ──────────────────────────────────────────
  // STRATEGY EXECUTION
  // ──────────────────────────────────────────

  /**
   * HEAD-ON (Chicken Run):
   * Charge at opponent. At chicken distance, swerve to the safest side.
   */
  private executeHeadOn(
    self: CycleState,
    target: CycleState,
    allCycles: CycleState[],
    profile: AIProfile
  ): AIDecision {
    const dx = target.gridPosition.x - self.gridPosition.x
    const dz = target.gridPosition.z - self.gridPosition.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    const angleToTarget = Math.atan2(dx, -dz)
    const angleDiff = normalizeAngle(angleToTarget - self.angle)

    // Chicken distance: harder AI swerves later
    const chickenDist =
      3 + (3 - profile.difficultyParams.planningDepth) * 2

    // SWERVE — too close
    if (dist < chickenDist) {
      return this.pickBestEscapeDirection(self, allCycles)
    }

    // ALIGN — turn toward target
    if (Math.abs(angleDiff) > Math.PI / 4) {
      const turnDir: 'left' | 'right' = angleDiff > 0 ? 'right' : 'left'
      return { turn: turnDir, urgency: 0.7, jump: false }
    }

    // CHECK for trail between us and target — jump over it
    const fwdHit = this.collisionSystem.raycast(
      self.gridPosition,
      DIRECTION_VECTORS[self.direction],
      dist,
      allCycles,
      self.id
    )
    if (
      fwdHit.type === 'trail' &&
      fwdHit.distance < dist - 2 &&
      fwdHit.distance > 3
    ) {
      return { turn: 'none', urgency: 0.5, jump: true }
    }

    // CHARGE straight
    return { turn: 'none', urgency: 0.6, jump: false }
  }

  /**
   * CUT-OFF:
   * Race to opponent's projected path, turn perpendicular to block them.
   */
  private executeCutOff(
    self: CycleState,
    target: CycleState,
    allCycles: CycleState[],
    _profile: AIProfile
  ): AIDecision {
    const tVec = DIRECTION_VECTORS[target.direction]

    // Intercept point: where target will be in ~1.5s
    const interceptPoint = {
      x: target.gridPosition.x + tVec.x * 18,
      z: target.gridPosition.z + tVec.z * 18,
    }

    const dx = interceptPoint.x - self.gridPosition.x
    const dz = interceptPoint.z - self.gridPosition.z
    const distToIntercept = Math.sqrt(dx * dx + dz * dz)

    // PHASE 2 — at intercept zone, turn perpendicular to target's heading
    if (distToIntercept < 6) {
      const perpLeft = TURN_LEFT[target.direction]
      const perpRight = TURN_RIGHT[target.direction]
      const perpLeftAngle = DIRECTION_TO_ANGLE[perpLeft]
      const perpRightAngle = DIRECTION_TO_ANGLE[perpRight]
      const diffLeft = Math.abs(normalizeAngle(perpLeftAngle - self.angle))
      const diffRight = Math.abs(
        normalizeAngle(perpRightAngle - self.angle)
      )

      // Already roughly perpendicular
      if (diffLeft < Math.PI / 4 || diffRight < Math.PI / 4) {
        return { turn: 'none', urgency: 0.8, jump: false }
      }

      const turnDir: 'left' | 'right' =
        diffLeft < diffRight ? 'left' : 'right'
      return { turn: turnDir, urgency: 0.8, jump: false }
    }

    // PHASE 1 — race toward intercept point
    const angleToIntercept = Math.atan2(dx, -dz)
    const angleDiff = normalizeAngle(angleToIntercept - self.angle)

    if (Math.abs(angleDiff) > Math.PI / 4) {
      const turnDir: 'left' | 'right' = angleDiff > 0 ? 'right' : 'left'
      return { turn: turnDir, urgency: 0.6, jump: false }
    }

    return { turn: 'none', urgency: 0.5, jump: false }
  }

  /**
   * BOX/TRAP:
   * Navigate to opponent's most open side, then drive perpendicular to close it off.
   */
  private executeBox(
    self: CycleState,
    target: CycleState,
    allCycles: CycleState[],
    _profile: AIProfile
  ): AIDecision {
    // Find target's most open side
    const dirs: GridDirection[] = ['north', 'east', 'south', 'west']
    const openSides: Array<{ dir: GridDirection; distance: number }> = []

    for (const dir of dirs) {
      const vec = DIRECTION_VECTORS[dir]
      const hit = this.collisionSystem.raycast(
        target.gridPosition,
        vec,
        20,
        allCycles,
        self.id
      )
      openSides.push({ dir, distance: hit.distance })
    }
    openSides.sort((a, b) => b.distance - a.distance)

    // Navigate to 8 units from target on their most open side
    const goalDir = openSides[0].dir
    const goalVec = DIRECTION_VECTORS[goalDir]
    const goalPoint = {
      x: target.gridPosition.x + goalVec.x * 8,
      z: target.gridPosition.z + goalVec.z * 8,
    }

    const toGoal = {
      x: goalPoint.x - self.gridPosition.x,
      z: goalPoint.z - self.gridPosition.z,
    }
    const distToGoal = Math.sqrt(toGoal.x * toGoal.x + toGoal.z * toGoal.z)

    // At goal — drive perpendicular to close off the open side
    if (distToGoal < 5) {
      const perp = TURN_LEFT[goalDir]
      const perpAngle = DIRECTION_TO_ANGLE[perp]
      const angleDiff = normalizeAngle(perpAngle - self.angle)

      if (Math.abs(angleDiff) < Math.PI / 4) {
        return { turn: 'none', urgency: 0.7, jump: false }
      }
      const turnDir: 'left' | 'right' = angleDiff > 0 ? 'right' : 'left'
      return { turn: turnDir, urgency: 0.7, jump: false }
    }

    // Navigate toward goal
    const angleToGoal = Math.atan2(toGoal.x, -toGoal.z)
    const angleDiff = normalizeAngle(angleToGoal - self.angle)

    if (Math.abs(angleDiff) > Math.PI / 4) {
      const turnDir: 'left' | 'right' = angleDiff > 0 ? 'right' : 'left'
      return { turn: turnDir, urgency: 0.5, jump: false }
    }

    return { turn: 'none', urgency: 0.5, jump: false }
  }

  /**
   * WALL-RIDE:
   * Follow wall/trail at ~3 units distance, conserving open space.
   */
  private executeWallRide(
    self: CycleState,
    allCycles: CycleState[],
    _profile: AIProfile
  ): AIDecision {
    const leftDir = TURN_LEFT[self.direction]
    const rightDir = TURN_RIGHT[self.direction]

    const leftHit = this.collisionSystem.raycast(
      self.gridPosition,
      DIRECTION_VECTORS[leftDir],
      10,
      allCycles,
      self.id
    )
    const rightHit = this.collisionSystem.raycast(
      self.gridPosition,
      DIRECTION_VECTORS[rightDir],
      10,
      allCycles,
      self.id
    )

    const wallSide: 'left' | 'right' =
      leftHit.distance < rightHit.distance ? 'left' : 'right'
    const wallDist = Math.min(leftHit.distance, rightHit.distance)
    const idealDist = 3

    // Forward blocked — turn away from wall
    const fwdHit = this.collisionSystem.raycast(
      self.gridPosition,
      DIRECTION_VECTORS[self.direction],
      20,
      allCycles,
      self.id
    )
    if (fwdHit.distance < 4) {
      const turnDir: 'left' | 'right' =
        wallSide === 'left' ? 'right' : 'left'
      return { turn: turnDir, urgency: 0.8, jump: false }
    }

    // Too close to wall — drift away
    if (wallDist < idealDist - 1) {
      const turnDir: 'left' | 'right' =
        wallSide === 'left' ? 'right' : 'left'
      return { turn: turnDir, urgency: 0.4, jump: false }
    }

    // Drifting away — correct back toward wall
    if (wallDist > idealDist + 2 && wallDist < 8) {
      const turnDir: 'left' | 'right' =
        wallSide === 'left' ? 'left' : 'right'
      return { turn: turnDir, urgency: 0.3, jump: false }
    }

    return { turn: 'none', urgency: 0.2, jump: false }
  }

  /**
   * SURVIVE:
   * Pure survival — pick the direction with the most open space.
   */
  private executeSurvive(
    self: CycleState,
    allCycles: CycleState[],
    profile: AIProfile
  ): AIDecision {
    const scores = this.evaluateAllDirections(self, allCycles, profile)
    scores.sort((a, b) => b.totalScore - a.totalScore)

    const forwardOption = scores.find((s) => s.turn === 'none')!
    const bestOption = scores[0]

    // If forward is within 90% of best, keep going straight (stability)
    if (forwardOption.totalScore >= bestOption.totalScore * 0.9) {
      // Check for jump opportunity
      const shouldJump = this.shouldJump(
        self,
        allCycles,
        forwardOption.forwardDistance,
        profile
      )
      return { turn: 'none', urgency: 0.3, jump: shouldJump }
    }

    return { turn: bestOption.turn, urgency: 0.7, jump: false }
  }

  // ──────────────────────────────────────────
  // EMERGENCY OVERRIDE
  // ──────────────────────────────────────────

  private applyEmergencyOverride(
    decision: AIDecision,
    self: CycleState,
    allCycles: CycleState[],
    state: AIStrategyState,
    currentTime: number,
    _profile: AIProfile
  ): AIDecision {
    // Check chosen direction for imminent collision
    const chosenDir: GridDirection =
      decision.turn === 'none'
        ? self.direction
        : decision.turn === 'left'
          ? TURN_LEFT[self.direction]
          : TURN_RIGHT[self.direction]

    const fwdHit = this.collisionSystem.raycast(
      self.gridPosition,
      DIRECTION_VECTORS[chosenDir],
      5,
      allCycles,
      self.id
    )

    if (fwdHit.distance < EMERGENCY_DISTANCE) {
      // Try jumping if trail collision
      if (!self.isJumping && fwdHit.type === 'trail') {
        return { turn: decision.turn, urgency: 1, jump: true }
      }

      // If going straight, find escape
      if (decision.turn === 'none') {
        return this.pickBestEscapeDirection(self, allCycles)
      }

      // If chosen turn is also blocked, try opposite
      const otherTurn: 'left' | 'right' =
        decision.turn === 'left' ? 'right' : 'left'
      const otherDir: GridDirection =
        otherTurn === 'left'
          ? TURN_LEFT[self.direction]
          : TURN_RIGHT[self.direction]
      const otherHit = this.collisionSystem.raycast(
        self.gridPosition,
        DIRECTION_VECTORS[otherDir],
        5,
        allCycles,
        self.id
      )
      if (otherHit.distance > fwdHit.distance) {
        return { turn: otherTurn, urgency: 1, jump: false }
      }
    }

    // Suppress turn if cooldown is active and forward is safe
    if (decision.turn !== 'none') {
      const timeSinceLastTurn = currentTime - state.lastTurnTime
      if (timeSinceLastTurn < TURN_COOLDOWN) {
        const straightHit = this.collisionSystem.raycast(
          self.gridPosition,
          DIRECTION_VECTORS[self.direction],
          5,
          allCycles,
          self.id
        )
        if (straightHit.distance > EMERGENCY_DISTANCE) {
          return {
            turn: 'none',
            urgency: decision.urgency * 0.5,
            jump: decision.jump,
          }
        }
      }
    }

    return decision
  }

  /** Pick the side with more room for an emergency escape */
  private pickBestEscapeDirection(
    self: CycleState,
    allCycles: CycleState[]
  ): AIDecision {
    const leftDir = TURN_LEFT[self.direction]
    const rightDir = TURN_RIGHT[self.direction]

    const leftDist = this.collisionSystem.raycast(
      self.gridPosition,
      DIRECTION_VECTORS[leftDir],
      30,
      allCycles,
      self.id
    ).distance
    const rightDist = this.collisionSystem.raycast(
      self.gridPosition,
      DIRECTION_VECTORS[rightDir],
      30,
      allCycles,
      self.id
    ).distance

    const turn: 'left' | 'right' = rightDist > leftDist ? 'right' : 'left'
    return { turn, urgency: 1, jump: false }
  }

  // ──────────────────────────────────────────
  // SURVIVE SCORING (retained from previous AI)
  // ──────────────────────────────────────────

  private evaluateAllDirections(
    cycle: CycleState,
    allCycles: CycleState[],
    profile: AIProfile
  ): DirectionScore[] {
    const weights = profile.personalityWeights
    const effectiveLookAhead =
      AI_CONFIG.lookAheadDistance * profile.difficultyParams.lookAheadMultiplier

    const directions: Array<{
      dir: GridDirection
      turn: 'left' | 'right' | 'none'
    }> = [
      { dir: cycle.direction, turn: 'none' },
      { dir: TURN_LEFT[cycle.direction], turn: 'left' },
      { dir: TURN_RIGHT[cycle.direction], turn: 'right' },
    ]

    return directions.map(({ dir, turn }) => {
      const vector = DIRECTION_VECTORS[dir]

      const forwardHit = this.collisionSystem.raycast(
        cycle.gridPosition,
        vector,
        effectiveLookAhead * 2,
        allCycles,
        cycle.id
      )
      const normalizedDistance =
        (Math.min(forwardHit.distance, effectiveLookAhead) /
          effectiveLookAhead) *
        20

      const escapePaths = this.countEscapePathsRecursive(
        cycle.gridPosition,
        dir,
        allCycles,
        cycle.id,
        profile.difficultyParams.planningDepth
      )
      const normalizedEscape = Math.min(escapePaths, 4) * 5

      const selfTrailDanger = this.evaluateSelfTrailDanger(
        cycle,
        dir,
        allCycles
      )
      const opponentProximity = profile.difficultyParams.considersOpponents
        ? this.evaluateOpponentProximity(cycle, dir, allCycles)
        : 0
      const centerPreference = this.evaluateCenterPreference(cycle, dir)

      const totalScore =
        normalizedDistance * weights.forwardDistanceWeight +
        normalizedEscape * weights.escapePathWeight +
        selfTrailDanger * weights.selfTrailDangerWeight +
        opponentProximity * weights.opponentProximityWeight +
        centerPreference * weights.centerPreferenceWeight

      return {
        direction: dir,
        turn,
        forwardDistance: forwardHit.distance,
        escapePaths,
        selfTrailDanger,
        opponentProximity,
        centerPreference,
        totalScore,
      }
    })
  }

  private countEscapePathsRecursive(
    position: { x: number; z: number },
    primaryDir: GridDirection,
    allCycles: CycleState[],
    selfId: string,
    depth: number
  ): number {
    const vector = DIRECTION_VECTORS[primaryDir]
    const futurePos = {
      x: position.x + vector.x * 8,
      z: position.z + vector.z * 8,
    }

    const allDirs: GridDirection[] = ['north', 'east', 'south', 'west']
    let openPaths = 0

    for (const dir of allDirs) {
      const checkVector = DIRECTION_VECTORS[dir]
      const hit = this.collisionSystem.raycast(
        futurePos,
        checkVector,
        15,
        allCycles,
        selfId
      )

      if (hit.distance >= 5) {
        openPaths++
        if (depth > 1) {
          const nextPos = {
            x: futurePos.x + checkVector.x * 8,
            z: futurePos.z + checkVector.z * 8,
          }
          openPaths +=
            this.countEscapePathsRecursive(
              nextPos,
              dir,
              allCycles,
              selfId,
              depth - 1
            ) * 0.5
        }
      }
    }

    return openPaths
  }

  private evaluateOpponentProximity(
    cycle: CycleState,
    direction: GridDirection,
    allCycles: CycleState[]
  ): number {
    const vector = DIRECTION_VECTORS[direction]
    const futurePos = {
      x: cycle.gridPosition.x + vector.x * 10,
      z: cycle.gridPosition.z + vector.z * 10,
    }

    let closestDist = Infinity
    for (const other of allCycles) {
      if (other.id === cycle.id || !other.isAlive) continue
      const dx = futurePos.x - other.gridPosition.x
      const dz = futurePos.z - other.gridPosition.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < closestDist) closestDist = dist
    }

    if (closestDist === Infinity) return 0
    return Math.max(0, 20 - closestDist)
  }

  private evaluateCenterPreference(
    cycle: CycleState,
    direction: GridDirection
  ): number {
    const vector = DIRECTION_VECTORS[direction]
    const futurePos = {
      x: cycle.gridPosition.x + vector.x * 8,
      z: cycle.gridPosition.z + vector.z * 8,
    }
    const distFromCenter = Math.sqrt(
      futurePos.x * futurePos.x + futurePos.z * futurePos.z
    )
    return Math.max(0, (1 - distFromCenter / ARENA_HALF) * 10)
  }

  private evaluateSelfTrailDanger(
    cycle: CycleState,
    direction: GridDirection,
    allCycles: CycleState[]
  ): number {
    if (cycle.trail.length < 3) return 0

    const vector = DIRECTION_VECTORS[direction]
    let danger = 0

    for (const dist of [5, 10, 15, 20]) {
      const checkPos = {
        x: cycle.gridPosition.x + vector.x * dist,
        z: cycle.gridPosition.z + vector.z * dist,
      }
      const oldTrail = cycle.trail.slice(
        0,
        Math.max(0, cycle.trail.length - 4)
      )
      for (const segment of oldTrail) {
        const d = this.distanceToSegment(checkPos, segment)
        if (d < 3) danger -= 10 - d * 2
      }
    }

    for (const sideDir of [TURN_LEFT[direction], TURN_RIGHT[direction]]) {
      const sideHit = this.collisionSystem.raycast(
        cycle.gridPosition,
        DIRECTION_VECTORS[sideDir],
        10,
        allCycles,
        cycle.id
      )
      if (sideHit.distance < 5 && sideHit.type === 'trail') danger -= 5
    }

    return danger
  }

  private distanceToSegment(
    point: { x: number; z: number },
    segment: { start: { x: number; z: number }; end: { x: number; z: number } }
  ): number {
    const { start, end } = segment
    const dx = end.x - start.x
    const dz = end.z - start.z
    const lenSq = dx * dx + dz * dz

    if (lenSq === 0) {
      return Math.sqrt(
        (point.x - start.x) ** 2 + (point.z - start.z) ** 2
      )
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * dx + (point.z - start.z) * dz) / lenSq
      )
    )
    const closestX = start.x + t * dx
    const closestZ = start.z + t * dz
    return Math.sqrt(
      (point.x - closestX) ** 2 + (point.z - closestZ) ** 2
    )
  }

  private shouldJump(
    cycle: CycleState,
    allCycles: CycleState[],
    forwardDistance: number,
    profile: AIProfile
  ): boolean {
    if (cycle.isJumping) return false
    if (profile.personalityWeights.jumpEagerness < 0.4) return false

    const forwardVector = DIRECTION_VECTORS[cycle.direction]

    // Tactical jump: trail ahead that can be cleared
    if (forwardDistance > 3 && forwardDistance < 12) {
      const hit = this.collisionSystem.raycast(
        cycle.gridPosition,
        forwardVector,
        12,
        allCycles,
        cycle.id
      )
      if (hit.type === 'trail' && hit.distance > 3 && hit.distance < 10) {
        if (profile.difficultyParams.planningDepth <= 1) return true

        const beyondPos = {
          x: cycle.gridPosition.x + forwardVector.x * (hit.distance + 4),
          z: cycle.gridPosition.z + forwardVector.z * (hit.distance + 4),
        }
        const beyondHit = this.collisionSystem.raycast(
          beyondPos,
          forwardVector,
          15,
          allCycles,
          cycle.id
        )
        if (beyondHit.distance > 8) return true
      }
    }

    // Emergency jump
    if (forwardDistance < 4) return true

    return false
  }

  // ──────────────────────────────────────────
  // RESET
  // ──────────────────────────────────────────

  reset(): void {
    this.strategyState.clear()
  }
}
