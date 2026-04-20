/// <reference lib="webworker" />

/**
 * Partition worker — runs cavity partition + wall-distance transform
 * off the main thread so the dissolve animation stays smooth through
 * the handoff to the growing phase.
 */

import { partitionCavities } from './CavityPartition'
import { computeWallDistance } from './WallDistance'
import type { Seed } from '../types'

export interface PartitionRequest {
  id: number
  seeds: Seed[]
  W: number
  H: number
  noiseScale: number
  warpStrength: number
}

export interface PartitionResponse {
  id: number
  gridBuffer: ArrayBuffer
  wallBuffer: ArrayBuffer
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx: DedicatedWorkerGlobalScope = self as any

ctx.onmessage = (evt: MessageEvent<PartitionRequest>) => {
  const { id, seeds, W, H, noiseScale, warpStrength } = evt.data
  const { gridData } = partitionCavities(seeds, W, H, noiseScale, warpStrength)
  const wallDist = computeWallDistance(gridData, W, H)
  const gridBuffer = gridData.buffer as ArrayBuffer
  const wallBuffer = wallDist.buffer as ArrayBuffer
  const response: PartitionResponse = { id, gridBuffer, wallBuffer }
  ctx.postMessage(response, [gridBuffer, wallBuffer])
}
