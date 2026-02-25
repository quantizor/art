/**
 * ColorMapper Tests
 *
 * Tests for birefringence angle-to-color mapping.
 */

import { describe, test, expect } from 'bun:test'
import { computeColor, computePolarizedColor, computeDichroismColor, computeLaueColor, computeConoscopicColor, hslToRgb, oklchToRgb, thinFilmSpectrum, cellHash, applyStrainEffects } from './ColorMapper'
import type { ColorParams } from '../types'

const defaultParams: ColorParams = {
  mode: 'birefringence',
  bandWavelength: 12,
  bandAmplitude: 0.3,
  baseLightness: 0.55,
  saturation: 0.85,
  monoHue: 200,
}

describe('oklchToRgb', () => {
  test('black (L=0)', () => {
    const c = oklchToRgb(0, 0, 0)
    expect(c.r).toBeCloseTo(0, 1)
    expect(c.g).toBeCloseTo(0, 1)
    expect(c.b).toBeCloseTo(0, 1)
  })

  test('white (L=1)', () => {
    const c = oklchToRgb(1, 0, 0)
    expect(c.r).toBeCloseTo(1, 1)
    expect(c.g).toBeCloseTo(1, 1)
    expect(c.b).toBeCloseTo(1, 1)
  })

  test('gray (C=0)', () => {
    const c = oklchToRgb(0.5, 0, 0)
    // All channels should be equal (achromatic)
    expect(Math.abs(c.r - c.g)).toBeLessThan(0.01)
    expect(Math.abs(c.g - c.b)).toBeLessThan(0.01)
  })

  test('different hues produce different colors', () => {
    const c1 = oklchToRgb(0.7, 0.15, 30)
    const c2 = oklchToRgb(0.7, 0.15, 150)
    const c3 = oklchToRgb(0.7, 0.15, 270)
    const diff12 = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    const diff13 = Math.abs(c1.r - c3.r) + Math.abs(c1.g - c3.g) + Math.abs(c1.b - c3.b)
    expect(diff12).toBeGreaterThan(0.1)
    expect(diff13).toBeGreaterThan(0.1)
  })

  test('higher chroma produces more saturated colors', () => {
    const lowC = oklchToRgb(0.7, 0.05, 30)
    const highC = oklchToRgb(0.7, 0.25, 30)
    const avgLow = (lowC.r + lowC.g + lowC.b) / 3
    const devLow = Math.abs(lowC.r - avgLow) + Math.abs(lowC.g - avgLow) + Math.abs(lowC.b - avgLow)
    const avgHigh = (highC.r + highC.g + highC.b) / 3
    const devHigh = Math.abs(highC.r - avgHigh) + Math.abs(highC.g - avgHigh) + Math.abs(highC.b - avgHigh)
    expect(devHigh).toBeGreaterThan(devLow)
  })

  test('values are clamped to 0-1', () => {
    // High chroma at extreme hue may go out of gamut
    const c = oklchToRgb(0.5, 0.35, 150)
    expect(c.r).toBeGreaterThanOrEqual(0)
    expect(c.r).toBeLessThanOrEqual(1)
    expect(c.g).toBeGreaterThanOrEqual(0)
    expect(c.g).toBeLessThanOrEqual(1)
    expect(c.b).toBeGreaterThanOrEqual(0)
    expect(c.b).toBeLessThanOrEqual(1)
  })
})

describe('hslToRgb (OKLCH-backed)', () => {
  test('black (lightness 0)', () => {
    const c = hslToRgb(0, 1, 0)
    expect(c.r).toBeCloseTo(0, 1)
    expect(c.g).toBeCloseTo(0, 1)
    expect(c.b).toBeCloseTo(0, 1)
  })

  test('white (lightness 1)', () => {
    const c = hslToRgb(0, 1, 1)
    expect(c.r).toBeCloseTo(1, 1)
    expect(c.g).toBeCloseTo(1, 1)
    expect(c.b).toBeCloseTo(1, 1)
  })

  test('different hues produce different colors', () => {
    const c1 = hslToRgb(0, 0.8, 0.5)
    const c2 = hslToRgb(120, 0.8, 0.5)
    const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    expect(diff).toBeGreaterThan(0.1)
  })
})

describe('computeColor', () => {
  test('birefringence mode: angle 0 and angle PI produce different hues', () => {
    // Use dist > smoothing radius (5) so angle influence is fully active
    const c1 = computeColor(0, 10, defaultParams)
    const c2 = computeColor(Math.PI / 2, 10, defaultParams)
    // Different angles should produce different colors
    const diffR = Math.abs(c1.r - c2.r)
    const diffG = Math.abs(c1.g - c2.g)
    const diffB = Math.abs(c1.b - c2.b)
    expect(diffR + diffG + diffB).toBeGreaterThan(0.1)
  })

  test('birefringence mode: wraps hue twice per 360deg', () => {
    // angle 0 and angle PI should give the same hue (2x wrapping)
    const c1 = computeColor(0, 10, defaultParams)
    const c2 = computeColor(Math.PI, 10, defaultParams)
    expect(c1.r).toBeCloseTo(c2.r, 1)
    expect(c1.g).toBeCloseTo(c2.g, 1)
    expect(c1.b).toBeCloseTo(c2.b, 1)
  })

  test('distance creates smooth monotonic color gradient', () => {
    // Color should change smoothly with distance, not periodically
    const c1 = computeColor(0, 0, defaultParams)
    const c2 = computeColor(0, 50, defaultParams)
    const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    expect(diff).toBeGreaterThan(0.01)
  })

  test('distance gradient saturates at large distances', () => {
    // tanh gradient should converge — very distant points look similar
    const c1 = computeColor(0, 200, defaultParams)
    const c2 = computeColor(0, 500, defaultParams)
    expect(c1.r).toBeCloseTo(c2.r, 1)
    expect(c1.g).toBeCloseTo(c2.g, 1)
    expect(c1.b).toBeCloseTo(c2.b, 1)
  })

  test('rainbow mode: maps angle directly to full hue range', () => {
    const params: ColorParams = { ...defaultParams, mode: 'rainbow' }
    // Use dist > smoothing radius (5) so angle influence is fully active
    const c1 = computeColor(0, 10, params)
    const c2 = computeColor(Math.PI, 10, params)
    // Should be different since rainbow maps angle * 1 (not * 2)
    const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    expect(diff).toBeGreaterThan(0.1)
  })

  test('monochrome mode: angle drives lightness variation for contrast', () => {
    const params: ColorParams = { ...defaultParams, mode: 'monochrome' }
    const c1 = computeColor(0, 5, params)
    const c2 = computeColor(Math.PI / 2, 5, params)
    // Different angles should produce different lightness (contrast)
    const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    expect(diff).toBeGreaterThan(0.1)
  })

  test('output values are in 0-1 range', () => {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
      for (let dist = 0; dist < 50; dist += 5) {
        const c = computeColor(angle, dist, defaultParams)
        expect(c.r).toBeGreaterThanOrEqual(0)
        expect(c.r).toBeLessThanOrEqual(1)
        expect(c.g).toBeGreaterThanOrEqual(0)
        expect(c.g).toBeLessThanOrEqual(1)
        expect(c.b).toBeGreaterThanOrEqual(0)
        expect(c.b).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('thinFilmSpectrum', () => {
  test('output is in 0-1 range for all inputs', () => {
    for (let t = 0; t < 1; t += 0.05) {
      const c = thinFilmSpectrum(t)
      expect(c.r).toBeGreaterThanOrEqual(0)
      expect(c.r).toBeLessThanOrEqual(1)
      expect(c.g).toBeGreaterThanOrEqual(0)
      expect(c.g).toBeLessThanOrEqual(1)
      expect(c.b).toBeGreaterThanOrEqual(0)
      expect(c.b).toBeLessThanOrEqual(1)
    }
  })

  test('is periodic (t=0 and t=1 produce same color)', () => {
    const c1 = thinFilmSpectrum(0)
    const c2 = thinFilmSpectrum(1)
    expect(c1.r).toBeCloseTo(c2.r, 2)
    expect(c1.g).toBeCloseTo(c2.g, 2)
    expect(c1.b).toBeCloseTo(c2.b, 2)
  })

  test('produces vivid non-gray colors at mid-range', () => {
    const c = thinFilmSpectrum(0.33)
    const avg = (c.r + c.g + c.b) / 3
    const deviation = Math.abs(c.r - avg) + Math.abs(c.g - avg) + Math.abs(c.b - avg)
    expect(deviation).toBeGreaterThan(0.1) // not gray
  })
})

describe('cellHash', () => {
  test('returns values in 0-1 range', () => {
    for (let x = 0; x < 100; x += 7) {
      for (let y = 0; y < 100; y += 7) {
        const h = cellHash(x, y)
        expect(h).toBeGreaterThanOrEqual(0)
        expect(h).toBeLessThanOrEqual(1)
      }
    }
  })

  test('different coordinates produce different hashes', () => {
    const h1 = cellHash(10, 20)
    const h2 = cellHash(10, 21)
    const h3 = cellHash(11, 20)
    expect(h1).not.toBeCloseTo(h2, 5)
    expect(h1).not.toBeCloseTo(h3, 5)
  })

  test('is deterministic', () => {
    expect(cellHash(42, 99)).toBe(cellHash(42, 99))
  })
})

describe('polarized mode', () => {
  const polarizedParams: ColorParams = {
    mode: 'polarized',
    bandWavelength: 12,
    bandAmplitude: 0.15,
    baseLightness: 0.55,
    saturation: 0.95,
    monoHue: 200,
  }

  test('produces colors in valid RGB range', () => {
    for (let orientation = 0; orientation < Math.PI; orientation += 0.2) {
      for (let dist = 0; dist < 80; dist += 10) {
        const c = computePolarizedColor(orientation, dist, polarizedParams)
        expect(c.r).toBeGreaterThanOrEqual(0)
        expect(c.r).toBeLessThanOrEqual(1)
        expect(c.g).toBeGreaterThanOrEqual(0)
        expect(c.g).toBeLessThanOrEqual(1)
        expect(c.b).toBeGreaterThanOrEqual(0)
        expect(c.b).toBeLessThanOrEqual(1)
      }
    }
  })

  test('different orientations produce different colors', () => {
    const c1 = computePolarizedColor(0, 10, polarizedParams)
    const c2 = computePolarizedColor(Math.PI / 3, 10, polarizedParams)
    const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    expect(diff).toBeGreaterThan(0.05)
  })

  test('same orientation at same distance produces similar colors (grain unity)', () => {
    // Two nearby pixels in the same grain should be similar
    const c1 = computePolarizedColor(1.0, 10, polarizedParams)
    const c2 = computePolarizedColor(1.0, 12, polarizedParams)
    const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    expect(diff).toBeLessThan(0.5) // similar, not identical
  })

  test('produces vivid non-gray colors', () => {
    const c = computePolarizedColor(Math.PI / 4, 15, polarizedParams)
    const avg = (c.r + c.g + c.b) / 3
    const saturation = Math.abs(c.r - avg) + Math.abs(c.g - avg) + Math.abs(c.b - avg)
    expect(saturation).toBeGreaterThan(0.1)
  })

  test('computeColor with polarized mode delegates correctly', () => {
    const c1 = computeColor(0, 10, polarizedParams, Math.PI / 4)
    const c2 = computePolarizedColor(Math.PI / 4, 10, polarizedParams)
    expect(c1.r).toBeCloseTo(c2.r, 5)
    expect(c1.g).toBeCloseTo(c2.g, 5)
    expect(c1.b).toBeCloseTo(c2.b, 5)
  })
})

describe('oilslick mode', () => {
  const oilslickParams: ColorParams = {
    mode: 'oilslick',
    bandWavelength: 12,
    bandAmplitude: 0.15,
    baseLightness: 0.55,
    saturation: 0.95,
    monoHue: 200,
  }

  test('produces colors in valid RGB range', () => {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
      for (let dist = 0; dist < 60; dist += 5) {
        const c = computeColor(angle, dist, oilslickParams)
        expect(c.r).toBeGreaterThanOrEqual(0)
        expect(c.r).toBeLessThanOrEqual(1)
        expect(c.g).toBeGreaterThanOrEqual(0)
        expect(c.g).toBeLessThanOrEqual(1)
        expect(c.b).toBeGreaterThanOrEqual(0)
        expect(c.b).toBeLessThanOrEqual(1)
      }
    }
  })

  test('different angles produce different colors', () => {
    // Use PI/4 and PI/2 — the doubling makes 0 and PI/2 equivalent
    const c1 = computeColor(0, 10, oilslickParams)
    const c2 = computeColor(Math.PI / 4, 10, oilslickParams)
    const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    expect(diff).toBeGreaterThan(0.05)
  })

  test('produces vivid non-gray colors', () => {
    const c = computeColor(Math.PI / 4, 15, oilslickParams)
    const avg = (c.r + c.g + c.b) / 3
    const saturation = Math.abs(c.r - avg) + Math.abs(c.g - avg) + Math.abs(c.b - avg)
    expect(saturation).toBeGreaterThan(0.1)
  })
})

describe('applyStrainEffects', () => {
  test('zero pressure returns original color unchanged', () => {
    const color = { r: 0.5, g: 0.3, b: 0.7 }
    const result = applyStrainEffects(color, 0, 0, 10)
    expect(result.r).toBeCloseTo(color.r, 5)
    expect(result.g).toBeCloseTo(color.g, 5)
    expect(result.b).toBeCloseTo(color.b, 5)
  })

  test('positive pressure shifts color away from base', () => {
    const color = { r: 0.5, g: 0.3, b: 0.7 }
    const strained = applyStrainEffects(color, 1.0, Math.PI / 4, 20)
    const diff = Math.abs(strained.r - color.r) + Math.abs(strained.g - color.g) + Math.abs(strained.b - color.b)
    expect(diff).toBeGreaterThan(0.05)
  })

  test('higher pressure produces stronger effect', () => {
    const color = { r: 0.5, g: 0.3, b: 0.7 }
    const mild = applyStrainEffects(color, 0.5, 1, 15)
    const strong = applyStrainEffects(color, 2.0, 1, 15)
    const diffMild = Math.abs(mild.r - color.r) + Math.abs(mild.g - color.g) + Math.abs(mild.b - color.b)
    const diffStrong = Math.abs(strong.r - color.r) + Math.abs(strong.g - color.g) + Math.abs(strong.b - color.b)
    expect(diffStrong).toBeGreaterThan(diffMild)
  })

  test('output remains in 0-1 range across all inputs', () => {
    for (let p = 0; p < 3; p += 0.5) {
      for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
        for (let dist = 0; dist < 60; dist += 10) {
          const c = applyStrainEffects({ r: 0.8, g: 0.2, b: 0.5 }, p, angle, dist)
          expect(c.r).toBeGreaterThanOrEqual(0)
          expect(c.r).toBeLessThanOrEqual(1)
          expect(c.g).toBeGreaterThanOrEqual(0)
          expect(c.g).toBeLessThanOrEqual(1)
          expect(c.b).toBeGreaterThanOrEqual(0)
          expect(c.b).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  test('pressure is clamped at maximum of 2', () => {
    const color = { r: 0.5, g: 0.3, b: 0.7 }
    const atMax = applyStrainEffects(color, 2.0, 1, 15)
    const beyondMax = applyStrainEffects(color, 5.0, 1, 15)
    expect(atMax.r).toBeCloseTo(beyondMax.r, 5)
    expect(atMax.g).toBeCloseTo(beyondMax.g, 5)
    expect(atMax.b).toBeCloseTo(beyondMax.b, 5)
  })

  test('strain adds chromatic variation (not just brightness shift)', () => {
    const color = { r: 0.5, g: 0.5, b: 0.5 }
    const strained = applyStrainEffects(color, 1.5, Math.PI / 3, 20)
    // The strain should break the gray uniformity
    const avg = (strained.r + strained.g + strained.b) / 3
    const deviation = Math.abs(strained.r - avg) + Math.abs(strained.g - avg) + Math.abs(strained.b - avg)
    expect(deviation).toBeGreaterThan(0.01)
  })
})

describe('computeColor with boundaryPressure', () => {
  test('boundaryPressure 0 matches base color', () => {
    const c1 = computeColor(1, 20, defaultParams, undefined, undefined, 0)
    const c2 = computeColor(1, 20, defaultParams)
    expect(c1.r).toBeCloseTo(c2.r, 5)
    expect(c1.g).toBeCloseTo(c2.g, 5)
    expect(c1.b).toBeCloseTo(c2.b, 5)
  })

  test('boundaryPressure > 0 modifies color', () => {
    const base = computeColor(1, 20, defaultParams, undefined, undefined, 0)
    const strained = computeColor(1, 20, defaultParams, undefined, undefined, 1.5)
    const diff = Math.abs(base.r - strained.r) + Math.abs(base.g - strained.g) + Math.abs(base.b - strained.b)
    expect(diff).toBeGreaterThan(0.05)
  })

  test('works with polarized mode', () => {
    const polarizedParams: ColorParams = { ...defaultParams, mode: 'polarized' }
    const base = computeColor(0, 20, polarizedParams, Math.PI / 4, 0, 0)
    const strained = computeColor(0, 20, polarizedParams, Math.PI / 4, 0, 1.5)
    const diff = Math.abs(base.r - strained.r) + Math.abs(base.g - strained.g) + Math.abs(base.b - strained.b)
    expect(diff).toBeGreaterThan(0.05)
  })
})

// ──────────────────────────────────────────────────
// Dichroism mode tests
// ──────────────────────────────────────────────────

describe('dichroism mode', () => {
  const dichroismParams: ColorParams = {
    mode: 'dichroism',
    bandWavelength: 12,
    bandAmplitude: 0.15,
    baseLightness: 0.55,
    saturation: 0.85,
    monoHue: 200,
  }

  test('produces colors in valid RGB range', () => {
    for (let orientation = 0; orientation < Math.PI; orientation += 0.3) {
      for (let dist = 0; dist < 80; dist += 10) {
        for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
          const c = computeDichroismColor(angle, dist, dichroismParams, orientation, 0.1)
          expect(c.r).toBeGreaterThanOrEqual(0)
          expect(c.r).toBeLessThanOrEqual(1)
          expect(c.g).toBeGreaterThanOrEqual(0)
          expect(c.g).toBeLessThanOrEqual(1)
          expect(c.b).toBeGreaterThanOrEqual(0)
          expect(c.b).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  test('different seed orientations produce different color pairs', () => {
    const c1 = computeDichroismColor(0, 20, dichroismParams, 0, 0)
    const c2 = computeDichroismColor(0, 20, dichroismParams, Math.PI / 3, 0)
    const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    expect(diff).toBeGreaterThan(0.05)
  })

  test('perpendicular angles within same grain produce contrasting colors', () => {
    // Dichroism means two colors depending on viewing direction vs optical axis
    const c1 = computeDichroismColor(0, 30, dichroismParams, 0, 0)
    const c2 = computeDichroismColor(Math.PI / 2, 30, dichroismParams, 0, 0)
    const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    expect(diff).toBeGreaterThan(0.1)
  })

  test('parallel angles produce similar colors (cos^2 symmetry)', () => {
    // Angles 0 and PI should produce identical dichroic response
    const c1 = computeDichroismColor(0, 30, dichroismParams, 0.5, 0)
    const c2 = computeDichroismColor(Math.PI, 30, dichroismParams, 0.5, 0)
    expect(c1.r).toBeCloseTo(c2.r, 1)
    expect(c1.g).toBeCloseTo(c2.g, 1)
    expect(c1.b).toBeCloseTo(c2.b, 1)
  })

  test('computeColor delegates correctly for dichroism mode', () => {
    const tilt = 0.1
    const c1 = computeColor(1.0, 20, dichroismParams, Math.PI / 4, tilt)
    const c2 = computeDichroismColor(1.0, 20, dichroismParams, Math.PI / 4, tilt)
    // computeColor applies universal tilt brightness: 0.35 + 0.65 * cos²(tilt)
    const brightness = 0.35 + 0.65 * Math.pow(Math.cos(tilt), 2)
    expect(c1.r).toBeCloseTo(c2.r * brightness, 5)
    expect(c1.g).toBeCloseTo(c2.g * brightness, 5)
    expect(c1.b).toBeCloseTo(c2.b * brightness, 5)
  })

  test('produces non-gray colors (dichroic character)', () => {
    const c = computeDichroismColor(Math.PI / 4, 25, dichroismParams, 1.0, 0.1)
    const avg = (c.r + c.g + c.b) / 3
    const deviation = Math.abs(c.r - avg) + Math.abs(c.g - avg) + Math.abs(c.b - avg)
    expect(deviation).toBeGreaterThan(0.05)
  })
})

// ──────────────────────────────────────────────────
// Laue diffraction mode tests
// ──────────────────────────────────────────────────

describe('laue mode', () => {
  const laueParams: ColorParams = {
    mode: 'laue',
    bandWavelength: 12,
    bandAmplitude: 0.15,
    baseLightness: 0.55,
    saturation: 0.85,
    monoHue: 200,
  }

  test('produces colors in valid RGB range', () => {
    for (let orientation = 0; orientation < Math.PI; orientation += 0.4) {
      for (let dist = 0; dist < 100; dist += 10) {
        for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
          const c = computeLaueColor(angle, dist, laueParams, orientation, 0.1)
          expect(c.r).toBeGreaterThanOrEqual(0)
          expect(c.r).toBeLessThanOrEqual(1)
          expect(c.g).toBeGreaterThanOrEqual(0)
          expect(c.g).toBeLessThanOrEqual(1)
          expect(c.b).toBeGreaterThanOrEqual(0)
          expect(c.b).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  test('has mostly dark background (X-ray film characteristic)', () => {
    // Sample many points — most should be dark since diffraction spots are sparse
    let darkCount = 0
    const totalSamples = 100
    for (let i = 0; i < totalSamples; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * 80
      const c = computeLaueColor(angle, dist, laueParams, 1.0, 0.1)
      const brightness = (c.r + c.g + c.b) / 3
      if (brightness < 0.3) darkCount++
    }
    // At least 30% of samples should be relatively dark
    expect(darkCount).toBeGreaterThan(totalSamples * 0.3)
  })

  test('different seed orientations produce different patterns', () => {
    const c1 = computeLaueColor(0.5, 20, laueParams, 0, 0)
    const c2 = computeLaueColor(0.5, 20, laueParams, Math.PI / 4, 0)
    const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    expect(diff).toBeGreaterThan(0.01)
  })

  test('average intensity decreases with distance (envelope falloff)', () => {
    // The envelope exp(-dist*0.008) guarantees long-range falloff.
    // Individual spots are oscillatory, so we average over multiple angles
    // to smooth out the diffraction peaks and test the envelope trend.
    const avgBrightness = (dist: number): number => {
      let sum = 0
      const samples = 20
      for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * Math.PI * 2
        const c = computeLaueColor(angle, dist, laueParams, 0, 0)
        sum += c.r + c.g + c.b
      }
      return sum / samples
    }
    const nearAvg = avgBrightness(10)
    const farAvg = avgBrightness(300)
    expect(nearAvg).toBeGreaterThan(farAvg)
  })

  test('computeColor delegates correctly for laue mode', () => {
    const tilt = 0.1
    const c1 = computeColor(1.0, 20, laueParams, Math.PI / 4, tilt)
    const c2 = computeLaueColor(1.0, 20, laueParams, Math.PI / 4, tilt)
    const brightness = 0.35 + 0.65 * Math.pow(Math.cos(tilt), 2)
    expect(c1.r).toBeCloseTo(c2.r * brightness, 5)
    expect(c1.g).toBeCloseTo(c2.g * brightness, 5)
    expect(c1.b).toBeCloseTo(c2.b * brightness, 5)
  })

  test('has some bright spots (diffraction maxima)', () => {
    // Sample many points — at least some should be bright (diffraction spots)
    let brightCount = 0
    const totalSamples = 200
    for (let i = 0; i < totalSamples; i++) {
      const angle = (i / totalSamples) * Math.PI * 2
      const dist = 10 + (i % 20) * 3
      const c = computeLaueColor(angle, dist, laueParams, 0, 0)
      const brightness = (c.r + c.g + c.b) / 3
      if (brightness > 0.15) brightCount++
    }
    expect(brightCount).toBeGreaterThan(0)
  })
})

// ──────────────────────────────────────────────────
// Conoscopic interference figure mode tests
// ──────────────────────────────────────────────────

describe('conoscopic mode', () => {
  const conoscopicParams: ColorParams = {
    mode: 'conoscopic',
    bandWavelength: 12,
    bandAmplitude: 0.15,
    baseLightness: 0.55,
    saturation: 0.85,
    monoHue: 200,
  }

  test('produces colors in valid RGB range', () => {
    for (let orientation = 0; orientation < Math.PI; orientation += 0.4) {
      for (let dist = 0; dist < 80; dist += 10) {
        for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
          const c = computeConoscopicColor(angle, dist, conoscopicParams, orientation, 0.1)
          expect(c.r).toBeGreaterThanOrEqual(0)
          expect(c.r).toBeLessThanOrEqual(1)
          expect(c.g).toBeGreaterThanOrEqual(0)
          expect(c.g).toBeLessThanOrEqual(1)
          expect(c.b).toBeGreaterThanOrEqual(0)
          expect(c.b).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  test('has dark cross pattern (isogyre extinction)', () => {
    // Along the optical axis direction, the isogyre should create dark pixels
    const orientation = 0
    // Angle aligned with optical axis (0 or PI/2) should be darker
    const aligned = computeConoscopicColor(0, 30, conoscopicParams, orientation, 0)
    // Angle at 45 degrees to axis should be brighter (between isogyre arms)
    const diagonal = computeConoscopicColor(Math.PI / 4, 30, conoscopicParams, orientation, 0)

    const alignedBrightness = aligned.r + aligned.g + aligned.b
    const diagonalBrightness = diagonal.r + diagonal.g + diagonal.b

    // The diagonal should be brighter than the aligned direction (dark cross)
    expect(diagonalBrightness).toBeGreaterThan(alignedBrightness)
  })

  test('produces colored rings (isochromes) at varying distances', () => {
    // Colors should change with distance due to increasing retardation
    const c1 = computeConoscopicColor(Math.PI / 4, 10, conoscopicParams, 0, 0)
    const c2 = computeConoscopicColor(Math.PI / 4, 30, conoscopicParams, 0, 0)
    const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    expect(diff).toBeGreaterThan(0.05)
  })

  test('different orientations rotate the cross pattern', () => {
    // Rotating the optical axis should shift which angles are dark
    const c1 = computeConoscopicColor(0, 30, conoscopicParams, 0, 0)
    const c2 = computeConoscopicColor(0, 30, conoscopicParams, Math.PI / 4, 0)
    const diff = Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    expect(diff).toBeGreaterThan(0.05)
  })

  test('cross has 4-fold symmetry', () => {
    // Angles 0 and PI/2 relative to axis should have similar extinction
    const orientation = 0.5
    const c1 = computeConoscopicColor(orientation, 30, conoscopicParams, orientation, 0)
    const c2 = computeConoscopicColor(orientation + Math.PI / 2, 30, conoscopicParams, orientation, 0)
    // Both should be dark (on the isogyre cross arms)
    expect(c1.r).toBeCloseTo(c2.r, 1)
    expect(c1.g).toBeCloseTo(c2.g, 1)
    expect(c1.b).toBeCloseTo(c2.b, 1)
  })

  test('computeColor delegates correctly for conoscopic mode', () => {
    const tilt = 0.1
    const c1 = computeColor(1.0, 20, conoscopicParams, Math.PI / 4, tilt)
    const c2 = computeConoscopicColor(1.0, 20, conoscopicParams, Math.PI / 4, tilt)
    const brightness = 0.35 + 0.65 * Math.pow(Math.cos(tilt), 2)
    expect(c1.r).toBeCloseTo(c2.r * brightness, 5)
    expect(c1.g).toBeCloseTo(c2.g * brightness, 5)
    expect(c1.b).toBeCloseTo(c2.b * brightness, 5)
  })

  test('saturation parameter affects color vividity', () => {
    const lowSat: ColorParams = { ...conoscopicParams, saturation: 0.1 }
    const highSat: ColorParams = { ...conoscopicParams, saturation: 0.9 }
    const cLow = computeConoscopicColor(Math.PI / 4, 20, lowSat, 0, 0)
    const cHigh = computeConoscopicColor(Math.PI / 4, 20, highSat, 0, 0)
    // Higher saturation should produce brighter/more vivid colors
    const brightnessLow = cLow.r + cLow.g + cLow.b
    const brightnessHigh = cHigh.r + cHigh.g + cHigh.b
    expect(brightnessHigh).toBeGreaterThan(brightnessLow)
  })
})
