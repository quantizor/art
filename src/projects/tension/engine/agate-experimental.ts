/**
 * Agate Experimental Color Strategy
 *
 * Class-based sequential band generator with configurable vibrancy,
 * uniformity, boundary frequency, and family switching. Each band's
 * color is influenced by the previous band + a dominant theme that
 * drifts slowly, producing realistic mineral deposit layering.
 *
 * Color families based on real agate specimens: Laguna, Condor,
 * Fire Agate, Iris, Blue Lace, and Botswana.
 */

import type { BandColor, BandColorStrategy } from './color-strategy'
import type { CrystalProfile } from '../types'
import type { PRNG } from './SeededRandom'

// ─── Color Families (vivid real agate specimen data) ─────────

interface Family {
  hue: [number, number]
  sat: [number, number]
  val: [number, number]
  weight: number
}

const FAMILIES: Family[] = [
  // Neutrals — dominant backgrounds
  { hue: [0.0, 1.0], sat: [0.0, 0.15], val: [0.65, 0.98], weight: 0.22 },
  // Muted warm earths (traditional browns/reds)
  { hue: [0.00, 0.18], sat: [0.20, 0.65], val: [0.40, 0.85], weight: 0.18 },
  // Vivid warm — striking reds, scarlets, bright oranges (Laguna, Fire, Condor)
  { hue: [0.00, 0.16], sat: [0.55, 0.95], val: [0.50, 0.93], weight: 0.20 },
  // Greens — moss, dendritic, Condor accents
  { hue: [0.22, 0.42], sat: [0.25, 0.65], val: [0.35, 0.80], weight: 0.10 },
  // Blues — richer & more saturated (Blue Lace, Condor electric, Iris)
  { hue: [0.48, 0.72], sat: [0.25, 0.82], val: [0.48, 0.93], weight: 0.17 },
  // Pinks / purples — Botswana, rare Iris/Condor
  { hue: [0.75, 0.98], sat: [0.20, 0.75], val: [0.40, 0.85], weight: 0.13 },
]

// ─── Generator Options ──────────────────────────────────────

interface AgateOptions {
  uniformity: number
  boundaryFrequency: number
  familySwitchRate: number
  vibrancy: number
}

const DEFAULT_OPTIONS: AgateOptions = {
  uniformity: 0.68,
  boundaryFrequency: 0.14,
  familySwitchRate: 0.07,
  vibrancy: 0.68,
}

let currentOptions: AgateOptions = { ...DEFAULT_OPTIONS }

/** Configure generator options from a crystal profile (samples vibrancy/uniformity from ranges) */
export function configureAgateExperimental(profile: CrystalProfile, rng: PRNG = Math.random): void {
  const [vMin, vMax] = profile.colorVibrancyRange
  const [uMin, uMax] = profile.colorUniformityRange
  currentOptions = {
    uniformity: uMin + rng() * (uMax - uMin),
    boundaryFrequency: profile.colorBoundaryFrequency,
    familySwitchRate: profile.colorFamilySwitchRate,
    vibrancy: vMin + rng() * (vMax - vMin),
  }
}

// ─── Utility Functions ──────────────────────────────────────

/** Box-Muller transform for natural-looking perturbations */
function gaussian(rng: PRNG, mean = 0, stdDev = 1): number {
  let u = 0, v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdDev + mean
}

function sampleFromFamily(fam: Family, rng: PRNG): [number, number, number] {
  return [
    rng() * (fam.hue[1] - fam.hue[0]) + fam.hue[0],
    rng() * (fam.sat[1] - fam.sat[0]) + fam.sat[0],
    rng() * (fam.val[1] - fam.val[0]) + fam.val[0],
  ]
}

/** HSV (0-1) -> approximate OKLCH conversion */
function hsvToOklch(h: number, s: number, v: number): BandColor {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)

  let r: number, g: number, b: number
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
    default: r = v; g = t; b = p
  }

  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const C = s * v * 0.35
  const H = h * 360

  return { H, L, C }
}

// ─── Band Generator Class ───────────────────────────────────

class AgateBandGenerator {
  private readonly opts: AgateOptions
  private readonly rng: PRNG
  private h: number
  private s: number
  private v: number
  private domH: number
  private domS: number
  private domV: number
  private streak = 0
  private currentFamIdx = 0

  constructor(opts: AgateOptions, rng: PRNG = Math.random) {
    this.opts = opts
    this.rng = rng
    const start = this.randomHsv()
    ;[this.h, this.s, this.v] = this.applyVibrancy(start[0], start[1], start[2])
    ;[this.domH, this.domS, this.domV] = [this.h, this.s, this.v]
    this.currentFamIdx = this.closestFamily(start[0])
  }

  /** Apply vibrancy boost (non-linear saturation + selective value pop) */
  private applyVibrancy(h: number, s: number, v: number): [number, number, number] {
    let boostedS = s
    let boostedV = v

    if (this.opts.vibrancy > 0) {
      // Non-linear saturation boost (stronger on already-saturated colors)
      boostedS = Math.min(0.99, s + (1 - s) * this.opts.vibrancy * 1.35)

      // Extra value/brightness pop on warm reds & rich blues (Fire/Laguna feel)
      if ((h < 0.19 || (h > 0.48 && h < 0.73)) && this.opts.vibrancy > 0.4) {
        boostedV = Math.min(0.98, v + (this.opts.vibrancy - 0.4) * 0.42)
      }
    }
    return [h, boostedS, boostedV]
  }

  private randomHsv(): [number, number, number] {
    // At high vibrancy, bias toward vivid red + blue families
    const weights = FAMILIES.map((f, i) => {
      let w = f.weight
      if (this.opts.vibrancy > 0.65 && (i === 2 || i === 4)) {
        w *= 1 + (this.opts.vibrancy - 0.65) * 2.4
      }
      return w
    })

    const total = weights.reduce((a, w) => a + w, 0)
    let r = this.rng() * total
    let cum = 0
    for (let i = 0; i < FAMILIES.length; i++) {
      cum += weights[i]
      if (r <= cum) {
        this.currentFamIdx = i
        return sampleFromFamily(FAMILIES[i], this.rng)
      }
    }
    return [0, 0, 0.85]
  }

  private closestFamily(h: number): number {
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < FAMILIES.length; i++) {
      const mid = (FAMILIES[i].hue[0] + FAMILIES[i].hue[1]) / 2
      let dist = Math.abs(h - mid)
      if (dist > 0.5) dist = 1 - dist
      if (dist < bestDist) { bestDist = dist; best = i }
    }
    return best
  }

  private perturb(
    targetH: number, targetS: number, targetV: number,
    hSig: number, sSig: number, vSig: number
  ): void {
    this.h = (targetH + gaussian(this.rng, 0, hSig)) % 1
    if (this.h < 0) this.h += 1

    this.s = Math.max(0.08, Math.min(0.98, targetS + gaussian(this.rng, 0, sSig)))
    this.v = Math.max(0.28, Math.min(0.98, targetV + gaussian(this.rng, 0, vSig)))

    // Extra saturation nudge during small perturbations when vibrancy is high
    if (this.opts.vibrancy > 0.5) {
      this.s = Math.min(0.98, this.s + (0.98 - this.s) * (this.opts.vibrancy - 0.5) * 0.6)
    }
  }

  private generateBoundary(): BandColor {
    let bh = this.h
    let bs = this.s * (0.15 + this.opts.vibrancy * 0.12)
    let bv = this.v > 0.58 ? this.v * 0.38 + 0.08 : this.v * 1.55

    if (this.rng() < 0.62) {
      // Classic thin neutral/gray/white separator
      bs = 0.02 + this.rng() * 0.13
      bv = 0.68 + this.rng() * 0.30
    } else {
      bh = (bh + (this.rng() < 0.5 ? 0.5 : -0.5) + gaussian(this.rng, 0, 0.09)) % 1
    }

    this.h = bh
    this.s = bs
    this.v = bv
    return hsvToOklch(this.h, this.s, this.v)
  }

  /** Generate next band color as OKLCH */
  nextBandColor(): BandColor {
    this.streak++

    // Occasional thin boundary separators
    if (this.streak > 3 && this.rng() < this.opts.boundaryFrequency) {
      this.streak = 0
      return this.generateBoundary()
    }

    const stayProb = 0.33 + this.opts.uniformity * 0.64 // 0.33 → 0.97

    if (this.rng() > stayProb && this.streak > 5) {
      if (this.rng() < this.opts.familySwitchRate) {
        this.switchFamily()
      } else {
        this.perturb(this.domH, this.domS, this.domV, 0.088, 0.21, 0.27)
      }
      this.streak = 1
    } else {
      const targetH = this.streak <= 6 ? this.domH : this.h
      this.perturb(targetH, this.s, this.v, 0.0115, 0.049, 0.068)
    }

    // Soft drift of dominant theme
    this.domH = this.domH * 0.918 + this.h * 0.082
    this.domS = this.domS * 0.937 + this.s * 0.063
    this.domV = this.domV * 0.928 + this.v * 0.072

    // Final vibrancy boost (keeps boundaries subtle, main bands vivid)
    const [finalH, finalS, finalV] = this.applyVibrancy(this.h, this.s, this.v)
    return hsvToOklch(finalH, finalS, finalV)
  }

  private switchFamily(): void {
    let newIdx = this.currentFamIdx
    while (newIdx === this.currentFamIdx) {
      const weights = FAMILIES.map((f, i) => {
        let w = f.weight
        if (this.opts.vibrancy > 0.65 && (i === 2 || i === 4)) {
          w *= 1 + (this.opts.vibrancy - 0.65) * 2.1
        }
        return w
      })
      const total = weights.reduce((a, w) => a + w, 0)
      let r = this.rng() * total
      let cum = 0
      for (let i = 0; i < FAMILIES.length; i++) {
        cum += weights[i]
        if (r <= cum) { newIdx = i; break }
      }
    }
    this.currentFamIdx = newIdx
    const newDom = sampleFromFamily(FAMILIES[newIdx], this.rng)
    ;[this.domH, this.domS, this.domV] = this.applyVibrancy(newDom[0], newDom[1], newDom[2])
    ;[this.h, this.s, this.v] = [this.domH, this.domS, this.domV]
  }
}

// ─── Cached Band Sequence ───────────────────────────────────

const MAX_CACHED_BANDS = 512
let cachedHueKey = -1
let cachedGenerator: AgateBandGenerator | null = null
let cachedSequence: BandColor[] = []
let currentBandRng: PRNG = Math.random

/** Set the PRNG used for band color generation */
export function setBandRng(rng: PRNG): void {
  currentBandRng = rng
}

function ensureSequence(hueKey: number, upTo: number): void {
  if (cachedHueKey !== hueKey) {
    cachedHueKey = hueKey
    cachedGenerator = new AgateBandGenerator(currentOptions, currentBandRng)
    cachedSequence = []
  }

  if (cachedSequence.length > upTo) return

  const target = Math.min(upTo + 1, MAX_CACHED_BANDS)
  while (cachedSequence.length < target) {
    cachedSequence.push(cachedGenerator!.nextBandColor())
  }
}

// ─── Strategy Export ────────────────────────────────────────

export const agateExperimental: BandColorStrategy = {
  name: 'agate-experimental',

  getBandColor(
    bandIdx: number,
    hueKey: number,
    _baseLightness: number,
    _saturation: number
  ): BandColor {
    const idx = Math.min(bandIdx, MAX_CACHED_BANDS - 1)
    ensureSequence(hueKey, idx)
    return cachedSequence[idx]
  },

  reset() {
    cachedHueKey = -1
    cachedGenerator = null
    cachedSequence = []
  },
}
