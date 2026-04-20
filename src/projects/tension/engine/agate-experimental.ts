/**
 * Agate Band Color Strategy (OKLCH native)
 *
 * Band colours are sampled directly in OKLCH — no lossy HSV round-trip.
 * Seven hue families mirror the mineralogy of real agate: chalcedony
 * neutrals, iron-stained earths, fire-agate reds, amber/honey, moss
 * greens, dusty blues, and soft pinks. Weights and chroma caps
 * reflect how often each family actually appears in specimens.
 *
 * A single nodule stays inside one dominant family for most bands,
 * with occasional thin neutral separators and rare family switches.
 */

import type { BandColor, BandColorStrategy } from './color-strategy'
import type { CrystalProfile } from '../types'
import type { PRNG } from './SeededRandom'
import { isZonalLayout, isOnyxLayout, isDyedSpecimen, getVariantOverride } from './ColorMapper'

// Curated "dye" hues — the actual colours commercial agate dyes ship
// in. Extreme saturation that doesn't exist in natural chromophores.
const DYE_HUES: readonly number[] = [
  190, // teal / cyan
  245, // electric ultramarine
  300, // royal violet
  345, // magenta / hot pink
  95,  // acid chartreuse
  155, // jade
]

// ─── Families (OKLCH) ───────────────────────────────────────

interface Family {
  /** Lightness range, 0-1 perceptual */
  L: [number, number]
  /** Chroma range, 0 to ~0.37 */
  C: [number, number]
  /** Hue range in degrees. May wrap across 360 (end < start). */
  H: [number, number]
  weight: number
}

// Families are gated to the ACTUAL chromophore minerals observed in
// agate. Every L/C/H range is grounded in a specific chemistry:
//
//   chalcedony           → white / translucent (SiO2·nH2O)
//   chalcedony + clay    → gray (trace organic / clay)
//   hematite + goethite  → terracotta / iron earth brown (Fe3+ mix)
//   pure goethite        → amber / honey / yellow (Fe3+ hydroxide)
//   pure hematite        → fire-agate red / carnelian (Fe2O3)
//   chlorite/celadonite  → moss-agate green (Fe+Mg silicate)
//   trace-Fe alkaline    → blue-lace dusty blue-gray (rare)
//   rhodochrosite        → soft pink (Mn2+, rare accent)
//   manganese oxide      → near-black (inclusion / dendrite / matrix)
//
// Weights reflect observed relative frequency. No lavender/purple/neon
// — those chromophores are not part of the agate system.
const FAMILIES: Family[] = [
  // Chalcedony — translucent/white. Whites stay near-zero chroma.
  { L: [0.78, 0.92], C: [0.00, 0.03], H: [30, 95], weight: 0.30 },
  // Gray chalcedony — trace clay / organic, common matrix.
  { L: [0.55, 0.78], C: [0.00, 0.025], H: [60, 240], weight: 0.16 },
  // Iron earth — punched up toward Laguna terracotta saturation.
  { L: [0.42, 0.64], C: [0.10, 0.18], H: [28, 55], weight: 0.20 },
  // Goethite amber / honey — richer Fe3+ tones.
  { L: [0.62, 0.84], C: [0.10, 0.18], H: [65, 92], weight: 0.12 },
  // Hematite fire-red — carnelian / fire agate, vivid.
  { L: [0.48, 0.68], C: [0.16, 0.24], H: [18, 40], weight: 0.10 },
  // Chlorite / celadonite — moss greens, slightly more saturated.
  { L: [0.44, 0.64], C: [0.05, 0.12], H: [122, 148], weight: 0.04 },
  // Blue-lace / cerulean — low end dusty lace, high end saturated cerulean.
  { L: [0.62, 0.82], C: [0.06, 0.18], H: [215, 245], weight: 0.05 },
  // Rhodochrosite pink — Mn2+, brighter rose.
  { L: [0.58, 0.76], C: [0.08, 0.14], H: [355, 15], weight: 0.03 },
  // Manganese oxide / organic shell — pyrolusite black, the crust that
  // bounds real agate nodules. Pure neutral grayscale (C=0), so the hue
  // value is irrelevant — always reads as black-adjacent.
  { L: [0.04, 0.14], C: [0.00, 0.00], H: [0, 0], weight: 0.02 },
]

// ─── Generator options ──────────────────────────────────────

interface AgateOptions {
  uniformity: number
  boundaryFrequency: number
  familySwitchRate: number
  vibrancy: number
}

const DEFAULT_OPTIONS: AgateOptions = {
  uniformity: 0.80,
  boundaryFrequency: 0.18,
  familySwitchRate: 0.025,
  vibrancy: 0.30,
}

let currentOptions: AgateOptions = { ...DEFAULT_OPTIONS }

/** Configure generator options from a crystal profile */
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

// ─── Helpers ────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Box-Muller Gaussian — natural perturbation distribution. */
function gaussian(rng: PRNG, stdDev: number): number {
  let u = 0, v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdDev
}

/** Sample uniformly from a range, respecting hue wrap-around. */
function sampleRange(range: [number, number], rng: PRNG, wrap = false): number {
  const [a, b] = range
  if (wrap && b < a) {
    const span = 360 - a + b
    const v = a + rng() * span
    return v >= 360 ? v - 360 : v
  }
  return a + rng() * (b - a)
}

/** Sample an OKLCH triple from a family. */
function sampleFromFamily(fam: Family, rng: PRNG): [number, number, number] {
  const L = sampleRange(fam.L, rng)
  const C = sampleRange(fam.C, rng)
  const H = sampleRange(fam.H, rng, true)
  return [L, C, H]
}

/** Wrap hue to [0, 360). */
function wrapHue(h: number): number {
  let v = h % 360
  if (v < 0) v += 360
  return v
}

// ─── Generator ──────────────────────────────────────────────

type Regime = 'chalcedony' | 'stained'

// happy pride
type IrisPalette = readonly [number, number, number][]

const IRIS_PALETTES: readonly IrisPalette[] = [
  [
    [0.55, 0.20, 28],
    [0.72, 0.17, 55],
    [0.90, 0.17, 95],
    [0.65, 0.17, 145],
    [0.50, 0.17, 245],
    [0.45, 0.15, 308],
  ],
  [
    [0.80, 0.08, 218],
    [0.80, 0.08, 348],
    [0.96, 0.01, 90],
    [0.80, 0.08, 348],
    [0.80, 0.08, 218],
  ],
  [
    [0.58, 0.20, 345],
    [0.42, 0.13, 300],
    [0.48, 0.18, 260],
  ],
  [
    [0.60, 0.18, 38],
    [0.78, 0.17, 58],
    [0.96, 0.01, 90],
    [0.80, 0.10, 355],
    [0.52, 0.20, 340],
  ],
  [
    [0.60, 0.22, 348],
    [0.92, 0.17, 95],
    [0.78, 0.15, 205],
  ],
  [
    [0.12, 0.00, 0],
    [0.55, 0.00, 0],
    [0.96, 0.00, 0],
    [0.42, 0.15, 305],
  ],
  [
    [0.64, 0.14, 305],
    [0.96, 0.01, 90],
    [0.86, 0.15, 125],
  ],
]

class AgateBandGenerator {
  private readonly opts: AgateOptions
  private readonly rng: PRNG
  private L: number; private C: number; private H: number
  private domL: number; private domC: number; private domH: number
  private famIdx: number
  private streak = 0
  /** Current depositional regime — real fortification alternates between
   * pure chalcedony deposits and iron-stained deposits. */
  private regime: Regime = 'chalcedony'
  private regimeStreak = 0
  private readonly iris: boolean
  private readonly irisPalette: IrisPalette
  /** Used for the probabilistic shell decision (stable per nodule). */
  private readonly shellHash: number
  /**
   * Malawi-style "single-feedback zone" layout — one fat quiet chalcedony
   * band, tight accent cluster, then (maybe) a red/orange stained eye.
   */
  private readonly zonal: boolean
  /** Zonal nodules: 70% get a stained central eye; rest stay chalcedony. */
  private readonly zonalHasEye: boolean
  /** Which quiet family occupies the fat zone (blue-lace 6 or gray 1). */
  private readonly zonalQuietFam: number
  /** Onyx agate — dramatic black/white alternation with solid central pool. */
  private readonly onyx: boolean
  /** Dyed specimen — single saturated hue across all bands. */
  private readonly dyed: boolean
  /** Chosen hue for dyed specimens. */
  private readonly dyeHue: number

  constructor(
    opts: AgateOptions,
    rng: PRNG = Math.random,
    zonal = false,
    onyx = false,
    dyed = false
  ) {
    this.opts = opts
    this.rng = rng
    const override = getVariantOverride()
    this.iris = override === 'iris' ? true : override !== 'random' ? false : rng() < 0.15
    const paletteIdx = (rng() * IRIS_PALETTES.length) | 0
    this.irisPalette = IRIS_PALETTES[paletteIdx]
    this.shellHash = rng()
    // Onyx takes precedence over iris/zonal if both flags would fire.
    this.onyx = onyx && !this.iris
    // Dyed specimens coexist with zonal (becomes a single-hue zonal nodule)
    // but not with iris or onyx (those already override colour wholesale).
    this.dyed = dyed && !this.iris && !this.onyx
    this.dyeHue = DYE_HUES[(rng() * DYE_HUES.length) | 0]
    // Zonal decisions pulled from the same RNG so they stay deterministic.
    this.zonal = zonal && !this.iris && !this.onyx
    this.zonalHasEye = rng() < 0.70
    this.zonalQuietFam = rng() < 0.55 ? 6 : 1 // blue-lace-leaning majority
    // Start with chalcedony rind — the typical first deposit on the wall.
    this.regime = 'chalcedony'
    this.famIdx = this.pickFamily(0)
    const [L, C, H] = sampleFromFamily(FAMILIES[this.famIdx], rng)
    this.L = L; this.C = this.applyVibrancy(C, H)
    this.H = H
    this.domL = L; this.domC = this.C; this.domH = H
  }

  /**
   * Pick a family based on the current depositional regime + radial
   * position. Real fortification agate alternates between two regimes:
   *
   *   chalcedony regime → pure SiO2 (whites, grays, pale blues, pinks)
   *   stained regime    → iron / Mn / chlorite (warm earths, fire-red)
   *
   * The regime alternates every 1-3 bands. Within each regime, this
   * picker chooses among the families that are mineralogically relevant
   * for that regime, with mild radial bias (e.g. fire-red intensifies
   * toward the centre, Mn black favours the very wall).
   */
  private pickFamily(bandIdx: number): number {
    // Outermost band: ~60% of specimens have a Mn-oxide / organic
    // shell against the host rock; the rest start with chalcedony
    // directly at the contact. Stable per-nodule via shellHash.
    if (bandIdx === 0) {
      return this.shellHash < 0.78 ? 8 : 0
    }

    const f = Math.min(bandIdx / 30, 1)
    const peak = (center: number, sharpness: number) =>
      Math.max(0, 1 - Math.abs(f - center) * sharpness)

    const candidates: { idx: number; weight: number }[] =
      this.regime === 'chalcedony'
        ? [
            // Chalcedony regime — light, low-chroma deposits. Warm-leaning.
            { idx: 0, weight: 0.60 },              // pure white chalcedony
            { idx: 1, weight: 0.18 },              // gray chalcedony
            { idx: 7, weight: 0.06 + peak(0.95, 2.6) * 0.18 }, // pink centre accent
            { idx: 6, weight: 0.18 + peak(0.7, 1.4) * 0.14 }, // blue-lace / cerulean accent
          ]
        : [
            // Stained regime — iron-dominated with occasional chlorite.
            { idx: 2, weight: 0.34 + peak(0.4, 1.6) * 0.22 }, // iron earth (mid-wall)
            { idx: 3, weight: 0.24 + peak(0.5, 1.6) * 0.18 }, // amber
            { idx: 4, weight: 0.20 + peak(0.8, 1.6) * 0.48 + peak(0.96, 2.4) * 0.45 }, // hematite (centre)
            { idx: 5, weight: 0.07 + peak(0.5, 1.5) * 0.08 }, // chlorite moss-green accent
          ]

    // Vibrancy bump on hematite fire-red only.
    for (const c of candidates) {
      if (c.idx === 4 && this.opts.vibrancy > 0.4) {
        c.weight *= 1 + (this.opts.vibrancy - 0.4) * 1.0
      }
    }

    const weights = candidates.map((c) => Math.max(0, c.weight))
    const total = weights.reduce((a, w) => a + w, 0)
    let r = this.rng() * total
    let cum = 0
    for (let i = 0; i < candidates.length; i++) {
      cum += weights[i]
      if (r <= cum) return candidates[i].idx
    }
    return candidates[0].idx
  }

  /** Decide whether to flip the current depositional regime. */
  private maybeFlipRegime(): void {
    this.regimeStreak++
    // Real fortification has RUNS of same-family bands — typically 3-6
    // chalcedony bands then 3-6 iron-stained bands. Low base flip prob
    // with slow ramp gives that run length on average.
    const flipProb = 0.08 + this.regimeStreak * 0.10
    if (this.rng() < flipProb) {
      this.regime = this.regime === 'chalcedony' ? 'stained' : 'chalcedony'
      this.regimeStreak = 0
    }
  }

  /**
   * Chroma boost — top out at C=0.27. Multiplicative on existing chroma
   * so already-neutral materials (shell, gray chalcedony) stay neutral
   * and don't get tinted warm. Strong on saturated colours, no-op on
   * grays.
   */
  private applyVibrancy(C: number, H: number): number {
    if (this.opts.vibrancy <= 0) return C
    if (C < 0.015) return C // pure neutral — never tint
    const warm = H < 60 || H > 340
    const gain = warm ? 1.6 : 1.25
    return Math.min(0.27, C * (1 + this.opts.vibrancy * (gain - 1)))
  }

  /** Perturb around the current (or dom) values in OKLCH space. */
  private perturb(
    targetL: number, targetC: number, targetH: number,
    sigL: number, sigC: number, sigH: number
  ): void {
    this.L = clamp(targetL + gaussian(this.rng, sigL), 0.14, 0.98)
    this.C = clamp(targetC + gaussian(this.rng, sigC), 0.0, 0.27)
    this.H = wrapHue(targetH + gaussian(this.rng, sigH))
  }

  /**
   * Thin separator band — picks the contrast that would naturally read
   * as a fortification seam. Bright chalcedony rim against dark matrix;
   * Mn-black stripe against bright chalcedony. Prevents nodules from
   * reading as solidly light or solidly dark.
   */
  private generateBoundary(): BandColor {
    if (this.domL > 0.58) {
      // Dark Mn / organic seam against a light matrix.
      this.L = 0.14 + this.rng() * 0.14
      this.C = 0.01 + this.rng() * 0.03
      this.H = wrapHue(this.domH + gaussian(this.rng, 8))
    } else {
      // Bright chalcedony rim against a dark matrix.
      this.L = 0.82 + this.rng() * 0.12
      this.C = this.rng() * 0.03
      this.H = 60 + this.rng() * 80
    }
    return { L: this.L, C: this.C, H: this.H }
  }

  /** Switch to a different family for the next band (rare). */
  private switchFamily(bandIdx: number): void {
    let newIdx = this.famIdx
    let guard = 0
    while (newIdx === this.famIdx && guard++ < 8) {
      newIdx = this.pickFamily(bandIdx)
    }
    this.famIdx = newIdx
    const [L, C, H] = sampleFromFamily(FAMILIES[newIdx], this.rng)
    this.domL = L; this.domC = this.applyVibrancy(C, H); this.domH = H
    this.L = this.domL; this.C = this.domC; this.H = this.domH
  }

  /**
   * Produce the next band colour for `bandIdx` (wall = 0, centre = max).
   *
   * Each band: maybe flip the depositional regime, pick a family from
   * the current regime, sample fresh OKLCH from it, and apply mild drift
   * smoothing so adjacent bands don't look completely uncorrelated.
   * High uniformity stays inside the same family for several bands;
   * low uniformity refreshes more often.
   */
  nextBandColor(bandIdx: number): BandColor {
    // Onyx agate: dramatic black/white alternation with a warm tan rim
    // at the wall and a solid pure-black pool at the centre. Real onyx
    // (banded black chalcedony) forms when residual Mn-saturated fluid
    // pools in the cavity core and crystallises as pure pyrolusite.
    if (this.onyx) {
      if (bandIdx === 0) {
        // Warm tan/cream basalt rind — not pure white, more like bleached
        // chalcedony stained by the host rock.
        this.L = 0.78 + this.rng() * 0.08
        this.C = 0.015 + this.rng() * 0.02
        this.H = 55 + this.rng() * 25
        this.famIdx = -1
        return { L: this.L, C: this.C, H: this.H }
      }
      if (bandIdx >= 11) {
        // Central pool — solid pure black (pyrolusite), hue irrelevant.
        this.L = 0.03 + this.rng() * 0.03
        this.C = 0
        this.H = 0
        this.famIdx = 8
        return { L: this.L, C: this.C, H: this.H }
      }
      // Inner bands (8-10): progressive translucent fade toward the pool.
      // Real onyx shows pre-pool layers losing opacity as Mn content
      // rises and chalcedony growth slows.
      if (bandIdx >= 8) {
        const fadeT = (bandIdx - 7) / 4 // 0.25 → 1.0
        const parity = bandIdx % 2
        if (parity === 1) {
          this.L = 0.86 - fadeT * 0.40 // fading white → mid-grey
          this.C = 0.008
          this.H = 70
        } else {
          this.L = 0.18 - fadeT * 0.08 // deepening black
          this.C = 0
          this.H = 0
        }
        this.famIdx = parity ? 0 : 8
        return { L: this.L, C: this.C, H: this.H }
      }
      // Outer alternation bands (1-7): crisp white ↔ pure black.
      // Parity by bandIdx, with small L jitter so stacked bands aren't
      // identical.
      const isWhite = bandIdx % 2 === 1
      if (isWhite) {
        this.L = 0.88 + this.rng() * 0.07
        this.C = 0.008
        this.H = 70
        this.famIdx = 0
      } else {
        this.L = 0.06 + this.rng() * 0.06
        this.C = 0
        this.H = 0
        this.famIdx = 8
      }
      this.domL = this.L; this.domC = this.C; this.domH = this.H
      return { L: this.L, C: this.C, H: this.H }
    }

    // Dyed specimen — all bands share one extreme-saturation hue. The
    // outer band keeps the natural Mn/chalcedony rind (dye penetrates
    // inside; the rock surface still reads as basalt host). Inner bands
    // vary L and C at fixed H so you get a bands-in-one-colour look.
    if (this.dyed) {
      if (bandIdx === 0) {
        // Keep the natural shell roll for the rim.
        const idx = this.shellHash < 0.78 ? 8 : 0
        const [L, C, H] = sampleFromFamily(FAMILIES[idx], this.rng)
        this.L = L; this.C = this.applyVibrancy(C, H)
        this.H = H
        this.famIdx = idx
        this.domL = this.L; this.domC = this.C; this.domH = this.H
        return { L: this.L, C: this.C, H: this.H }
      }
      // L alternates lighter/darker per band for stripe contrast; C
      // stays high so the dye reads consistently saturated.
      const parity = bandIdx % 2
      this.L = parity
        ? 0.46 + this.rng() * 0.10   // darker stripe
        : 0.68 + this.rng() * 0.10   // lighter stripe
      // Small chroma jitter. Extreme values outside natural chromophores.
      this.C = 0.16 + this.rng() * 0.06
      this.H = this.dyeHue + (this.rng() - 0.5) * 10
      this.famIdx = parity ? 2 : 0
      this.domL = this.L; this.domC = this.C; this.domH = this.H
      return { L: this.L, C: this.C, H: this.H }
    }

    if (this.iris) {
      if (bandIdx === 0) {
        const first = this.irisPalette[0]
        this.L = first[0]; this.C = first[1]; this.H = first[2]
        this.famIdx = -1
        return { L: this.L, C: this.C, H: this.H }
      }
      const stripe = this.irisPalette[(bandIdx - 1) % this.irisPalette.length]
      this.L = stripe[0]; this.C = stripe[1]; this.H = stripe[2]
      this.famIdx = -1
      return { L: this.L, C: this.C, H: this.H }
    }

    // Zonal layout (Malawi-style): force regime/family by band phase,
    // bypass normal regime-flipping. Band 1 is the fat quiet zone; bands
    // 2-7 are the tight accent cluster (chalcedony regime); band 8+ is
    // the stained eye (if the specimen has one).
    if (this.zonal) {
      const prevWasShell = this.famIdx === 8
      if (bandIdx === 1) {
        this.regime = 'chalcedony'
        this.famIdx = this.zonalQuietFam
      } else if (bandIdx <= 7) {
        this.regime = 'chalcedony'
        this.famIdx = this.pickFamily(bandIdx)
      } else {
        // Eye phase.
        this.regime = this.zonalHasEye ? 'stained' : 'chalcedony'
        this.famIdx = this.pickFamily(bandIdx)
      }
      const [nL, nC, nH] = sampleFromFamily(FAMILIES[this.famIdx], this.rng)
      const blend = prevWasShell ? 0 : 0.08
      this.L = nL * (1 - blend) + this.L * blend
      this.C = this.applyVibrancy(nC, nH) * (1 - blend) + this.C * blend
      const dh = wrapHue(nH - this.H + 540) - 180
      this.H = wrapHue(nH + dh * blend - dh)
      this.domL = this.L; this.domC = this.C; this.domH = this.H
      return { L: this.L, C: this.C, H: this.H }
    }

    // Family persistence: real agate deposits the same mineral for
    // many consecutive bands (a stable "chapter" of chemistry). Real
    // specimens show long quiet runs of one family interrupted by a
    // single accent band, not alternation every band. Stay with the
    // current family ~88% of the time within the same regime.
    this.maybeFlipRegime()
    const prevWasShell = this.famIdx === 8
    const sameRegime = !prevWasShell && (
      (this.regime === 'chalcedony' && [0, 1, 6, 7].includes(this.famIdx)) ||
      (this.regime === 'stained' && [2, 3, 4, 5].includes(this.famIdx))
    )
    if (!sameRegime || this.rng() > 0.88) {
      this.famIdx = this.pickFamily(bandIdx)
    }
    let [nL, nC, nH] = sampleFromFamily(FAMILIES[this.famIdx], this.rng)
    // Quiet-band suppression: real agate is ~60% dusty/low-chroma tones
    // (translucent chalcedony, grey-cream, faint-peach) punctuated by
    // bright accents, not continuously saturated. Stained families keep
    // more heat than chalcedony ones but still get attenuated.
    const isChalcedonyFamily = [0, 1, 6, 7].includes(this.famIdx)
    if (this.famIdx !== 8 && this.rng() < 0.60) {
      const attenuation = isChalcedonyFamily ? 0.22 : 0.45
      nC *= attenuation
      if (isChalcedonyFamily) nL = clamp(nL + 0.04, 0, 0.97)
    }
    // Drop blend to zero when leaving the shell so band 1 isn't dragged dark.
    const leavingShell = prevWasShell && this.famIdx !== 8
    const blend = leavingShell ? 0 : 0.08
    this.L = nL * (1 - blend) + this.L * blend
    this.C = this.applyVibrancy(nC, nH) * (1 - blend) + this.C * blend
    const dh = wrapHue(nH - this.H + 540) - 180
    this.H = wrapHue(nH + dh * blend - dh)

    this.domL = this.L; this.domC = this.C; this.domH = this.H

    return { L: this.L, C: this.C, H: this.H }
  }
}

// ─── Sequence cache (per hueKey — typically per seed) ───────

const MAX_CACHED_BANDS = 512

interface SequenceEntry {
  generator: AgateBandGenerator
  sequence: BandColor[]
}

const sequenceCache: Map<number, SequenceEntry> = new Map()
let currentBandRng: PRNG = Math.random

export function setBandRng(rng: PRNG): void {
  currentBandRng = rng
  sequenceCache.clear()
}

/**
 * Deterministic RNG for a given hueKey. Forks the parent band RNG so
 * repeat lookups produce the same sequence, and every nodule's sequence
 * is independent of the order sequences were first requested.
 */
function forkedRngFor(hueKey: number): PRNG {
  // Mulberry32-style seed derivation, mixed from the shared band RNG.
  const base = Math.floor(currentBandRng() * 0x100000000)
  let s = ((base ^ (hueKey * 0x9e3779b9)) >>> 0)
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0
  s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0
  s = (s ^ (s >>> 16)) >>> 0
  let state = s | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

function ensureSequence(hueKey: number, upTo: number): SequenceEntry {
  let entry = sequenceCache.get(hueKey)
  if (!entry) {
    entry = {
      generator: new AgateBandGenerator(
        currentOptions,
        forkedRngFor(hueKey),
        isZonalLayout(hueKey),
        isOnyxLayout(hueKey),
        isDyedSpecimen(hueKey)
      ),
      sequence: [],
    }
    sequenceCache.set(hueKey, entry)
  }
  if (entry.sequence.length > upTo) return entry
  const target = Math.min(upTo + 1, MAX_CACHED_BANDS)
  while (entry.sequence.length < target) {
    entry.sequence.push(entry.generator.nextBandColor(entry.sequence.length))
  }
  return entry
}

// ─── Strategy export ────────────────────────────────────────

export const agateExperimental: BandColorStrategy = {
  name: 'agate-experimental',

  getBandColor(
    bandIdx: number,
    hueKey: number,
    _baseLightness: number,
    _saturation: number
  ): BandColor {
    const idx = Math.min(bandIdx, MAX_CACHED_BANDS - 1)
    const entry = ensureSequence(hueKey, idx)
    return entry.sequence[idx]
  },

  reset() {
    sequenceCache.clear()
  },
}
