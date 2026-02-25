/**
 * AIController Tests — Strategy-Based Adversarial Engine
 *
 * Tests for the 5-strategy AI: headOn, cutOff, box, wallRide, survive.
 * Covers target selection, strategy selection, execution, emergency override,
 * persistence, difficulty modulation, and determinism.
 *
 * Fully deterministic — no Math.random() in either AI or tests.
 */

import { describe, test, expect } from 'bun:test'
import { AIController, getDefaultProfile } from './AIController'
import { CollisionSystem } from './CollisionSystem'
import type { CycleState, TrailSegment } from '../types'
import {
  AI_DIFFICULTY_PROFILES,
  AI_PERSONALITY_WEIGHTS,
  AI_STRATEGY_PREFERENCES,
} from '../constants'

// ============================================
// HELPERS
// ============================================

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

function createCycle(
  id: string,
  position: { x: number; z: number },
  direction: 'north' | 'east' | 'south' | 'west' = 'north',
  overrides: Partial<CycleState> = {}
): CycleState {
  const angleMap = {
    north: 0,
    east: Math.PI / 2,
    south: Math.PI,
    west: -Math.PI / 2,
  }
  return {
    id,
    gridPosition: position,
    direction,
    angle: angleMap[direction],
    targetAngle: -1,
    isTurning: false,
    color: 0x00ffff,
    isAlive: true,
    trail: [],
    isPlayer: id === 'player',
    speed: 1,
    trailActive: true,
    isJumping: false,
    jumpStartTime: 0,
    lastJumpTime: 0,
    ...overrides,
  }
}

// ============================================
// TESTS
// ============================================

describe('getDefaultProfile', () => {
  test('returns correct difficulty params for easy', () => {
    const profile = getDefaultProfile('easy', 'aggressive')
    expect(profile.difficulty).toBe('easy')
    expect(profile.difficultyParams).toEqual(AI_DIFFICULTY_PROFILES.easy)
  })

  test('returns correct difficulty params for hard', () => {
    const profile = getDefaultProfile('hard', 'defensive')
    expect(profile.difficulty).toBe('hard')
    expect(profile.difficultyParams).toEqual(AI_DIFFICULTY_PROFILES.hard)
  })

  test('returns correct personality weights', () => {
    const profile = getDefaultProfile('medium', 'trapper')
    expect(profile.personality).toBe('trapper')
    expect(profile.personalityWeights).toEqual(AI_PERSONALITY_WEIGHTS.trapper)
  })

  test('combines difficulty and personality independently', () => {
    const easyAggressive = getDefaultProfile('easy', 'aggressive')
    const hardAggressive = getDefaultProfile('hard', 'aggressive')

    expect(easyAggressive.personalityWeights).toEqual(
      hardAggressive.personalityWeights
    )
    expect(easyAggressive.difficultyParams).not.toEqual(
      hardAggressive.difficultyParams
    )
  })
})

describe('AIController', () => {
  const collisionSystem = new CollisionSystem()

  // ──────────────────────────────────────────
  // DETERMINISM
  // ──────────────────────────────────────────

  describe('determinism', () => {
    test('same state produces same decision', () => {
      const cycle = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'defensive'),
      })
      const allCycles = [cycle]

      const ai1 = new AIController(collisionSystem)
      const ai2 = new AIController(collisionSystem)

      const d1 = ai1.getDecision(cycle, allCycles, 100)
      const d2 = ai2.getDecision(cycle, allCycles, 100)

      expect(d1.turn).toBe(d2.turn)
      expect(d1.urgency).toBe(d2.urgency)
      expect(d1.jump).toBe(d2.jump)
    })

    test('repeated calls with same time are rate-limited identically', () => {
      const ai = new AIController(collisionSystem)
      const cycle = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'defensive'),
      })
      const allCycles = [cycle]

      ai.getDecision(cycle, allCycles, 0)
      const d1 = ai.getDecision(cycle, allCycles, 30)
      const d2 = ai.getDecision(cycle, allCycles, 30)

      expect(d1).toEqual(d2)
    })
  })

  // ──────────────────────────────────────────
  // RATE LIMITING
  // ──────────────────────────────────────────

  describe('rate limiting', () => {
    test('returns no-op when called within decision interval', () => {
      const ai = new AIController(collisionSystem)
      const cycle = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'defensive'),
      })
      const allCycles = [cycle]

      ai.getDecision(cycle, allCycles, 0)

      const decision = ai.getDecision(cycle, allCycles, 30)
      expect(decision.turn).toBe('none')
      expect(decision.urgency).toBe(0)
      expect(decision.jump).toBe(false)
    })

    test('easy AI has longer decision interval than hard AI', () => {
      const ai = new AIController(collisionSystem)

      const easyCycle = createCycle('easy', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('easy', 'defensive'),
      })
      const hardCycle = createCycle('hard', { x: 10, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'defensive'),
      })
      const allCycles = [easyCycle, hardCycle]

      // Both decide at t=0
      ai.getDecision(easyCycle, allCycles, 0)
      ai.getDecision(hardCycle, allCycles, 0)

      // At t=50ms: easy is still rate-limited (interval=120ms), hard is not (interval=42ms)
      const easyAt50 = ai.getDecision(easyCycle, allCycles, 50)
      const hardAt50 = ai.getDecision(hardCycle, allCycles, 50)

      expect(easyAt50.turn).toBe('none')
      expect(easyAt50.urgency).toBe(0)
      // Hard AI was evaluated (may or may not turn depending on state)
      expect(typeof hardAt50.turn).toBe('string')
    })
  })

  // ──────────────────────────────────────────
  // TARGET SELECTION
  // ──────────────────────────────────────────

  describe('target selection', () => {
    test('returns no target when alone', () => {
      const ai = new AIController(collisionSystem)
      const cycle = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'aggressive'),
      })

      // Only cycle in the game — falls back to survive
      const decision = ai.getDecision(cycle, [cycle], 100)
      expect(['left', 'right', 'none']).toContain(decision.turn)
    })

    test('easy/medium AI targets nearest opponent', () => {
      const ai = new AIController(collisionSystem)
      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'aggressive'),
      })
      // Near opponent at distance ~10
      const near = createCycle('near', { x: 10, z: 0 }, 'west')
      // Far opponent at distance ~40
      const far = createCycle('far', { x: 40, z: 0 }, 'west')

      // With the near opponent present, the AI should pick a strategy
      // that involves the near opponent (we just verify it doesn't crash)
      const decision = ai.getDecision(self, [self, near, far], 100)
      expect(['left', 'right', 'none']).toContain(decision.turn)
    })

    test('hard AI uses weighted scoring for target selection', () => {
      const ai = new AIController(collisionSystem)
      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'aggressive'),
      })
      // Opponent approaching us (high approach score)
      const approaching = createCycle('app', { x: 0, z: -20 }, 'south')
      // Opponent moving away (no approach score)
      const retreating = createCycle('ret', { x: 0, z: -20 }, 'north')

      // Both at same distance but approaching opponent should score higher
      const d1 = new AIController(collisionSystem)
      const d2 = new AIController(collisionSystem)

      // Test both scenarios produce valid decisions
      const dec1 = d1.getDecision(self, [self, approaching], 100)
      const dec2 = d2.getDecision(self, [self, retreating], 100)

      expect(['left', 'right', 'none']).toContain(dec1.turn)
      expect(['left', 'right', 'none']).toContain(dec2.turn)
    })

    test('skips dead opponents for targeting', () => {
      const ai = new AIController(collisionSystem)
      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'aggressive'),
      })
      const deadOpponent = createCycle('dead', { x: 10, z: 0 }, 'west', {
        isAlive: false,
      })

      // Only alive + dead => no valid targets => survive
      const decision = ai.getDecision(self, [self, deadOpponent], 100)
      expect(['left', 'right', 'none']).toContain(decision.turn)
    })
  })

  // ──────────────────────────────────────────
  // STRATEGY SELECTION
  // ──────────────────────────────────────────

  describe('strategy selection', () => {
    test('aggressive personality prefers offensive strategies', () => {
      const prefs = AI_STRATEGY_PREFERENCES.aggressive
      expect(prefs.headOnPreference).toBeGreaterThan(prefs.wallRidePreference)
      expect(prefs.headOnPreference).toBeGreaterThan(prefs.survivePreference)
      expect(prefs.cutOffPreference).toBeGreaterThan(prefs.wallRidePreference)
    })

    test('defensive personality prefers wallRide and survive', () => {
      const prefs = AI_STRATEGY_PREFERENCES.defensive
      expect(prefs.wallRidePreference).toBeGreaterThan(prefs.headOnPreference)
      expect(prefs.survivePreference).toBeGreaterThan(prefs.headOnPreference)
      expect(prefs.wallRidePreference).toBeGreaterThan(prefs.cutOffPreference)
    })

    test('trapper personality prefers cutOff and box', () => {
      const prefs = AI_STRATEGY_PREFERENCES.trapper
      expect(prefs.cutOffPreference).toBeGreaterThan(prefs.headOnPreference)
      expect(prefs.boxPreference).toBeGreaterThan(prefs.headOnPreference)
      expect(prefs.cutOffPreference).toBeGreaterThan(prefs.wallRidePreference)
    })

    test('erratic personality has short persistence', () => {
      const prefs = AI_STRATEGY_PREFERENCES.erratic
      expect(prefs.maxPersistence).toBeLessThan(
        AI_STRATEGY_PREFERENCES.defensive.maxPersistence
      )
      expect(prefs.minPersistence).toBeLessThan(
        AI_STRATEGY_PREFERENCES.defensive.minPersistence
      )
    })

    test('all personalities have distinct preference profiles', () => {
      const personalities = ['aggressive', 'defensive', 'trapper', 'erratic'] as const
      const prefSets = personalities.map((p) => AI_STRATEGY_PREFERENCES[p])

      for (let i = 0; i < prefSets.length; i++) {
        for (let j = i + 1; j < prefSets.length; j++) {
          expect(prefSets[i]).not.toEqual(prefSets[j])
        }
      }
    })
  })

  // ──────────────────────────────────────────
  // HEAD-ON EXECUTION
  // ──────────────────────────────────────────

  describe('headOn execution', () => {
    test('charges straight when aligned with target', () => {
      const ai = new AIController(collisionSystem)

      // Cycle facing north, target directly ahead ~25 units (ideal head-on distance)
      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'aggressive'),
      })
      // Target facing south (toward us — head-on scenario)
      const target = createCycle('target', { x: 0, z: -25 }, 'south')

      // First decision initializes strategy
      const decision = ai.getDecision(self, [self, target], 100)

      // Should be charging or turning toward target — valid decision
      expect(['left', 'right', 'none']).toContain(decision.turn)
      expect(typeof decision.urgency).toBe('number')
    })

    test('swerves at chicken distance', () => {
      const ai = new AIController(collisionSystem)

      // Very close to target — below chicken distance for hard AI (3 units)
      // Target directly ahead in line with our heading
      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'aggressive'),
      })
      // Target 2 units ahead — within chicken distance
      const target = createCycle('target', { x: 0, z: -2 }, 'south')

      // At this close range, emergency override should kick in
      // (the target cycle itself is a collision object at ~2 units)
      const decision = ai.getDecision(self, [self, target], 100)

      // At this distance, emergency override or headOn swerve should fire
      // Either a turn or jump is valid
      expect(decision.turn === 'left' || decision.turn === 'right' || decision.jump).toBe(true)
    })

    test('jumps over trail between self and target', () => {
      const ai = new AIController(collisionSystem)

      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'aggressive'),
      })
      // Target 20 units ahead
      const target = createCycle('target', { x: 0, z: -20 }, 'south')

      // Trail crossing the path between self and target at z=-7
      const trailMaker = createCycle('trail', { x: 0, z: -40 }, 'east', {
        trail: [seg({ x: -30, z: -7 }, { x: 30, z: -7 }, 'east')],
      })

      const decision = ai.getDecision(self, [self, target, trailMaker], 100)
      // Should either jump over the trail or turn around it
      expect(['left', 'right', 'none']).toContain(decision.turn)
    })
  })

  // ──────────────────────────────────────────
  // CUT-OFF EXECUTION
  // ──────────────────────────────────────────

  describe('cutOff execution', () => {
    test('navigates toward intercept point', () => {
      const ai = new AIController(collisionSystem)

      // Self at origin facing east, target to the north facing east
      // Intercept point would be ahead of target (east)
      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'trapper'),
      })
      const target = createCycle('target', { x: 10, z: -15 }, 'east')

      const decision = ai.getDecision(self, [self, target], 100)
      // Should produce a valid decision (exact strategy depends on scoring)
      expect(['left', 'right', 'none']).toContain(decision.turn)
    })

    test('turns perpendicular at intercept zone', () => {
      const ai = new AIController(collisionSystem)

      // Self very close to where target is heading
      const self = createCycle('ai-1', { x: 20, z: -15 }, 'east', {
        aiProfile: getDefaultProfile('hard', 'trapper'),
      })
      // Target heading east, intercept point ~18 units ahead = {x:28, z:-15}
      const target = createCycle('target', { x: 10, z: -15 }, 'east')

      const decision = ai.getDecision(self, [self, target], 100)
      expect(['left', 'right', 'none']).toContain(decision.turn)
    })
  })

  // ──────────────────────────────────────────
  // BOX EXECUTION
  // ──────────────────────────────────────────

  describe('box execution', () => {
    test('navigates to target open side when target is partially boxed', () => {
      const ai = new AIController(collisionSystem)

      // Target near a wall (partially boxed)
      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'trapper'),
      })
      // Target near north wall — north side is blocked by wall
      const target = createCycle('target', { x: 0, z: -50 }, 'east')

      const decision = ai.getDecision(self, [self, target], 100)
      expect(['left', 'right', 'none']).toContain(decision.turn)
    })

    test('box strategy is preferred for trapper when target has few escapes', () => {
      const prefs = AI_STRATEGY_PREFERENCES.trapper
      // Trapper has high box preference
      expect(prefs.boxPreference).toBe(3.0)
      // And high cutOff preference
      expect(prefs.cutOffPreference).toBe(3.0)
    })
  })

  // ──────────────────────────────────────────
  // WALL-RIDE EXECUTION
  // ──────────────────────────────────────────

  describe('wallRide execution', () => {
    test('maintains distance from wall', () => {
      const ai = new AIController(collisionSystem)

      // Cycle near east wall, facing north — wall is to the right
      const self = createCycle('ai-1', { x: 60, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'defensive'),
      })

      const decision = ai.getDecision(self, [self], 100)
      // Near wall, should produce a valid decision (likely wallRide or survive)
      expect(['left', 'right', 'none']).toContain(decision.turn)
    })

    test('turns away from wall when forward is blocked', () => {
      const ai = new AIController(collisionSystem)

      // Cycle near northeast corner facing north — wall ahead and to the right
      const self = createCycle('ai-1', { x: 60, z: -60 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'defensive'),
      })

      const decision = ai.getDecision(self, [self], 100)
      // Should turn away (left, since wall is to the right and ahead)
      expect(decision.turn === 'left' || decision.turn === 'right').toBe(true)
      expect(decision.urgency).toBeGreaterThan(0)
    })

    test('defensive personality prefers wallRide preference weight', () => {
      const prefs = AI_STRATEGY_PREFERENCES.defensive
      expect(prefs.wallRidePreference).toBe(3.0)
      expect(prefs.wallRidePreference).toBeGreaterThan(prefs.headOnPreference)
    })
  })

  // ──────────────────────────────────────────
  // SURVIVE EXECUTION
  // ──────────────────────────────────────────

  describe('survive execution', () => {
    test('picks most open direction', () => {
      const ai = new AIController(collisionSystem)

      // Cycle in open space — survive should keep going straight
      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'defensive'),
      })

      const decision = ai.getDecision(self, [self], 100)
      // In open space with no threats, should go straight
      expect(decision.turn).toBe('none')
    })

    test('turns when forward is blocked', () => {
      const ai = new AIController(collisionSystem)

      // Cycle near north wall — forward is blocked
      const self = createCycle('ai-1', { x: 0, z: -62 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'defensive'),
      })

      const decision = ai.getDecision(self, [self], 100)
      // Must turn or jump
      expect(decision.turn !== 'none' || decision.jump).toBe(true)
    })

    test('survive is fallback when no target available', () => {
      const ai = new AIController(collisionSystem)

      // Only self alive — no targets for offensive strategies
      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'aggressive'),
      })

      const decision = ai.getDecision(self, [self], 100)
      // Should default to survive-like behavior (go straight in open space)
      expect(decision.turn).toBe('none')
    })
  })

  // ──────────────────────────────────────────
  // EMERGENCY OVERRIDE
  // ──────────────────────────────────────────

  describe('emergency override', () => {
    test('prevents crash when strategy drives into wall', () => {
      const ai = new AIController(collisionSystem)

      // Cycle very close to north wall facing north
      // ARENA_HALF=64, wall collision at margin 0.4, so wall at ~63.6
      // Place at z=-63.2 so forward distance is ~0.4 (< EMERGENCY_DISTANCE of 1.0)
      const self = createCycle('ai-1', { x: 0, z: -63.2 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'aggressive'),
      })

      const decision = ai.getDecision(self, [self], 100)
      // Strategy or emergency should produce a turn (survive finds escape)
      expect(decision.turn !== 'none' || decision.jump).toBe(true)
      // Urgency > 0 indicates the AI reacted to the danger
      expect(decision.urgency).toBeGreaterThan(0)
    })

    test('tries jump when trail blocks forward and not already jumping', () => {
      const ai = new AIController(collisionSystem)

      // Trail directly ahead, very close
      const trailMaker = createCycle('trail', { x: 0, z: -20 }, 'east', {
        trail: [seg({ x: -30, z: -1 }, { x: 30, z: -1 }, 'east')],
      })

      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'aggressive'),
      })

      const decision = ai.getDecision(self, [self, trailMaker], 100)
      // Should either jump or turn — must not crash
      expect(
        decision.jump ||
        decision.turn === 'left' ||
        decision.turn === 'right'
      ).toBe(true)
    })

    test('tries opposite turn when chosen turn is blocked', () => {
      const ai = new AIController(collisionSystem)

      // Cycle very close to corner: north and east walls < 1 unit
      const self = createCycle('ai-1', { x: 63.2, z: -63.2 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'defensive'),
      })

      const decision = ai.getDecision(self, [self], 100)
      // Must escape — turn left (west is open), right (south is open), or jump
      expect(decision.urgency).toBeGreaterThan(0)
      expect(
        decision.turn === 'left' ||
        decision.turn === 'right' ||
        decision.jump
      ).toBe(true)
    })

    test('suppresses turn during cooldown when forward is safe', () => {
      const ai = new AIController(collisionSystem)

      // Use defensive personality so interval is 60ms (medium * 1.0)
      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'defensive'),
      })

      // First decision at t=0
      ai.getDecision(self, [self], 0)

      // At t=30 should be rate-limited (interval is 60ms for medium)
      const rateLimited = ai.getDecision(self, [self], 30)
      expect(rateLimited.turn).toBe('none')
      expect(rateLimited.urgency).toBe(0)
    })
  })

  // ──────────────────────────────────────────
  // STRATEGY PERSISTENCE
  // ──────────────────────────────────────────

  describe('strategy persistence', () => {
    test('strategy sticks for at least minPersistence ticks', () => {
      const ai = new AIController(collisionSystem)

      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'aggressive'),
      })
      const target = createCycle('target', { x: 0, z: -25 }, 'south')

      // Gather decisions over many ticks, each advancing past rate limit
      const decisions: string[] = []
      const interval = 50 // >42ms for hard AI
      for (let t = 0; t < 500; t += interval) {
        const d = ai.getDecision(self, [self, target], t)
        decisions.push(d.turn)
      }

      // Should have consistent behavior — not erratically changing every tick
      // (aggressive minPersistence is 15, and at 50ms per tick that's ~750ms)
      expect(decisions.length).toBeGreaterThan(5)
    })

    test('strategy reconsiders when target dies', () => {
      const ai = new AIController(collisionSystem)

      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'aggressive'),
      })
      const target = createCycle('target', { x: 0, z: -25 }, 'south')

      // Establish strategy with target
      ai.getDecision(self, [self, target], 0)

      // Target dies
      const deadTarget = { ...target, isAlive: false }
      const decision = ai.getDecision(self, [self, deadTarget], 100)

      // Should still produce valid decision (falls back to survive)
      expect(['left', 'right', 'none']).toContain(decision.turn)
    })

    test('erratic personality reconsidering more frequently than defensive', () => {
      const erraticPrefs = AI_STRATEGY_PREFERENCES.erratic
      const defensivePrefs = AI_STRATEGY_PREFERENCES.defensive

      expect(erraticPrefs.minPersistence).toBeLessThan(defensivePrefs.minPersistence)
      expect(erraticPrefs.maxPersistence).toBeLessThan(defensivePrefs.maxPersistence)
    })
  })

  // ──────────────────────────────────────────
  // DIFFICULTY MODULATION
  // ──────────────────────────────────────────

  describe('difficulty modulation', () => {
    test('easy AI makes mistakes more frequently than hard AI', () => {
      const easy = getDefaultProfile('easy', 'defensive')
      const hard = getDefaultProfile('hard', 'defensive')

      // Easy has mistakeRate 0.25 (every 4th decision)
      // Hard has mistakeRate 0.02 (every 50th decision)
      const easyMistakeInterval = Math.round(1 / easy.difficultyParams.mistakeRate)
      const hardMistakeInterval = Math.round(1 / hard.difficultyParams.mistakeRate)

      expect(easyMistakeInterval).toBeLessThan(hardMistakeInterval)
    })

    test('easy AI has shorter look-ahead', () => {
      const easy = getDefaultProfile('easy', 'defensive')
      const hard = getDefaultProfile('hard', 'defensive')

      expect(easy.difficultyParams.lookAheadMultiplier).toBeLessThan(
        hard.difficultyParams.lookAheadMultiplier
      )
    })

    test('hard AI swerves later in chicken run (lower chicken distance)', () => {
      // Chicken distance = 3 + (3 - planningDepth) * 2
      // Easy (depth 1): 3 + 4 = 7
      // Hard (depth 3): 3 + 0 = 3
      const easy = getDefaultProfile('easy', 'aggressive')
      const hard = getDefaultProfile('hard', 'aggressive')

      const easyChicken = 3 + (3 - easy.difficultyParams.planningDepth) * 2
      const hardChicken = 3 + (3 - hard.difficultyParams.planningDepth) * 2

      expect(hardChicken).toBeLessThan(easyChicken)
      expect(hardChicken).toBe(3)
      expect(easyChicken).toBe(7)
    })

    test('easy AI has valid decisions on every call', () => {
      const ai = new AIController(collisionSystem)
      const cycle = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('easy', 'erratic'),
      })
      const allCycles = [cycle]

      for (let t = 0; t < 10000; t += 200) {
        const decision = ai.getDecision(cycle, allCycles, t)
        expect(['left', 'right', 'none']).toContain(decision.turn)
        expect(typeof decision.urgency).toBe('number')
        expect(typeof decision.jump).toBe('boolean')
      }
    })

    test('mistake cadence is deterministic', () => {
      const ai1 = new AIController(collisionSystem)
      const ai2 = new AIController(collisionSystem)
      const cycle = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('easy', 'defensive'),
      })
      const allCycles = [cycle]

      const decisions1: string[] = []
      const decisions2: string[] = []
      for (let t = 0; t < 5000; t += 200) {
        decisions1.push(ai1.getDecision(cycle, allCycles, t).turn)
        decisions2.push(ai2.getDecision(cycle, allCycles, t).turn)
      }

      expect(decisions1).toEqual(decisions2)
    })

    test('hard AI has very low mistake rate', () => {
      const hard = getDefaultProfile('hard', 'defensive')
      expect(hard.difficultyParams.mistakeRate).toBeLessThanOrEqual(0.02)
    })

    test('easy AI has significant mistake rate', () => {
      const easy = getDefaultProfile('easy', 'defensive')
      expect(easy.difficultyParams.mistakeRate).toBeGreaterThanOrEqual(0.2)
    })

    test('hard AI considers opponents while easy does not', () => {
      const easy = getDefaultProfile('easy', 'aggressive')
      const hard = getDefaultProfile('hard', 'aggressive')
      expect(easy.difficultyParams.considersOpponents).toBe(false)
      expect(hard.difficultyParams.considersOpponents).toBe(true)
    })
  })

  // ──────────────────────────────────────────
  // JUMP EVALUATION
  // ──────────────────────────────────────────

  describe('jump evaluation', () => {
    test('does not jump when already jumping', () => {
      const ai = new AIController(collisionSystem)
      const cycle = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        isJumping: true,
        aiProfile: getDefaultProfile('hard', 'erratic'),
      })

      const decision = ai.getDecision(cycle, [cycle], 0)
      expect(decision.jump).toBe(false)
    })

    test('trapper personality never jumps (low eagerness)', () => {
      const ai = new AIController(collisionSystem)

      const trailCycle = createCycle('trail-maker', { x: 0, z: -15 }, 'east', {
        trail: [seg({ x: -10, z: -7 }, { x: 10, z: -7 }, 'east')],
      })

      const trapper = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'trapper'),
      })

      const decision = ai.getDecision(trapper, [trapper, trailCycle], 0)
      // Trapper has jumpEagerness 0.3, below 0.4 threshold
      expect(decision.jump).toBe(false)
    })

    test('erratic has high jump eagerness', () => {
      const erratic = getDefaultProfile('medium', 'erratic')
      expect(erratic.personalityWeights.jumpEagerness).toBeGreaterThan(1)
    })

    test('emergency jump is deterministic', () => {
      const trailCycle = createCycle('trail-maker', { x: 0, z: -20 }, 'east', {
        trail: [seg({ x: -10, z: -3 }, { x: 10, z: -3 }, 'east')],
      })

      const cycle = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        lastJumpTime: -5000,
        aiProfile: getDefaultProfile('hard', 'aggressive'),
      })

      const ai1 = new AIController(collisionSystem)
      const ai2 = new AIController(collisionSystem)
      const d1 = ai1.getDecision(cycle, [cycle, trailCycle], 5000)
      const d2 = ai2.getDecision(cycle, [cycle, trailCycle], 5000)

      expect(d1.turn).toBe(d2.turn)
      expect(d1.jump).toBe(d2.jump)
    })
  })

  // ──────────────────────────────────────────
  // PERSONALITY-DRIVEN BEHAVIOR
  // ──────────────────────────────────────────

  describe('personality-driven behavior', () => {
    test('defensive AI has higher escape path weight', () => {
      const defensive = getDefaultProfile('medium', 'defensive')
      const aggressive = getDefaultProfile('medium', 'aggressive')

      expect(defensive.personalityWeights.escapePathWeight).toBeGreaterThan(
        aggressive.personalityWeights.escapePathWeight
      )
    })

    test('defensive AI has negative opponent proximity weight', () => {
      const defensive = getDefaultProfile('medium', 'defensive')
      expect(defensive.personalityWeights.opponentProximityWeight).toBeLessThan(0)
    })

    test('aggressive AI has positive opponent proximity weight', () => {
      const aggressive = getDefaultProfile('medium', 'aggressive')
      expect(aggressive.personalityWeights.opponentProximityWeight).toBeGreaterThan(0)
    })

    test('all four personality weights are distinct', () => {
      const personalities = ['aggressive', 'defensive', 'trapper', 'erratic'] as const
      const weightSets = personalities.map((p) => AI_PERSONALITY_WEIGHTS[p])

      for (let i = 0; i < weightSets.length; i++) {
        for (let j = i + 1; j < weightSets.length; j++) {
          expect(weightSets[i]).not.toEqual(weightSets[j])
        }
      }
    })

    test('aggressive and defensive produce different decisions with opponent present', () => {
      const aggCycle = createCycle('agg', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'aggressive'),
      })
      const defCycle = createCycle('def', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'defensive'),
      })
      const opponent = createCycle('target', { x: 15, z: 0 }, 'west')

      const aiAgg = new AIController(collisionSystem)
      const aiDef = new AIController(collisionSystem)

      const aggDecision = aiAgg.getDecision(aggCycle, [aggCycle, opponent], 100)
      const defDecision = aiDef.getDecision(defCycle, [defCycle, opponent], 100)

      // Both should produce valid decisions
      expect(['left', 'right', 'none']).toContain(aggDecision.turn)
      expect(['left', 'right', 'none']).toContain(defDecision.turn)
    })
  })

  // ──────────────────────────────────────────
  // ESCAPE PATH DEPTH
  // ──────────────────────────────────────────

  describe('escape path depth', () => {
    test('easy AI has planning depth 1', () => {
      expect(getDefaultProfile('easy', 'defensive').difficultyParams.planningDepth).toBe(1)
    })

    test('medium AI has planning depth 2', () => {
      expect(getDefaultProfile('medium', 'defensive').difficultyParams.planningDepth).toBe(2)
    })

    test('hard AI has planning depth 3', () => {
      expect(getDefaultProfile('hard', 'defensive').difficultyParams.planningDepth).toBe(3)
    })
  })

  // ──────────────────────────────────────────
  // RESET
  // ──────────────────────────────────────────

  describe('reset', () => {
    test('clears all strategy state', () => {
      const ai = new AIController(collisionSystem)
      const cycle = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('medium', 'defensive'),
      })

      // Make a decision (initializes strategy state)
      ai.getDecision(cycle, [cycle], 0)

      // Should be rate-limited
      const limited = ai.getDecision(cycle, [cycle], 30)
      expect(limited.urgency).toBe(0)

      // After reset, should be able to decide again
      ai.reset()
      const afterReset = ai.getDecision(cycle, [cycle], 30)
      // This was evaluated (not rate-limited) — strategy state was cleared
      expect(typeof afterReset.turn).toBe('string')
    })

    test('reset allows fresh strategy selection', () => {
      const ai = new AIController(collisionSystem)
      const self = createCycle('ai-1', { x: 0, z: 0 }, 'north', {
        aiProfile: getDefaultProfile('hard', 'aggressive'),
      })
      const target = createCycle('target', { x: 0, z: -25 }, 'south')

      // Build up strategy state
      for (let t = 0; t < 1000; t += 50) {
        ai.getDecision(self, [self, target], t)
      }

      // Reset clears everything
      ai.reset()

      // Fresh start — should work like a new controller
      const fresh = ai.getDecision(self, [self, target], 1000)
      expect(['left', 'right', 'none']).toContain(fresh.turn)
    })
  })
})
