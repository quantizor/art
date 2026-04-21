#!/usr/bin/env bun
/**
 * Headless A/B renderer for the Tension generative agate.
 *
 * Runs the engine (partition → wall-distance → per-cell color) in Bun
 * without a browser, then writes labeled PNGs so shading changes can
 * be diffed iteration-to-iteration against a fixed seed.
 *
 * Usage:
 *   bun scripts/tension-render.ts --seed zonal01 --variant zonal --label iter03
 *
 * Outputs (defaults to /tmp/tension-iter/):
 *   <label>-a.png     — classic shading buffer
 *   <label>-b.png     — enhanced shading buffer
 *   <label>-diff.png  — abs(A-B) amplified 4×
 *   <label>-strip.png — stacked center-crop (A / B / diff) for quick Read
 */

import { parseArgs } from 'node:util'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

import { decodeSeed, forkDomain, forkSeedDomain, DOMAIN, type PRNG } from '~/projects/tension/engine/SeededRandom'
import { generateSeedPositions } from '~/projects/tension/engine/SeedPlacer'
import { partitionCavities } from '~/projects/tension/engine/CavityPartition'
import { computeWallDistance, computeInterSeedMask } from '~/projects/tension/engine/WallDistance'
import {
  setActiveProfile,
  setVariantOverride,
  computeColorWallBased,
  precomputeSeedTilt,
  type VariantPreset,
} from '~/projects/tension/engine/ColorMapper'
import { profile as agateProfile } from '~/projects/tension/profiles'
import type { Seed, ColorParams, SimulationParams, CrystalProfile } from '~/projects/tension/types'

// ─── PNG writer (node:zlib only, no deps) ─────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcIn = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcIn), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8      // bit depth
  ihdr[9] = 6      // color type (RGBA)
  ihdr[10] = 0     // compression
  ihdr[11] = 0     // filter
  ihdr[12] = 0     // interlace
  const rowLen = width * 4
  const raw = Buffer.alloc(height * (rowLen + 1))
  for (let y = 0; y < height; y++) {
    const dst = y * (rowLen + 1)
    raw[dst] = 0 // filter type: none
    raw.set(rgba.subarray(y * rowLen, y * rowLen + rowLen), dst + 1)
  }
  const idat = deflateSync(raw, { level: 6 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── Engine bootstrap (mirrors CrystalGrowthViewer + FloodFillSimulation) ──

function sampleSimParams(profile: CrystalProfile, rng: PRNG): Pick<SimulationParams, 'seedCount' | 'axisCount' | 'aspectRatio'> {
  const [scMin, scMax] = profile.seedCountRange
  const [axMin, axMax] = profile.axisCountRange
  const [arMin, arMax] = profile.aspectRatioRange
  return {
    seedCount: Math.floor(scMin + rng() * (scMax - scMin + 1)),
    axisCount: Math.round(axMin + rng() * (axMax - axMin)),
    aspectRatio: arMin + rng() * (arMax - arMin),
  }
}

function sampleColorParams(profile: CrystalProfile, rng: PRNG): ColorParams {
  const [wlMin, wlMax] = profile.bandWavelengthRange
  const [ampMin, ampMax] = profile.bandAmplitudeRange
  const [lMin, lMax] = profile.baseLightnessRange
  const [sMin, sMax] = profile.saturationRange
  return {
    bandWavelength: Math.round(wlMin + rng() * (wlMax - wlMin)),
    bandAmplitude: ampMin + rng() * (ampMax - ampMin),
    baseLightness: lMin + rng() * (lMax - lMin),
    saturation: sMin + rng() * (sMax - sMin),
    monoHue: Math.round(rng() * 360),
  }
}

/** Mirrors FloodFillSimulation.addSeed — deterministic per (masterSeed, index). */
function buildSeed(masterSeed: number, index: number, x: number, y: number, axisCount: number, profile: CrystalProfile): Seed {
  const rng = forkSeedDomain(masterSeed, DOMAIN.SEED_CRYSTALS, index)
  const baseAngle = rng() * Math.PI
  const axes: number[] = []
  for (let j = 0; j < axisCount; j++) axes.push(baseAngle + (j * Math.PI) / axisCount)
  const tilt = (rng() - 0.5) * 2 * profile.tiltRange
  const noiseOffsetX = rng() * 1000
  const noiseOffsetY = rng() * 1000
  // Headless runs at DPR=1 — use the base (unscaled) cavity radii.
  const maxRadius = 420 + rng() * 400
  const aspectRatio = 0.55 + rng() * 0.95
  return {
    id: index + 1,
    x: Math.round(x) | 0,
    y: Math.round(y) | 0,
    axes, tilt, noiseOffsetX, noiseOffsetY, maxRadius, aspectRatio,
  }
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      seed:    { type: 'string', default: 'zonal01' },
      variant: { type: 'string', default: 'random' },
      label:   { type: 'string', default: 'iter' },
      outdir:  { type: 'string', default: '/tmp/tension-iter' },
      width:   { type: 'string', default: '1600' },
      height:  { type: 'string', default: '900' },
      /** Parity mode: run BOTH passes with experimental=false.
       *  Expected: identical bytes → mean/peak delta 0. Any non-zero
       *  means the baseline path has picked up a hidden side effect. */
      parity:  { type: 'boolean', default: false },
      /** Optional native-resolution crop: "X,Y,W,H" in PIXEL space of
       *  the final (Y-flipped) PNG. When set, emits additional
       *  <label>-crop-{a,b,diff}.png files at exactly the requested
       *  size so we can loupe specific regions without downsampling. */
      crop:    { type: 'string' },
    },
  })

  const seedString = values.seed!
  const variant = values.variant as VariantPreset
  const W = Number(values.width)
  const H = Number(values.height)
  const masterSeed = decodeSeed(seedString)
  const SEED_MIN_DISTANCE = 50 // matches browser at DPR=1

  const simRng = forkDomain(masterSeed, DOMAIN.SIM_PARAMS)
  const colorRng = forkDomain(masterSeed, DOMAIN.COLOR_PARAMS)
  const strategyRng = forkDomain(masterSeed, DOMAIN.COLOR_STRATEGY)
  const bandRng = forkDomain(masterSeed, DOMAIN.BAND_COLORS)
  const placementRng = forkDomain(masterSeed, DOMAIN.SEED_PLACEMENT)

  const sim = sampleSimParams(agateProfile, simRng)
  const colorParams = sampleColorParams(agateProfile, colorRng)

  setActiveProfile(agateProfile, strategyRng, bandRng)
  setVariantOverride(variant)

  const positions = generateSeedPositions(sim.seedCount, W, H, SEED_MIN_DISTANCE, 10, placementRng)
  const seeds: Seed[] = positions.map((p, i) =>
    buildSeed(masterSeed, i, p.x, p.y, sim.axisCount, agateProfile)
  )

  // Dual partition scaffold — A at baseline, B at the current geometry
  // experiment (if any). Today both sides use the same scale; the next
  // cavity-shape experiment just overrides partitionScaleB. Each side
  // keeps its own gridData / wallDist / septum / per-seed max so a
  // geometry swap doesn't need any loop rewiring.
  const partitionScaleA = agateProfile.growthNoiseScale * 0.045
  const partitionScaleB = partitionScaleA // ← next geometry experiment lands here
  const { gridData: gridA } = partitionCavities(seeds, W, H, partitionScaleA, 0.065)
  const { gridData: gridB } = partitionCavities(seeds, W, H, partitionScaleB, 0.065)
  const wallDistA = computeWallDistance(gridA, W, H)
  const wallDistB = computeWallDistance(gridB, W, H)
  const septumA = computeInterSeedMask(gridA, W, H, 1)
  const septumB = computeInterSeedMask(gridB, W, H, 1)

  const buildMaxWallDist = (grid: Uint16Array, wallDist: Uint16Array): Map<number, number> => {
    const m = new Map<number, number>()
    for (let i = 0; i < grid.length; i++) {
      const s = grid[i]
      if (s === 0) continue
      const w = wallDist[i]
      const cur = m.get(s) ?? 0
      if (w > cur) m.set(s, w)
    }
    return m
  }
  const maxWallDistA = buildMaxWallDist(gridA, wallDistA)
  const maxWallDistB = buildMaxWallDist(gridB, wallDistB)

  const seedsMap = new Map(seeds.map(s => [s.id, s]))
  const tiltCache = new Map(seeds.map(s => [s.id, precomputeSeedTilt(s)]))

  const SEPTUM = [26, 22, 18]
  const INV_SCALE = 1 // DPR=1

  const rgbaA = new Uint8Array(W * H * 4)
  const rgbaB = new Uint8Array(W * H * 4)

  const experimentalOn = !values.parity

  // A loop — baseline shading, baseline partition.
  for (let i = 0; i < gridA.length; i++) {
    const seedId = gridA[i]
    const off = i * 4
    if (seedId === 0) {
      rgbaA[off] = 0; rgbaA[off + 1] = 0; rgbaA[off + 2] = 0; rgbaA[off + 3] = 255
      continue
    }
    const cy = (i / W) | 0
    const cx = i - cy * W
    const seed = seedsMap.get(seedId)!
    const tilt = tiltCache.get(seedId)!
    const dx = (cx - seed.x) * INV_SCALE
    const dy = (cy - seed.y) * INV_SCALE
    const wallDistCells = (wallDistA[i] / 3) * INV_SCALE
    const cavityMax = ((maxWallDistA.get(seedId) ?? 0) / 3) * INV_SCALE
    const axis0 = seed.axes[0] ?? 0
    computeColorWallBased(dx, dy, wallDistCells, colorParams, axis0, tilt, seedId, rgbaA, rgbaA, off, cavityMax, false)
    if (septumA[i]) {
      rgbaA[off] = SEPTUM[0]; rgbaA[off + 1] = SEPTUM[1]; rgbaA[off + 2] = SEPTUM[2]; rgbaA[off + 3] = 255
    }
  }

  // B loop — experimental shading + experimental partition.
  for (let i = 0; i < gridB.length; i++) {
    const seedId = gridB[i]
    const off = i * 4
    if (seedId === 0) {
      rgbaB[off] = 0; rgbaB[off + 1] = 0; rgbaB[off + 2] = 0; rgbaB[off + 3] = 255
      continue
    }
    const cy = (i / W) | 0
    const cx = i - cy * W
    const seed = seedsMap.get(seedId)!
    const tilt = tiltCache.get(seedId)!
    const dx = (cx - seed.x) * INV_SCALE
    const dy = (cy - seed.y) * INV_SCALE
    const wallDistCells = (wallDistB[i] / 3) * INV_SCALE
    const cavityMax = ((maxWallDistB.get(seedId) ?? 0) / 3) * INV_SCALE
    const axis0 = seed.axes[0] ?? 0
    computeColorWallBased(dx, dy, wallDistCells, colorParams, axis0, tilt, seedId, rgbaB, rgbaB, off, cavityMax, experimentalOn)
    if (septumB[i]) {
      rgbaB[off] = SEPTUM[0]; rgbaB[off + 1] = SEPTUM[1]; rgbaB[off + 2] = SEPTUM[2]; rgbaB[off + 3] = 255
    }
  }

  // Flip Y to match the browser's texY = H-1-cy convention so visual
  // orientation matches the on-screen output.
  const flipY = (src: Uint8Array): Uint8Array => {
    const out = new Uint8Array(src.length)
    const row = W * 4
    for (let y = 0; y < H; y++) out.set(src.subarray(y * row, y * row + row), (H - 1 - y) * row)
    return out
  }
  const outA = flipY(rgbaA)
  const outB = flipY(rgbaB)

  // Diff: amplified abs delta.
  const diff = new Uint8Array(outA.length)
  let deltaSum = 0
  let deltaMax = 0
  for (let i = 0; i < outA.length; i += 4) {
    const dR = Math.abs(outA[i] - outB[i])
    const dG = Math.abs(outA[i + 1] - outB[i + 1])
    const dB = Math.abs(outA[i + 2] - outB[i + 2])
    deltaSum += dR + dG + dB
    const peak = Math.max(dR, dG, dB)
    if (peak > deltaMax) deltaMax = peak
    diff[i] = Math.min(255, dR * 4)
    diff[i + 1] = Math.min(255, dG * 4)
    diff[i + 2] = Math.min(255, dB * 4)
    diff[i + 3] = 255
  }
  const pixels = W * H
  const meanDelta = deltaSum / (pixels * 3)

  /**
   * Extract a native-resolution crop from a source buffer. Buffers are
   * Y-flipped so origin (0,0) is top-left in render orientation.
   */
  const cropRegion = (src: Uint8Array, sx: number, sy: number, cw: number, ch: number): Uint8Array => {
    const out = new Uint8Array(cw * ch * 4)
    for (let row = 0; row < ch; row++) {
      const srcRow = ((sy + row) * W + sx) * 4
      out.set(src.subarray(srcRow, srcRow + cw * 4), row * cw * 4)
    }
    return out
  }

  mkdirSync(values.outdir!, { recursive: true })
  writeFileSync(join(values.outdir!, `${values.label}-a.png`),    encodePng(W, H, outA))
  writeFileSync(join(values.outdir!, `${values.label}-b.png`),    encodePng(W, H, outB))
  writeFileSync(join(values.outdir!, `${values.label}-diff.png`), encodePng(W, H, diff))

  // Full-coverage tiles at native 1:1 resolution. Vision encoders
  // downsample images above ~1024 px on the long side, which erases
  // fine band detail during diagnostic reads. Each tile is sized so
  // every pixel of the specimen can be inspected 1:1 across a small
  // number of files. Default tile is a quadrant (≤ W/2 × H/2 px).
  const TILE_W = Math.min(W, Math.ceil(W / 2))
  const TILE_H = Math.min(H, Math.ceil(H / 2))
  const tileCols = Math.ceil(W / TILE_W)
  const tileRows = Math.ceil(H / TILE_H)
  const cardinal = (col: number, row: number): string => {
    const c = tileCols === 1 ? '' : col === 0 ? 'w' : 'e'
    const r = tileRows === 1 ? '' : row === 0 ? 'n' : 's'
    return `${r}${c}` || 'full'
  }
  const emitTiles = (buf: Uint8Array, pass: 'a' | 'b' | 'diff') => {
    for (let row = 0; row < tileRows; row++) {
      for (let col = 0; col < tileCols; col++) {
        const sx = col * TILE_W
        const sy = row * TILE_H
        const cw = Math.min(TILE_W, W - sx)
        const ch = Math.min(TILE_H, H - sy)
        const tile = cropRegion(buf, sx, sy, cw, ch)
        const region = cardinal(col, row)
        writeFileSync(
          join(values.outdir!, `${values.label}-${region}-${pass}.png`),
          encodePng(cw, ch, tile)
        )
      }
    }
  }
  emitTiles(outA, 'a')
  emitTiles(outB, 'b')
  emitTiles(diff, 'diff')

  // Optional --crop X,Y,W,H native-resolution loupe crop.
  if (values.crop) {
    const parts = values.crop.split(',').map(n => Number(n.trim()))
    if (parts.length !== 4 || parts.some(n => !Number.isFinite(n) || n < 0)) {
      console.error(`--crop expects "X,Y,W,H" all non-negative; got "${values.crop}"`)
      process.exit(1)
    }
    const [cx, cy, cw, ch] = parts
    const maxW = Math.max(0, Math.min(cw, W - cx))
    const maxH = Math.max(0, Math.min(ch, H - cy))
    if (maxW <= 0 || maxH <= 0) {
      console.error(`--crop region is out of bounds for ${W}x${H} render`)
      process.exit(1)
    }
    writeFileSync(join(values.outdir!, `${values.label}-crop-a.png`),    encodePng(maxW, maxH, cropRegion(outA, cx, cy, maxW, maxH)))
    writeFileSync(join(values.outdir!, `${values.label}-crop-b.png`),    encodePng(maxW, maxH, cropRegion(outB, cx, cy, maxW, maxH)))
    writeFileSync(join(values.outdir!, `${values.label}-crop-diff.png`), encodePng(maxW, maxH, cropRegion(diff, cx, cy, maxW, maxH)))
  }

  const summary = {
    seed: seedString, variant, W, H,
    seeds: seeds.length,
    meanAbsDelta: Number(meanDelta.toFixed(3)),
    peakAbsDelta: deltaMax,
    out: values.outdir!,
  }
  console.log(JSON.stringify(summary, null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
