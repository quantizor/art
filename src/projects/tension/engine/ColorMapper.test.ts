import { describe, expect, it } from 'bun:test'
import { clumpSpeckleWeight, fineSpeckleWeight, grainWindowDepth } from './ColorMapper'

/**
 * Trapped sediment: dark particles dusted into the first light band deposited
 * on the cavity wall. The visual character rests on two rules, so both are
 * pinned here. The window depth scales with the band's own span, and the fine
 * dust thins to nothing by the far edge of that window instead of clipping to
 * a rim.
 */

const BAND_IDX = 1
const HUE_KEY = 180

/** Samples a patch wide enough to span many lattice cells at both pitches. */
function coverage(
  weightAt: (dx: number, dy: number, distRatio: number) => number,
  distRatio: number,
): { covered: number; samples: number; maxWeight: number } {
  let covered = 0
  let samples = 0
  let maxWeight = 0
  for (let dy = 200; dy < 320; dy++) {
    for (let dx = 200; dx < 320; dx++) {
      const w = weightAt(dx, dy, distRatio)
      samples++
      if (w > 0) covered++
      if (w > maxWeight) maxWeight = w
    }
  }
  return { covered, samples, maxWeight }
}

const fine = (dx: number, dy: number, distRatio: number) =>
  fineSpeckleWeight(dx, dy, BAND_IDX, HUE_KEY, distRatio)
const clump = (dx: number, dy: number, distRatio: number) =>
  clumpSpeckleWeight(dx, dy, BAND_IDX, HUE_KEY, distRatio)

describe('grainWindowDepth', () => {
  it('scales with half the band span', () => {
    expect(grainWindowDepth(40)).toBe(20)
    expect(grainWindowDepth(120)).toBe(60)
  })

  it('keeps a floor so a hair-thin band still takes sediment at the contact', () => {
    expect(grainWindowDepth(0)).toBe(1.5)
    expect(grainWindowDepth(2)).toBe(1.5)
  })

  it('caps depth so a fat central pool does not become a dust field', () => {
    expect(grainWindowDepth(160)).toBe(80)
    expect(grainWindowDepth(4000)).toBe(80)
  })

  it('reaches well past the retired fixed 6.5-cell window for a fat band', () => {
    // A zonal quiet zone spans on the order of hundreds of cells. Dust that
    // stopped at 6.5 cells read as a clean ring around the shell.
    expect(grainWindowDepth(300)).toBeGreaterThan(6.5)
  })

  it('never shrinks as the band widens', () => {
    let previous = 0
    for (let span = 0; span <= 400; span += 5) {
      const depth = grainWindowDepth(span)
      expect(depth).toBeGreaterThanOrEqual(previous)
      previous = depth
    }
  })
})

describe('fineSpeckleWeight', () => {
  it('dusts part of the patch without covering it', () => {
    const { covered, samples } = coverage(fine, 0.1)
    expect(covered).toBeGreaterThan(0)
    expect(covered).toBeLessThan(samples)
  })

  it('returns coverage weights within 0..1', () => {
    const { maxWeight } = coverage(fine, 0.1)
    expect(maxWeight).toBeGreaterThan(0)
    expect(maxWeight).toBeLessThanOrEqual(1)
  })

  it('thins with depth into the band', () => {
    const near = coverage(fine, 0.05).covered
    const middle = coverage(fine, 0.5).covered
    const far = coverage(fine, 0.9).covered
    expect(near).toBeGreaterThan(middle)
    expect(middle).toBeGreaterThan(far)
  })

  it('still places occasional specks near the far edge', () => {
    // Density decays to zero rather than stopping short, so the dusting fades
    // instead of ending on a visible edge.
    expect(coverage(fine, 0.9).covered).toBeGreaterThan(0)
  })

  it('places nothing at or past the window edge', () => {
    expect(coverage(fine, 1).covered).toBe(0)
    expect(coverage(fine, 1.4).covered).toBe(0)
  })
})

describe('clumpSpeckleWeight', () => {
  it('settles rare groupings near the contact', () => {
    const clumps = coverage(clump, 0.1)
    expect(clumps.covered).toBeGreaterThan(0)
    // Aggregates are far rarer than the fine dust they sit among.
    expect(clumps.covered).toBeLessThan(coverage(fine, 0.1).covered)
  })

  it('stops at the outer 45% of the window', () => {
    expect(coverage(clump, 0.44).covered).toBeGreaterThan(0)
    expect(coverage(clump, 0.45).covered).toBe(0)
    expect(coverage(clump, 0.8).covered).toBe(0)
  })
})
