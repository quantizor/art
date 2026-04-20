/**
 * Partition service — main-thread wrapper around the partition worker.
 *
 * Runs cavity partition + wall-distance transform off the main thread
 * so the dissolve animation stays smooth through the handoff to the
 * growing phase.
 */

import type { Seed } from '../types'
import type { PartitionRequest, PartitionResponse } from './partitionWorker'

let worker: Worker | null = null
const pending = new Map<number, (res: { gridData: Uint16Array; wallDist: Uint16Array }) => void>()
let nextId = 0

function ensureWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./partitionWorker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (evt: MessageEvent<PartitionResponse>) => {
    const resolver = pending.get(evt.data.id)
    if (!resolver) return
    pending.delete(evt.data.id)
    resolver({
      gridData: new Uint16Array(evt.data.gridBuffer),
      wallDist: new Uint16Array(evt.data.wallBuffer),
    })
  }
  return worker
}

export function runPartition(
  seeds: Seed[],
  W: number,
  H: number,
  noiseScale: number,
  warpStrength: number
): Promise<{ gridData: Uint16Array; wallDist: Uint16Array }> {
  const w = ensureWorker()
  return new Promise((resolve) => {
    const id = nextId++
    pending.set(id, resolve)
    const req: PartitionRequest = { id, seeds: seeds.slice(), W, H, noiseScale, warpStrength }
    w.postMessage(req)
  })
}
