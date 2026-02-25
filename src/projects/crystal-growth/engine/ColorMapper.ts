/**
 * Color Mapper
 *
 * Maps crystal growth angle and distance to birefringence-inspired colors.
 * All color generation uses OKLCH color space for perceptual uniformity.
 * Pure functions — no side effects, fully testable.
 */

import type { ColorParams, RGBColor } from '../types'

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

// ─── OKLCH → sRGB Conversion ──────────────────────────────────

/** Linear sRGB → sRGB gamma curve */
function linearToSrgb(x: number): number {
  if (x <= 0.0031308) return 12.92 * x
  return 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

/**
 * Convert OKLCH to sRGB.
 *
 * @param L - Perceptual lightness (0-1)
 * @param C - Chroma (0 to ~0.37, gamut dependent)
 * @param H - Hue in degrees (0-360)
 */
export function oklchToRgb(L: number, C: number, H: number): RGBColor {
  // OKLCH → OKLab
  const hRad = (H * Math.PI) / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)

  // OKLab → LMS (cube-root space)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b

  // Undo cube root
  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  // LMS → linear sRGB
  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

  return {
    r: clamp01(linearToSrgb(rLin)),
    g: clamp01(linearToSrgb(gLin)),
    b: clamp01(linearToSrgb(bLin)),
  }
}

/**
 * Convert HSL (degrees, 0-1, 0-1) to RGB (0-1 each)
 * @deprecated Use oklchToRgb for perceptually uniform colors
 */
export function hslToRgb(h: number, s: number, l: number): RGBColor {
  // Route through OKLCH for perceptual uniformity
  const hNorm = ((h % 360) + 360) % 360
  const C = s * 0.32 * (1 - Math.abs(2 * l - 1))
  return oklchToRgb(l, C, hNorm)
}

/**
 * Thin-film interference color approximation via OKLCH hue sweep.
 *
 * Simulates iridescent colors from polarized light through birefringent
 * crystals. Sweeps through OKLCH hue at constant lightness and chroma
 * for perceptually uniform spectral cycling.
 *
 * @param t - Optical path difference, normalized to [0, 1) for one order
 */
export function thinFilmSpectrum(t: number): RGBColor {
  // Sweep hue 0-360 as t goes 0-1
  const hue = ((t * 360) % 360 + 360) % 360

  // Constant perceptual lightness and moderate chroma for pastel/muted look
  // matching real polarized microphotography
  const L = 0.72
  const C = 0.12

  return oklchToRgb(L, C, hue)
}

/**
 * Simple spatial hash for per-cell noise.
 * Returns a value in [0, 1].
 */
export function cellHash(cx: number, cy: number): number {
  let h = (cx * 374761393 + cy * 668265263) | 0
  h = ((h ^ (h >> 13)) * 1274126177) | 0
  h = (h ^ (h >> 16)) | 0
  return ((h & 0xffff) >>> 0) / 0xffff
}

/**
 * Compute polarized cross-polarization color from seed orientation.
 *
 * Each grain's color is determined primarily by its seed's crystal axis
 * orientation, mapped through the thin-film interference spectrum.
 */
export function computePolarizedColor(
  seedOrientation: number,
  distFromSeed: number,
  params: ColorParams,
  seedTilt?: number
): RGBColor {
  const { bandAmplitude } = params
  const tilt = seedTilt ?? 0

  const baseT = ((seedOrientation / Math.PI) % 1 + 1) % 1
  const retardationScale = 0.3 + 0.7 * Math.pow(Math.cos(tilt), 2)
  const tiltShift = Math.sin(tilt * 2) * 0.3
  const thicknessShift = bandAmplitude * retardationScale * Math.tanh(distFromSeed / 80)

  const t = ((baseT + tiltShift + thicknessShift) % 1 + 1) % 1
  return thinFilmSpectrum(t)
}

export function computeColor(
  angle: number,
  distFromSeed: number,
  params: ColorParams,
  seedOrientation?: number,
  seedTilt?: number,
  boundaryPressure?: number
): RGBColor {
  const { mode, bandWavelength, bandAmplitude, baseLightness, saturation, monoHue } = params

  let rgb: RGBColor

  if (mode === 'polarized') {
    rgb = computePolarizedColor(seedOrientation ?? 0, distFromSeed, params, seedTilt)
  } else if (mode === 'oilslick') {
    rgb = computeOilSlickColor(angle, distFromSeed, params, seedTilt)
  } else if (mode === 'dichroism') {
    rgb = computeDichroismColor(angle, distFromSeed, params, seedOrientation ?? 0, seedTilt ?? 0)
  } else if (mode === 'laue') {
    rgb = computeLaueColor(angle, distFromSeed, params, seedOrientation ?? 0, seedTilt ?? 0)
  } else if (mode === 'conoscopic') {
    rgb = computeConoscopicColor(angle, distFromSeed, params, seedOrientation ?? 0, seedTilt ?? 0)
  } else {
    const angleWeight = Math.min(1, distFromSeed / 5)
    const effectiveAngle = (seedTilt ?? 0) + angle * angleWeight
    const gradient = Math.tanh(distFromSeed / (bandWavelength * 3))

    let hue: number
    let lightness: number

    switch (mode) {
      case 'birefringence':
        hue = ((effectiveAngle * 2 * 180) / Math.PI) % 360
        lightness = baseLightness + bandAmplitude * gradient
        break
      case 'rainbow':
        hue = ((effectiveAngle * 180) / Math.PI) % 360
        lightness = baseLightness + bandAmplitude * gradient
        break
      case 'monochrome':
        hue = monoHue
        lightness = 0.3 + 0.4 * (0.5 + 0.5 * Math.cos(effectiveAngle * 2)) + bandAmplitude * gradient
        break
    }

    hue = ((hue % 360) + 360) % 360
    // Map saturation (0-1) to OKLCH chroma, scaled by lightness for gamut safety
    const chroma = saturation * 0.3 * (1 - Math.abs(2 * clamp01(lightness) - 1))
    rgb = oklchToRgb(clamp01(lightness), chroma, hue)
  }

  // Universal tilt-based brightness
  const tilt = seedTilt ?? 0
  const grainBrightness = 0.35 + 0.65 * Math.pow(Math.cos(tilt), 2)
  rgb = {
    r: clamp01(rgb.r * grainBrightness),
    g: clamp01(rgb.g * grainBrightness),
    b: clamp01(rgb.b * grainBrightness),
  }

  if (boundaryPressure && boundaryPressure > 0) {
    rgb = applyStrainEffects(rgb, boundaryPressure, angle, distFromSeed)
  }

  return rgb
}

/**
 * Photoelastic strain effects at grain boundaries.
 */
export function applyStrainEffects(
  color: RGBColor,
  pressure: number,
  angle: number,
  distFromSeed: number
): RGBColor {
  const p = Math.min(pressure, 2)

  const strainT = ((distFromSeed * 0.08 + angle * 0.5) % 1 + 1) % 1
  const strainColor = thinFilmSpectrum(strainT)
  const strainMix = p * 0.12
  const hazeMix = p * 0.06
  const milky = 0.82
  const baseFactor = 1 - strainMix - hazeMix

  return {
    r: clamp01(color.r * baseFactor + strainColor.r * strainMix + milky * hazeMix),
    g: clamp01(color.g * baseFactor + strainColor.g * strainMix + milky * hazeMix),
    b: clamp01(color.b * baseFactor + strainColor.b * strainMix + milky * hazeMix),
  }
}

/**
 * Oil-slick color mode: thin-film interference via OKLCH hue sweep.
 */
function computeOilSlickColor(
  angle: number,
  distFromSeed: number,
  params: ColorParams,
  seedTilt?: number
): RGBColor {
  const { bandWavelength, bandAmplitude } = params

  const angleWeight = Math.min(1, distFromSeed / 5)
  const effectiveAngle = (seedTilt ?? 0) + angle * angleWeight
  const normalizedAngle = (((effectiveAngle * 2) / Math.PI) % 1 + 1) % 1
  const thicknessGradient = Math.tanh(distFromSeed / (bandWavelength * 3))
  const t = ((normalizedAngle + thicknessGradient * bandAmplitude) % 1 + 1) % 1

  return thinFilmSpectrum(t)
}

/**
 * Dichroism color mode: directional color absorption in OKLCH.
 */
export function computeDichroismColor(
  angle: number,
  distFromSeed: number,
  params: ColorParams,
  seedOrientation: number,
  seedTilt: number
): RGBColor {
  const { bandAmplitude } = params

  const opticalAxis = seedOrientation + seedTilt
  const angleWeight = Math.min(1, distFromSeed / 5)
  const effectiveAngle = seedTilt + angle * angleWeight

  const relativeAngle = effectiveAngle - opticalAxis
  const cos2 = Math.cos(relativeAngle) ** 2

  const hueBase = ((seedOrientation * 180) / Math.PI) % 360

  // Warm color (ordinary ray) in OKLCH — amber/gold tones
  const warmRgb = oklchToRgb(0.72, 0.14, (hueBase + 80) % 360)
  // Cool color (extraordinary ray) — complementary offset
  const coolRgb = oklchToRgb(0.55, 0.12, (hueBase + 260) % 360)

  const thicknessModulation = 1.0 - bandAmplitude * 0.3 * Math.tanh(distFromSeed / 80)

  return {
    r: clamp01((warmRgb.r * cos2 + coolRgb.r * (1 - cos2)) * thicknessModulation),
    g: clamp01((warmRgb.g * cos2 + coolRgb.g * (1 - cos2)) * thicknessModulation),
    b: clamp01((warmRgb.b * cos2 + coolRgb.b * (1 - cos2)) * thicknessModulation),
  }
}

/**
 * Laue diffraction color mode: X-ray crystallography patterns.
 */
export function computeLaueColor(
  angle: number,
  distFromSeed: number,
  params: ColorParams,
  seedOrientation: number,
  seedTilt: number
): RGBColor {
  const { bandWavelength } = params

  const angleWeight = Math.min(1, distFromSeed / 5)
  const effectiveAngle = seedTilt + angle * angleWeight

  const latticeAngle = seedOrientation
  const latticeSpacing = bandWavelength * 0.8

  const relAngle1 = effectiveAngle - latticeAngle
  const relAngle2 = effectiveAngle - latticeAngle - Math.PI / 2

  const radialPhase1 = (distFromSeed / latticeSpacing) * Math.PI * 2
  const radialPhase2 = (distFromSeed / (latticeSpacing * 1.3)) * Math.PI * 2

  const angularSharpness = 8
  const spot1 = Math.pow(Math.abs(Math.cos(relAngle1 * 3)), angularSharpness) *
    (0.5 + 0.5 * Math.cos(radialPhase1))
  const spot2 = Math.pow(Math.abs(Math.cos(relAngle2 * 3)), angularSharpness) *
    (0.5 + 0.5 * Math.cos(radialPhase2))

  const diffraction = Math.min(1, spot1 + spot2 * 0.7)
  const envelope = Math.exp(-distFromSeed * 0.008)

  const spotPhase = ((effectiveAngle * 2 + distFromSeed * 0.02) % (Math.PI * 2))
  const spotColor = thinFilmSpectrum(((spotPhase / (Math.PI * 2)) % 1 + 1) % 1)

  const baseIntensity = 0.04
  const spotIntensity = diffraction * envelope

  return {
    r: clamp01(baseIntensity + spotColor.r * spotIntensity * 0.9),
    g: clamp01(baseIntensity + spotColor.g * spotIntensity * 0.85),
    b: clamp01(baseIntensity + spotColor.b * spotIntensity * 1.1),
  }
}

/**
 * Conoscopic interference figure color mode in OKLCH.
 */
export function computeConoscopicColor(
  angle: number,
  distFromSeed: number,
  params: ColorParams,
  seedOrientation: number,
  seedTilt: number
): RGBColor {
  const { bandWavelength, saturation } = params

  const angleWeight = Math.min(1, distFromSeed / 5)
  const effectiveAngle = seedTilt + angle * angleWeight
  const axisAngle = seedOrientation

  const retardation = (distFromSeed / bandWavelength) * 0.5
  const ringColor = thinFilmSpectrum(retardation % 1)

  const crossAngle = effectiveAngle - axisAngle
  const isogyre = Math.cos(2 * crossAngle) ** 2

  const crossWidth = clamp01(1.0 - Math.tanh(distFromSeed / 40) * 0.6)
  const isogyreStrength = Math.pow(isogyre, 1.0 + 3.0 * (1.0 - crossWidth))
  const extinction = 1.0 - isogyreStrength * 0.85

  const vividity = 0.3 + saturation * 0.7

  return {
    r: clamp01(ringColor.r * extinction * vividity),
    g: clamp01(ringColor.g * extinction * vividity),
    b: clamp01(ringColor.b * extinction * vividity),
  }
}
