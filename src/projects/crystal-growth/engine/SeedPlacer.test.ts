/**
 * SeedPlacer Tests
 *
 * Tests for Poisson disk seed placement.
 */

import { describe, test, expect } from 'bun:test'
import { generateSeedPositions } from './SeedPlacer'

describe('generateSeedPositions', () => {
  test('returns requested number of seeds', () => {
    const positions = generateSeedPositions(40, 512, 512, 55)
    expect(positions.length).toBe(40)
  })

  test('all positions are within grid bounds with margin', () => {
    const margin = 10
    const positions = generateSeedPositions(30, 512, 512, 55, margin)
    for (const p of positions) {
      expect(p.x).toBeGreaterThanOrEqual(margin)
      expect(p.x).toBeLessThanOrEqual(512 - margin)
      expect(p.y).toBeGreaterThanOrEqual(margin)
      expect(p.y).toBeLessThanOrEqual(512 - margin)
    }
  })

  test('no two seeds are closer than minDistance', () => {
    const minDistance = 55
    const positions = generateSeedPositions(40, 512, 512, minDistance)
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x
        const dy = positions[i].y - positions[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        expect(dist).toBeGreaterThanOrEqual(minDistance)
      }
    }
  })

  test('returns integer coordinates', () => {
    const positions = generateSeedPositions(20, 512, 512, 55)
    for (const p of positions) {
      expect(p.x).toBe(Math.round(p.x))
      expect(p.y).toBe(Math.round(p.y))
    }
  })

  test('handles very large minDistance by returning fewer seeds', () => {
    // With minDistance=500 on a 512x512 grid, only ~1 seed should fit
    const positions = generateSeedPositions(40, 512, 512, 500)
    expect(positions.length).toBeGreaterThanOrEqual(1)
    expect(positions.length).toBeLessThan(40)
  })

  test('respects custom margin', () => {
    const margin = 50
    const positions = generateSeedPositions(10, 512, 512, 30, margin)
    for (const p of positions) {
      expect(p.x).toBeGreaterThanOrEqual(margin)
      expect(p.x).toBeLessThanOrEqual(512 - margin)
      expect(p.y).toBeGreaterThanOrEqual(margin)
      expect(p.y).toBeLessThanOrEqual(512 - margin)
    }
  })

  test('returns empty array for zero count', () => {
    const positions = generateSeedPositions(0, 512, 512, 55)
    expect(positions.length).toBe(0)
  })
})
