/// <reference lib="webworker" />

/**
 * Partition worker — runs cavity partition + wall-distance transform
 * off the main thread so the dissolve animation stays smooth through
 * the handoff to the growing phase.
 */

import { partitionCavities } from './CavityPartition'
import { computeWallDistance } from './WallDistance'
import { isPartitionRequest } from './partitionProtocol'
import type { PartitionResponse } from './partitionProtocol'

/**
 * The project's tsconfig loads the "DOM" lib project-wide, which
 * declares a `Window`-typed `self`. The `webworker` lib referenced
 * above declares a conflicting `DedicatedWorkerGlobalScope`-typed
 * `self`. Rather than reach for `self as any`, narrow `globalThis`
 * to just the surface this file actually uses.
 */
interface PartitionWorkerScope {
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  postMessage(message: PartitionResponse, transfer: Transferable[]): void
}

const ctx = globalThis as unknown as PartitionWorkerScope

function asArrayBuffer(buffer: ArrayBufferLike, label: string): ArrayBuffer {
  if (!(buffer instanceof ArrayBuffer)) {
    throw new Error(`[partitionWorker] expected a transferable ArrayBuffer for ${label}`)
  }
  return buffer
}

ctx.onmessage = (evt) => {
  const data = evt.data
  if (!isPartitionRequest(data)) {
    console.error('[partitionWorker] dropped malformed request', data)
    return
  }
  const { id, seeds, W, H, noiseScale, warpStrength } = data
  const { gridData } = partitionCavities(seeds, W, H, noiseScale, warpStrength)
  const wallDist = computeWallDistance(gridData, W, H)
  const gridBuffer = asArrayBuffer(gridData.buffer, 'gridData')
  const wallBuffer = asArrayBuffer(wallDist.buffer, 'wallDist')
  const expectedBytes = W * H * Uint16Array.BYTES_PER_ELEMENT
  if (gridBuffer.byteLength !== expectedBytes || wallBuffer.byteLength !== expectedBytes) {
    console.error('[partitionWorker] buffer size mismatch', {
      expectedBytes,
      gridBufferBytes: gridBuffer.byteLength,
      wallBufferBytes: wallBuffer.byteLength,
    })
    return
  }
  const response: PartitionResponse = { type: 'partition-response', id, gridBuffer, wallBuffer }
  ctx.postMessage(response, [gridBuffer, wallBuffer])
}
